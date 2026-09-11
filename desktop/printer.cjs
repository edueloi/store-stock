const { printer: ThermalPrinter, types: PrinterTypes } = require("node-thermal-printer");
const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const os = require("os");
const path = require("path");

const execAsync = promisify(exec);

const TYPE_MAP = {
  epson: PrinterTypes.EPSON,
  daruma: PrinterTypes.DARUMA,
  star: PrinterTypes.STAR,
  tanca: PrinterTypes.TANCA,
};

// No Windows, portas COM só são graváveis via fs usando o caminho UNC \\.\COM3
function resolveInterface(config) {
  if (config.transport === "network") {
    const port = config.networkPort || 9100;
    return `tcp://${config.networkHost}:${port}`;
  }
  // transport === "serial"
  const port = config.serialPort || "";
  return process.platform === "win32" && !port.startsWith("\\\\.\\") ? `\\\\.\\${port}` : port;
}

function buildPrinter(config) {
  return new ThermalPrinter({
    type: TYPE_MAP[config.brand] || PrinterTypes.EPSON,
    interface: resolveInterface(config),
    width: config.width || 32,
    removeSpecialCharacters: false,
    options: { timeout: 5000 },
  });
}

// ESC/POS "corte total" (GS V 0) — mesmo comando que o driver node-thermal-printer usa
// no .cut(), reaplicado aqui pra manter o mesmo acabamento do cupom no transporte USB.
const CUT_COMMAND = Buffer.from([0x1d, 0x56, 0x00]);
// ESC p — abre a gaveta de dinheiro (pino 2, tempos padrão), mesmo comando usado pela
// impressora térmica "de verdade" via node-thermal-printer.openCashDrawer().
const OPEN_DRAWER_COMMAND = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);

// Impressora instalada como impressora comum do Windows (USB direto, a maioria das
// térmicas modernas) — manda ESC/POS raw via spooler nativo via WritePrinter (Win32
// winspool.drv, mesma API que qualquer driver de impressão usa por baixo), chamada
// via PowerShell/C# compilado na hora. Evita depender de módulo nativo (node-gyp) e
// evita também a API de alto nível System.Printing, que não escreve RAW de forma
// confiável em várias térmicas (fila aceita o job, mas nada sai no papel).
async function sendRawToUsbPrinter(printerName, buffer) {
  if (!printerName) throw new Error("Nenhuma impressora selecionada.");

  const tmpFile = path.join(os.tmpdir(), `boxsys-raw-${Date.now()}.prn`);
  fs.writeFileSync(tmpFile, buffer);

  try {
    const escapedPath = tmpFile.replace(/'/g, "''");
    const escapedPrinter = printerName.replace(/'/g, "''");
    const script = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class BoxSysRawPrinter {
  [StructLayout(LayoutKind.Sequential)]
  public struct DOCINFOA { [MarshalAs(UnmanagedType.LPStr)] public string pDocName; [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPStr)] public string pDataType; }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] ref DOCINFOA di);
  [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  public static bool SendBytesToPrinter(string szPrinterName, byte[] bytes) {
    IntPtr hPrinter; DOCINFOA di = new DOCINFOA(); bool success = false;
    di.pDocName = "BoxSys PDV"; di.pDataType = "RAW";
    if (!OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) return false;
    try {
      if (!StartDocPrinter(hPrinter, 1, ref di)) return false;
      try {
        if (!StartPagePrinter(hPrinter)) return false;
        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
        int written;
        success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out written);
        Marshal.FreeCoTaskMem(pUnmanagedBytes);
        EndPagePrinter(hPrinter);
      } finally { EndDocPrinter(hPrinter); }
    } finally { ClosePrinter(hPrinter); }
    return success;
  }
}
"@
$bytes = [System.IO.File]::ReadAllBytes('${escapedPath}')
$ok = [BoxSysRawPrinter]::SendBytesToPrinter('${escapedPrinter}', $bytes)
if (-not $ok) { throw "WritePrinter falhou (impressora offline ou nome incorreto)." }
`.trim();

    const psFile = path.join(os.tmpdir(), `boxsys-print-${Date.now()}.ps1`);
    fs.writeFileSync(psFile, script, "utf8");
    try {
      await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`, { shell: "cmd.exe" });
    } finally {
      fs.unlink(psFile, () => {});
    }
  } finally {
    fs.unlink(tmpFile, () => {});
  }
}

async function testUsbConnection(config) {
  try {
    if (!config.usbPrinterName) return { ok: false, error: "Nenhuma impressora selecionada." };
    // Comando ESC/POS "init" (ESC @) — inofensivo, mas confirma de verdade que o
    // spooler aceitou e escreveu bytes na impressora (não só que a fila existe).
    await sendRawToUsbPrinter(config.usbPrinterName, Buffer.from([0x1b, 0x40]));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

async function printReceiptUsb(text, config) {
  try {
    const encoded = Buffer.from(text, "utf-8");
    await sendRawToUsbPrinter(config.usbPrinterName, Buffer.concat([encoded, CUT_COMMAND]));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

async function openCashDrawerUsb(config) {
  try {
    await sendRawToUsbPrinter(config.usbPrinterName, OPEN_DRAWER_COMMAND);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

async function testConnection(config) {
  if (config.transport === "usb") return testUsbConnection(config);
  try {
    const printer = buildPrinter(config);
    const connected = await printer.isPrinterConnected();
    if (!connected) return { ok: false, error: "Impressora não respondeu. Verifique se está ligada e conectada." };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

async function printReceipt(text, config) {
  if (config.transport === "usb") return printReceiptUsb(text, config);
  try {
    const printer = buildPrinter(config);
    // O texto já vem formatado em colunas fixas (centralização/alinhamento manual),
    // então não usamos os helpers de alinhamento do driver aqui.
    printer.println(text);
    printer.cut();
    await printer.execute();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

async function openCashDrawer(config) {
  if (config.transport === "usb") return openCashDrawerUsb(config);
  try {
    const printer = buildPrinter(config);
    printer.openCashDrawer();
    await printer.execute();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

function describeError(err) {
  if (err === false || err === undefined) {
    return "Impressora não encontrada. Verifique se está ligada e conectada.";
  }
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("ENOENT") || message.includes("no such file")) {
    return "Porta não encontrada. Verifique se a impressora está ligada e conectada.";
  }
  if (message.includes("timeout") || message.includes("Timeout")) {
    return "A impressora não respondeu a tempo. Verifique a conexão.";
  }
  return `Falha na impressora: ${message}`;
}

module.exports = { testConnection, printReceipt, openCashDrawer };
