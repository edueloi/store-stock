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

export type OfflineOpType = "sale" | "cash_open" | "cash_close";

export interface OfflineOpRecord {
  localId: string;
  type: OfflineOpType;
  createdAt: string;
  attempts: number;
  lastError?: string;
  [key: string]: unknown;
}

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

  // Banco local (SQLite) — cache de catálogo e fila de operações offline
  dbSaveCache: (key: string, value: unknown) => Promise<{ ok: boolean }>;
  dbGetCache: <T = unknown>(key: string) => Promise<T | undefined>;
  dbEnqueueOp: (
    type: OfflineOpType,
    localId: string,
    payload: Record<string, unknown>,
    createdAt: string
  ) => Promise<{ ok: boolean }>;
  dbListOps: (type?: OfflineOpType) => Promise<OfflineOpRecord[]>;
  dbCountOps: (type?: OfflineOpType) => Promise<number>;
  dbRemoveOp: (localId: string) => Promise<{ ok: boolean }>;

  onShortcut: (callback: (action: PdvShortcutAction) => void) => () => void;
}

declare global {
  interface Window {
    boxsysDesktop?: BoxsysDesktopApi;
  }
}
