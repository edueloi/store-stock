// Agente fiscal do app desktop: usa o certificado instalado no Windows (token/cartão A3, ou qualquer certificado do repositório do
// usuário) para duas coisas que o servidor não consegue fazer com um A3, porque a chave privada não sai do token:
//   • assinar dados (a assinatura XML da nota é montada no servidor; aqui só se assina o resumo);
//   • falar com a SEFAZ / Sistema Nacional NFS-e com autenticação por certificado (mTLS).
// Tudo roda no PowerShell/.NET do próprio Windows, que sabe conversar com o driver do token e pede o PIN quando precisa.
// Nada aqui é usado por quem tem certificado A1 (arquivo .pfx): esse caminho continua inteiro no servidor.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

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
# Abre a chave privada ja com o PIN informado pelo app (variavel FISCAL_PIN). Sem PIN, cai no comportamento antigo (janela do driver).
function Get-KeyWithPin($cert) {
  $rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
  if (-not $rsa) { throw 'Este certificado nao tem chave RSA utilizavel para assinar.' }
  $pin = $env:FISCAL_PIN
  if (-not $pin) { return $rsa }
  try {
    if ($rsa -is [System.Security.Cryptography.RSACng]) {
      $bytes = [System.Text.Encoding]::Unicode.GetBytes($pin + [string][char]0)
      $prop = New-Object System.Security.Cryptography.CngProperty('SmartCardPin', $bytes, [System.Security.Cryptography.CngPropertyOptions]::None)
      $rsa.Key.SetProperty($prop)
    } elseif ($rsa -is [System.Security.Cryptography.RSACryptoServiceProvider]) {
      $info = $rsa.CspKeyContainerInfo
      $csp = New-Object System.Security.Cryptography.CspParameters($info.ProviderType, $info.ProviderName, $info.KeyContainerName)
      $csp.KeyNumber = [int]$info.KeyNumber
      $csp.Flags = [System.Security.Cryptography.CspProviderFlags]::UseExistingKey
      $ss = New-Object System.Security.SecureString
      foreach ($ch in $pin.ToCharArray()) { $ss.AppendChar($ch) }
      $csp.KeyPassword = $ss
      $rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider($csp)
    }
  } catch { [Console]::Error.WriteLine('Nao consegui aplicar o PIN: ' + $_.Exception.Message) }
  return $rsa
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
if ($env:FISCAL_PIN) { try { $k = Get-KeyWithPin $cert; [void]$k.SignData([byte[]](1,2,3), [System.Security.Cryptography.HashAlgorithmName]::SHA1, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1) } catch { [Console]::Error.WriteLine('PIN: ' + $_.Exception.Message) } }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
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

function runPowerShell(kind, input, timeoutMs = TIMEOUT_MS, pin = "") {
  return new Promise((resolve) => {
    const id = crypto.randomBytes(8).toString("hex");
    const dir = path.join(os.tmpdir(), `boxsys-fiscal-${id}`);
    fs.mkdirSync(dir, { recursive: true });
    const inFile = path.join(dir, "in.json"), outFile = path.join(dir, "out.json"), psFile = path.join(dir, "run.ps1");
    // BOM no .ps1: o Windows PowerShell 5 lê UTF-8 só com BOM
    fs.writeFileSync(psFile, "﻿" + SCRIPTS[kind], "utf8");
    fs.writeFileSync(inFile, JSON.stringify(input || {}), "utf8");
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", psFile], {
      env: { ...process.env, FISCAL_IN: inFile, FISCAL_OUT: outFile, FISCAL_PIN: pin || "" }, windowsHide: true,
    });
    let stderr = "";
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    const clean = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } };
    const timer = setTimeout(() => { try { child.kill(); } catch { /* já saiu */ } clean(); resolve({ ok: false, error: "O certificado não respondeu a tempo (PIN do token não informado?)." }); }, timeoutMs);
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const out = JSON.parse(fs.readFileSync(outFile, "utf8").replace(/^﻿/, ""));
        clean(); resolve(out);
      } catch {
        const msg = stderr.split(/\r?\n/).find((l) => l.trim()) || "Falha ao usar o certificado do Windows.";
        clean(); resolve({ ok: false, error: msg.slice(0, 300) });
      }
    });
    child.on("error", (e) => { clearTimeout(timer); clean(); resolve({ ok: false, error: e.message }); });
  });
}

const HASHES = new Set(["SHA1", "SHA256"]);

/** Lista certificados com chave privada deste computador (para escolher qual é o A3). */
async function listCerts() { return runPowerShell("list", {}, 30_000); }

/** Assina os bytes (base64) com a chave do certificado. hash: SHA1 (NF-e/NFC-e/NFS-e atual) ou SHA256. */
async function signData({ thumbprint, dataBase64, hash = "SHA1", pin = "" }) {
  if (!thumbprint || !dataBase64 || !HASHES.has(hash)) return { ok: false, error: "Pedido de assinatura inválido." };
  return runPowerShell("sign", { thumbprint, data: dataBase64, hash }, TIMEOUT_MS, pin);
}

/** Chamada HTTPS (SEFAZ / NFS-e) autenticada pelo certificado. Só aceita endereços fiscais conhecidos. */
const ALLOWED_HOSTS = /\.gov\.br$/i; // só serviços do governo (SEFAZ, Sistema Nacional NFS-e)
async function httpRequest({ thumbprint, url, method = "POST", headers = {}, body = "", contentType = "text/xml; charset=utf-8", caDers = [], timeoutSec = 60, pin = "" }) {
  let u;
  try { u = new URL(url); } catch { return { ok: false, error: "Endereço inválido." }; }
  if (u.protocol !== "https:" || !ALLOWED_HOSTS.test(u.hostname)) return { ok: false, error: `Endereço não permitido para nota fiscal: ${u.hostname}` };
  if (!thumbprint) return { ok: false, error: "Certificado não informado." };
  return runPowerShell("http", { thumbprint, url, method, headers, body, contentType, caDers, timeoutSec: Math.min(120, Number(timeoutSec) || 60) }, TIMEOUT_MS, pin);
}

module.exports = { listCerts, signData, httpRequest };
