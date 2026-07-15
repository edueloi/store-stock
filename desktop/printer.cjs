const { printer: ThermalPrinter, types: PrinterTypes } = require("node-thermal-printer");

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

async function testConnection(config) {
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
