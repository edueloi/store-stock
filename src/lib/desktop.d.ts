export interface SerialPortInfo {
  path: string;
  manufacturer: string | null;
  serialNumber: string | null;
}

export interface PrinterConfig {
  brand: "epson" | "daruma" | "star" | "tanca";
  transport: "serial" | "network";
  serialPort?: string;
  networkHost?: string;
  networkPort?: number;
}

export interface PrinterActionResult {
  ok: boolean;
  error?: string;
}

export type PdvShortcutAction = "open-drawer" | "focus-search" | "checkout" | "new-sale";

export interface BoxsysDesktopApi {
  isDesktop: true;
  version: string;
  saveServer: (url: string) => Promise<{ ok: boolean; error?: string }>;
  retry: () => Promise<boolean>;

  printReceipt: (text: string) => Promise<PrinterActionResult>;
  openCashDrawer: () => Promise<PrinterActionResult>;
  getPrinterConfig: () => Promise<PrinterConfig | null>;
  savePrinterConfig: (cfg: PrinterConfig) => Promise<{ ok: boolean }>;
  testPrinter: (cfg: PrinterConfig) => Promise<PrinterActionResult>;
  listSerialPorts: () => Promise<SerialPortInfo[]>;

  onShortcut: (callback: (action: PdvShortcutAction) => void) => () => void;
}

declare global {
  interface Window {
    boxsysDesktop?: BoxsysDesktopApi;
  }
}
