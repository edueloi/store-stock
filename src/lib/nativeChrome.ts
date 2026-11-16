import { useEffect } from "react";

// Cor dos ícones da barra de status do Android (hora, bateria...) dentro do app do celular.
// `dark = true`  → fundo escuro, ícones claros (login, menu lateral)
// `dark = false` → fundo claro, ícones escuros (telas do sistema)
// No navegador comum não faz nada.
type CapacitorGlobal = { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown>; registerPlugin?: (n: string) => unknown };
type SystemBarsPlugin = { setStyle: (o: { style: string }) => Promise<void> };

export function setStatusBarDark(dark: boolean) {
  try {
    const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    const bars = (cap.Plugins?.SystemBars ?? cap.registerPlugin?.("SystemBars")) as SystemBarsPlugin | undefined;
    void bars?.setStyle({ style: dark ? "DARK" : "LIGHT" }).catch(() => {});
  } catch { /* ignora */ }
}

/** Enquanto o componente estiver montado, usa o estilo informado; ao sair volta para o das telas claras. */
export function useStatusBarStyle(dark: boolean) {
  useEffect(() => {
    setStatusBarDark(dark);
    return () => setStatusBarDark(false);
  }, [dark]);
}
