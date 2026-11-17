// Agente fiscal do app desktop: usa o certificado instalado no Windows (token/cartão A3, ou qualquer certificado do repositório do
// usuário) para duas coisas que o servidor não consegue fazer com um A3, porque a chave privada não sai do token:
//   • assinar dados (a assinatura XML da nota é montada no servidor; aqui só se assina o resumo);
//   • falar com a SEFAZ / Sistema Nacional NFS-e com autenticação por certificado (mTLS).
// Tudo roda no PowerShell/.NET do próprio Windows, que sabe conversar com o driver do token.
// Assinar e falar com o governo usam UMA sessão de PowerShell que fica aberta o dia todo: o driver guarda o PIN enquanto o processo que
// fez o login continua vivo, então o PIN é pedido uma vez por dia (e de novo se o token for retirado ou der erro), não a cada nota.
// Nada aqui é usado por quem tem certificado A1 (arquivo .pfx): esse caminho continua inteiro no servidor.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

let logger = (m) => console.log(m);
function setLogger(fn) { if (typeof fn === "function") logger = fn; }
const TIMEOUT_MS = 120_000; // inclui o tempo de a pessoa digitar o PIN do token

const PS_COMMON = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
function Find-Cert([string]$thumb) {
  $t = ($thumb -replace '\\s','').ToUpper()
  foreach ($loc in 'CurrentUser','LocalMachine') {
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store('My', $loc)
    $store.Open('ReadOnly')
    $c = $store.Certificates | Where-Object { $_.Thumbprint -eq $t } | Select-Object -First 1
    $store.Close()
    if ($c) { return $c }
  }
  throw 'Certificado nao encontrado neste computador. Conecte o token e confira se ele aparece no Windows.'
}
# Abre a chave privada. Registra o provedor (para diagnostico) e da uma janela-mae visivel ao driver (HWND Handle) para a janela de PIN
# dele abrir por cima do app, em vez de ficar escondida.
function Open-Key($cert) {
  $rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
  if (-not $rsa) { throw 'Este certificado nao tem chave RSA utilizavel para assinar.' }
  try {
    if ($rsa -is [System.Security.Cryptography.RSACng]) { [Console]::Error.WriteLine('Chave CNG: provedor=' + $rsa.Key.Provider.Provider + ' nome=' + $rsa.Key.KeyName) }
    elseif ($rsa -is [System.Security.Cryptography.RSACryptoServiceProvider]) { [Console]::Error.WriteLine('Chave CSP: provedor=' + $rsa.CspKeyContainerInfo.ProviderName + ' container=' + $rsa.CspKeyContainerInfo.KeyContainerName) }
  } catch { }
  if ($env:FISCAL_HWND -and ($rsa -is [System.Security.Cryptography.RSACng])) {
    try {
      $h = [Int64]$env:FISCAL_HWND
      $hb = if ([IntPtr]::Size -eq 8) { [BitConverter]::GetBytes([Int64]$h) } else { [BitConverter]::GetBytes([Int32]$h) }
      $rsa.Key.SetProperty((New-Object System.Security.Cryptography.CngProperty('HWND Handle', $hb, [System.Security.Cryptography.CngPropertyOptions]::None)))
    } catch { [Console]::Error.WriteLine('HWND nao aplicado: ' + $_.Exception.Message) }
  }
  return $rsa
}
# Na sessao do dia a chave aberta (e o login do PIN) fica guardada e e reaproveitada nas proximas notas
function Get-KeyWithPin($cert) {
  if (($global:KEYS -is [hashtable]) -and $global:KEYS.ContainsKey($cert.Thumbprint)) { return $global:KEYS[$cert.Thumbprint] }
  $k = Open-Key $cert
  if ($global:KEYS -is [hashtable]) { $global:KEYS[$cert.Thumbprint] = $k }
  return $k
}
`;

const SCRIPTS = {
  // lista os certificados que têm chave privada (A1 instalado ou A3 conectado)
  list: `${PS_COMMON}
$in = Get-Content -Raw -Encoding UTF8 $env:FISCAL_IN | ConvertFrom-Json
$out = @()
foreach ($loc in 'CurrentUser','LocalMachine') {
  $store = New-Object System.Security.Cryptography.X509Certificates.X509Store('My', $loc)
  $store.Open('ReadOnly')
  foreach ($c in $store.Certificates) {
    if (-not $c.HasPrivateKey) { continue }
    $out += [pscustomobject]@{ subject = $c.Subject; issuer = $c.Issuer; thumbprint = $c.Thumbprint; notAfter = $c.NotAfter.ToString('o'); notBefore = $c.NotBefore.ToString('o'); der = [Convert]::ToBase64String($c.RawData) }
  }
  $store.Close()
}
@{ ok = $true; certs = $out } | ConvertTo-Json -Depth 4 -Compress | Set-Content -Encoding UTF8 $env:FISCAL_OUT
`,
  // assina (PKCS#1 v1.5) os bytes recebidos com a chave do certificado; o Windows/driver pede o PIN se precisar
  sign: `${PS_COMMON}
$in = Get-Content -Raw -Encoding UTF8 $env:FISCAL_IN | ConvertFrom-Json
$cert = Find-Cert $in.thumbprint
$rsa = Get-KeyWithPin $cert
$name = [System.Security.Cryptography.HashAlgorithmName]::$($in.hash)
$sig = $rsa.SignData([Convert]::FromBase64String($in.data), $name, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
@{ ok = $true; signature = [Convert]::ToBase64String($sig) } | ConvertTo-Json -Compress | Set-Content -Encoding UTF8 $env:FISCAL_OUT
`,
  // chamada HTTPS com o certificado do cliente (mTLS) e validação da cadeia do servidor contra as AC informadas
  http: `${PS_COMMON}
$in = Get-Content -Raw -Encoding UTF8 $env:FISCAL_IN | ConvertFrom-Json
$cert = Find-Cert $in.thumbprint
# autentica o token antes do handshake (assina um byte): o PIN do dia vale tambem para a conexao
try { $k = Get-KeyWithPin $cert; [void]$k.SignData([byte[]](1,2,3), [System.Security.Cryptography.HashAlgorithmName]::SHA1, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1) } catch { [Console]::Error.WriteLine('PIN: ' + $_.Exception.Message) }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if (-not ('FiscalValidator' -as [type])) {
Add-Type -ReferencedAssemblies System.Net.Http -TypeDefinition @"
using System; using System.Net.Http; using System.Net.Security; using System.Security.Cryptography.X509Certificates; using System.Collections.Generic;
public static class FiscalValidator {
  public static List<X509Certificate2> Roots = new List<X509Certificate2>();
  public static bool Validate(HttpRequestMessage req, X509Certificate2 cert, X509Chain chain, SslPolicyErrors errors) {
    if (errors == SslPolicyErrors.None) return true;
    if ((errors & SslPolicyErrors.RemoteCertificateNameMismatch) != 0) return false;
    X509Chain ch = new X509Chain();
    ch.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
    ch.ChainPolicy.VerificationFlags = X509VerificationFlags.AllowUnknownCertificateAuthority;
    foreach (X509Certificate2 r in Roots) ch.ChainPolicy.ExtraStore.Add(r);
    ch.Build(cert);
    foreach (X509ChainElement el in ch.ChainElements) foreach (X509Certificate2 r in Roots) if (el.Certificate.Thumbprint == r.Thumbprint) return true;
    return false;
  }
}
"@
}
[FiscalValidator]::Roots.Clear()
foreach ($der in $in.caDers) { try { [void][FiscalValidator]::Roots.Add((New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 (,[Convert]::FromBase64String($der)))) } catch {} }
$handler = New-Object System.Net.Http.HttpClientHandler
$handler.ClientCertificateOptions = 'Manual'
[void]$handler.ClientCertificates.Add($cert)
$del = [Delegate]::CreateDelegate([Func[System.Net.Http.HttpRequestMessage,System.Security.Cryptography.X509Certificates.X509Certificate2,System.Security.Cryptography.X509Certificates.X509Chain,System.Net.Security.SslPolicyErrors,bool]], [FiscalValidator].GetMethod('Validate'))
$handler.ServerCertificateCustomValidationCallback = $del
$client = New-Object System.Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromSeconds([int]$in.timeoutSec)
$msg = New-Object System.Net.Http.HttpRequestMessage($in.method, $in.url)
if ($in.body) { $msg.Content = New-Object System.Net.Http.StringContent($in.body, [System.Text.Encoding]::UTF8); $msg.Content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse($in.contentType) }
foreach ($p in $in.headers.PSObject.Properties) { if ($p.Name -notin 'content-type','content-length') { [void]$msg.Headers.TryAddWithoutValidation($p.Name, [string]$p.Value) } }
$resp = $client.SendAsync($msg).GetAwaiter().GetResult()
$text = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
@{ ok = $true; status = [int]$resp.StatusCode; body = $text } | ConvertTo-Json -Compress | Set-Content -Encoding UTF8 $env:FISCAL_OUT
`,
};

// Laço da sessão: lê um pedido por linha (JSON) e roda o script correspondente no MESMO processo, para o login do token valer o dia todo.
const WORKER_PS = `${PS_COMMON}
$global:KEYS = @{}
while (($line = [Console]::In.ReadLine()) -ne $null) {
  if (-not $line.Trim()) { continue }
  $req = $line | ConvertFrom-Json
  try {
    $env:FISCAL_IN = $req.inFile; $env:FISCAL_OUT = $req.outFile; $env:FISCAL_HWND = [string]$req.hwnd
    $sb = [ScriptBlock]::Create([System.IO.File]::ReadAllText($req.script, [System.Text.Encoding]::UTF8))
    & $sb
  } catch {
    @{ ok = $false; error = [string]$_.Exception.Message } | ConvertTo-Json -Compress | Set-Content -Encoding UTF8 $req.outFile
  }
  [Console]::Out.WriteLine('DONE ' + $req.id)
  [Console]::Out.Flush()
}
`;

const BOM = "﻿"; // BOM no .ps1: o Windows PowerShell 5 lê UTF-8 só com BOM
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

// ── Execução avulsa (listar certificados) ─────────────────────────────────────────────────────────────────
function runPowerShell(kind, input, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve) => {
    const id = crypto.randomBytes(8).toString("hex");
    const t0 = Date.now();
    logger(`[fiscal-agent] ${kind}: iniciando`);
    const dir = path.join(os.tmpdir(), `boxsys-fiscal-${id}`);
    fs.mkdirSync(dir, { recursive: true });
    const inFile = path.join(dir, "in.json"), outFile = path.join(dir, "out.json"), psFile = path.join(dir, "run.ps1");
    fs.writeFileSync(psFile, BOM + SCRIPTS[kind], "utf8");
    fs.writeFileSync(inFile, JSON.stringify(input || {}), "utf8");
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", psFile], {
      env: { ...process.env, FISCAL_IN: inFile, FISCAL_OUT: outFile }, windowsHide: true,
    });
    let stderr = "";
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    const clean = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } };
    const timer = setTimeout(() => { try { child.kill(); } catch { /* já saiu */ } clean(); logger(`[fiscal-agent] ${kind}: SEM RESPOSTA em ${Math.round((Date.now() - t0) / 1000)}s. stderr: ${stderr.slice(0, 300) || "(vazio)"}`); resolve({ ok: false, error: "O Windows não respondeu a tempo ao listar os certificados." }); }, timeoutMs);
    child.on("close", () => {
      clearTimeout(timer);
      logger(`[fiscal-agent] ${kind}: terminou em ${Math.round((Date.now() - t0) / 1000)}s`);
      try {
        const out = JSON.parse(fs.readFileSync(outFile, "utf8").replace(/^﻿/, ""));
        clean(); resolve(out);
      } catch {
        const msg = stderr.split(/\r?\n/).find((l) => l.trim()) || "Falha ao usar o certificado do Windows.";
        logger(`[fiscal-agent] ${kind}: falhou: ${stderr.slice(0, 300)}`);
        clean(); resolve({ ok: false, error: msg.slice(0, 300) });
      }
    });
    child.on("error", (e) => { clearTimeout(timer); clean(); resolve({ ok: false, error: e.message }); });
  });
}

// ── Sessão do dia (assinar e falar com o governo) ──────────────────────────────────────────────────────────
let worker = null;
let tail = Promise.resolve(); // um pedido de cada vez na sessão

function stopWorker() {
  if (!worker) return;
  const w = worker; worker = null;
  try { w.child.kill(); } catch { /* já saiu */ }
  try { fs.rmSync(w.dir, { recursive: true, force: true }); } catch { /* temp */ }
}

function startWorker() {
  const dir = path.join(os.tmpdir(), `boxsys-fiscal-sessao-${crypto.randomBytes(6).toString("hex")}`);
  fs.mkdirSync(dir, { recursive: true });
  const psFile = path.join(dir, "sessao.ps1");
  fs.writeFileSync(psFile, BOM + WORKER_PS, "utf8");
  for (const k of ["sign", "http"]) fs.writeFileSync(path.join(dir, `${k}.ps1`), BOM + SCRIPTS[k], "utf8");
  const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", psFile], { windowsHide: true });
  const w = { child, dir, day: dayKey(), used: false, buf: "", err: "", cur: null };
  child.stdout.on("data", (d) => {
    w.buf += d.toString();
    let i;
    while ((i = w.buf.indexOf("\n")) >= 0) {
      const line = w.buf.slice(0, i).trim(); w.buf = w.buf.slice(i + 1);
      const m = /^DONE (\w+)/.exec(line);
      if (m && w.cur && w.cur.id === m[1]) w.cur.done();
    }
  });
  child.stderr.on("data", (d) => { w.err += d.toString(); });
  child.on("close", () => { if (worker === w) worker = null; if (w.cur) w.cur.fail("A sessão do certificado foi encerrada."); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });
  child.on("error", (e) => { if (worker === w) worker = null; if (w.cur) w.cur.fail(e.message); });
  logger("[fiscal-agent] sessao do certificado iniciada");
  return w;
}

/** true se já existe uma sessão do dia com o token autenticado (não precisa pedir PIN de novo). */
function sessionOpen() { return !!worker && worker.used && worker.day === dayKey(); }

function runInSession(kind, input, timeoutMs, hwnd) {
  const job = () => new Promise((resolve) => {
    if (worker && worker.day !== dayKey()) { logger("[fiscal-agent] virou o dia: encerrando a sessao do token (novo PIN amanha)"); stopWorker(); }
    if (!worker) worker = startWorker();
    const w = worker;
    const id = crypto.randomBytes(6).toString("hex");
    const t0 = Date.now();
    const inFile = path.join(w.dir, `${id}.in.json`), outFile = path.join(w.dir, `${id}.out.json`);
    fs.writeFileSync(inFile, JSON.stringify(input || {}), "utf8");
    w.err = "";
    logger(`[fiscal-agent] ${kind}: iniciando (sessao do token ${w.used ? "ja aberta" : "nova"})`);
    const cleanFiles = () => { try { fs.rmSync(inFile, { force: true }); fs.rmSync(outFile, { force: true }); } catch { /* temp */ } };
    let timer;
    const end = (res) => {
      clearTimeout(timer); w.cur = null; cleanFiles();
      if (!res.ok) stopWorker(); // qualquer falha zera a sessão (PIN errado/token retirado): o próximo pedido recomeça limpo
      else w.used = true;
      resolve(res);
    };
    timer = setTimeout(() => {
      logger(`[fiscal-agent] ${kind}: SEM RESPOSTA em ${Math.round((Date.now() - t0) / 1000)}s. stderr: ${w.err.slice(0, 400) || "(vazio)"}`);
      end({ ok: false, error: kind === "sign" ? "A assinatura com o token não terminou a tempo. Se aparecer uma janela de PIN do token, digite o PIN nela; feche outros programas que usam o token e tente de novo." : "O envio da nota com o certificado não terminou a tempo. Confira o token e a internet do computador do certificado." });
    }, timeoutMs);
    w.cur = {
      id,
      done: () => {
        logger(`[fiscal-agent] ${kind}: terminou em ${Math.round((Date.now() - t0) / 1000)}s`);
        try { end(JSON.parse(fs.readFileSync(outFile, "utf8").replace(/^﻿/, ""))); }
        catch { logger(`[fiscal-agent] ${kind}: falhou: ${w.err.slice(0, 300)}`); end({ ok: false, error: (w.err.split(/\r?\n/).find((l) => l.trim()) || "Falha ao usar o certificado do Windows.").slice(0, 300) }); }
      },
      fail: (msg) => end({ ok: false, error: msg }),
    };
    try { w.child.stdin.write(JSON.stringify({ id, script: path.join(w.dir, `${kind}.ps1`), inFile, outFile, hwnd: hwnd || "" }) + "\n"); }
    catch (e) { end({ ok: false, error: e.message }); }
  });
  const p = tail.then(job, job);
  tail = p.catch(() => {});
  return p;
}

const HASHES = new Set(["SHA1", "SHA256"]);

/** Lista certificados com chave privada deste computador (para escolher qual é o A3). */
async function listCerts() { return runPowerShell("list", {}, 30_000); }

/** Assina os bytes (base64) com a chave do certificado. hash: SHA1 (NF-e/NFC-e/NFS-e atual) ou SHA256. */
async function signData({ thumbprint, dataBase64, hash = "SHA1", hwnd = "" }) {
  if (!thumbprint || !dataBase64 || !HASHES.has(hash)) return { ok: false, error: "Pedido de assinatura inválido." };
  return runInSession("sign", { thumbprint, data: dataBase64, hash }, TIMEOUT_MS, hwnd);
}

/** Chamada HTTPS (SEFAZ / NFS-e) autenticada pelo certificado. Só aceita endereços fiscais conhecidos. */
const ALLOWED_HOSTS = /\.gov\.br$/i; // só serviços do governo (SEFAZ, Sistema Nacional NFS-e)
async function httpRequest({ thumbprint, url, method = "POST", headers = {}, body = "", contentType = "text/xml; charset=utf-8", caDers = [], timeoutSec = 60, hwnd = "" }) {
  let u;
  try { u = new URL(url); } catch { return { ok: false, error: "Endereço inválido." }; }
  if (u.protocol !== "https:" || !ALLOWED_HOSTS.test(u.hostname)) return { ok: false, error: `Endereço não permitido para nota fiscal: ${u.hostname}` };
  if (!thumbprint) return { ok: false, error: "Certificado não informado." };
  return runInSession("http", { thumbprint, url, method, headers, body, contentType, caDers, timeoutSec: Math.min(120, Number(timeoutSec) || 60) }, TIMEOUT_MS, hwnd);
}

module.exports = { listCerts, signData, httpRequest, setLogger, sessionOpen, stopWorker };
