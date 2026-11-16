// Leitura de código de barras pela câmera — só existe dentro do app Android (Capacitor).
// No navegador comum o botão não aparece: lá o leitor USB/bluetooth continua digitando o código.
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, unknown>;
  registerPlugin?: (name: string) => unknown;
};

type ScannerPlugin = {
  scan: (opts?: object) => Promise<{ barcodes: { rawValue?: string; displayValue?: string }[] }>;
  isGoogleBarcodeScannerModuleAvailable?: () => Promise<{ available: boolean }>;
  installGoogleBarcodeScannerModule?: () => Promise<void>;
};

function capacitor(): CapacitorGlobal | undefined {
  return typeof window === "undefined" ? undefined : (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNativeApp(): boolean {
  try { return !!capacitor()?.isNativePlatform?.(); } catch { return false; }
}

function plugin(): ScannerPlugin | null {
  const cap = capacitor();
  if (!cap) return null;
  return ((cap.Plugins?.BarcodeScanner ?? cap.registerPlugin?.("BarcodeScanner")) as ScannerPlugin | undefined) ?? null;
}

export type ScanResult = { code: string } | { error: string } | null;

/** Abre a câmera, lê um código e devolve. `null` = o usuário cancelou. */
export async function scanBarcodeWithCamera(): Promise<ScanResult> {
  const p = plugin();
  if (!p) return { error: "Leitura pela câmera indisponível neste aparelho." };
  try {
    const mod = await p.isGoogleBarcodeScannerModuleAvailable?.();
    if (mod && !mod.available) {
      await p.installGoogleBarcodeScannerModule?.();
      return { error: "Preparando o leitor (primeira vez). Aguarde alguns segundos e toque de novo." };
    }
    const { barcodes } = await p.scan();
    const code = (barcodes?.[0]?.rawValue || barcodes?.[0]?.displayValue || "").trim();
    return code ? { code } : null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/cancel/i.test(msg)) return null;
    return { error: "Não foi possível abrir a câmera. Confira a permissão do app." };
  }
}
