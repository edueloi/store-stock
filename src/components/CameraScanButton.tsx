import { useEffect, useState } from "react";
import { ScanLine } from "lucide-react";
import { isNativeApp, scanBarcodeWithCamera } from "../lib/nativeScanner";
import { useToast } from "./ui/Toast";

const FAB_KEY = "camera_scan_fab_v1";

/** Botão flutuante do PDV: ligado por padrão, a pessoa pode desligar em Configurações. */
export function isScanFabEnabled(): boolean {
  try { return localStorage.getItem(FAB_KEY) !== "off"; } catch { return true; }
}
export function setScanFabEnabled(on: boolean) {
  try { localStorage.setItem(FAB_KEY, on ? "on" : "off"); window.dispatchEvent(new Event("scan-fab-change")); } catch { /* sem storage */ }
}

interface Props {
  onScan: (code: string) => void;
  className?: string;
  label?: string;
  /** "fab" = bolinha discreta só com o ícone (respeita a preferência de Configurações) */
  variant?: "button" | "fab";
}

/** Escanear pela câmera — aparece somente no app Android (APK). No navegador não renderiza nada. */
export default function CameraScanButton({ onScan, className = "", label = "Escanear", variant = "button" }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [fabOn, setFabOn] = useState(isScanFabEnabled);
  useEffect(() => {
    // reage ao interruptor de Configurações sem recarregar
    const sync = () => setFabOn(isScanFabEnabled());
    window.addEventListener("scan-fab-change", sync);
    return () => window.removeEventListener("scan-fab-change", sync);
  }, []);
  if (!isNativeApp()) return null;
  if (variant === "fab" && !fabOn) return null;

  const run = async () => {
    if (busy) return;
    setBusy(true);
    const result = await scanBarcodeWithCamera();
    setBusy(false);
    if (!result) return;
    if ("error" in result) { toast.warning(result.error); return; }
    onScan(result.code);
  };

  if (variant === "fab") {
    return (
      <button
        type="button"
        onClick={run}
        disabled={busy}
        aria-label="Escanear código de barras com a câmera"
        className={`flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/70 text-white shadow backdrop-blur active:scale-95 disabled:opacity-50 ${className}`}
      >
        <ScanLine size={18} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      aria-label="Escanear código de barras com a câmera"
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white active:bg-blue-700 disabled:opacity-60 ${className}`}
    >
      <ScanLine size={16} />
      {label}
    </button>
  );
}

/** Cartão de Configurações: liga/desliga o botão flutuante do PDV. Só aparece no app do celular. */
export function CameraScannerPreference() {
  const [on, setOn] = useState(isScanFabEnabled);
  if (!isNativeApp()) return null;
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-slate-900">Botão de scanner no PDV</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
          Mostra uma bolinha discreta no PDV para escanear código de barras com a câmera. Os botões “Escanear” de Etiquetas, Catálogo e Markup continuam disponíveis.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Botão de scanner no PDV"
        onClick={() => { const next = !on; setOn(next); setScanFabEnabled(next); }}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-blue-600" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
