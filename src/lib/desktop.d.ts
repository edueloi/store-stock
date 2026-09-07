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

export interface DesktopPrinterRecord {
  id: number;
  label: string;
  role: "receipt" | "service_order" | "custom";
  is_default: boolean;
  config: PrinterConfig;
}

export interface PairingState {
  terminalUid: string;
  paired: { id: number; name: string; tenant_id: number } | null;
  hasServer: boolean;
}

export interface PairingCodeResult {
  ok: boolean;
  code?: string;
  expiresInSeconds?: number;
  error?: string;
}

export interface PairingStatusResult {
  paired: boolean;
  terminal?: { id: number; name: string; tenant_id: number };
  expired?: boolean;
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

  // Pareamento de terminal (Configurações → Vincular Dispositivos)
  getPairingState: () => Promise<PairingState>;
  requestPairingCode: () => Promise<PairingCodeResult>;
  checkPairingStatus: () => Promise<PairingStatusResult>;

  // Múltiplas impressoras por terminal (cupom, OS em A4, etc.)
  listPrinters: () => Promise<{ ok: boolean; printers: DesktopPrinterRecord[]; error?: string }>;
  createPrinter: (data: {
    label: string;
    role: "receipt" | "service_order" | "custom";
    config: PrinterConfig;
    is_default?: boolean;
  }) => Promise<{ ok: boolean; printer?: DesktopPrinterRecord; error?: string }>;
  updatePrinter: (
    id: number,
    data: Partial<{
      label: string;
      role: "receipt" | "service_order" | "custom";
      config: PrinterConfig;
      is_default: boolean;
    }>
  ) => Promise<{ ok: boolean; printer?: DesktopPrinterRecord; error?: string }>;
  deletePrinter: (id: number) => Promise<{ ok: boolean; error?: string }>;
  testPrinterConfig: (cfg: PrinterConfig) => Promise<PrinterActionResult>;
  printByRole: (role: string, text: string) => Promise<PrinterActionResult>;

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
