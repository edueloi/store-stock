const { printer: ThermalPrinter, types: PrinterTypes } = require("node-thermal-printer");
const { PosPrinter } = require("electron-pos-printer");

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

// Impressora instalada como impressora comum do Windows (USB direto, a maioria das
// térmicas modernas) — manda ESC/POS raw via spooler nativo em vez de escrever numa
// porta serial, usando electron-pos-printer (sem dependência nativa própria).
async function testUsbConnection(config) {
  try {
    if (!config.usbPrinterName) return { ok: false, error: "Nenhuma impressora selecionada." };
    // node.js "printer"/PowerShell não expõem status de conexão direto — um comando
    // vazio (0 bytes) valida que o spooler aceita a fila sem imprimir nada visível.
    await PosPrinter.sendRawCommand(config.usbPrinterName, Buffer.alloc(0));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

async function printReceiptUsb(text, config) {
  try {
    const encoded = Buffer.from(text, "utf-8");
    await PosPrinter.sendRawCommand(config.usbPrinterName, Buffer.concat([encoded, CUT_COMMAND]));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

async function openCashDrawerUsb(config) {
  try {
    await PosPrinter.openCashDrawer(config.usbPrinterName);
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
