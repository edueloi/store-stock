// Depois de um deploy, uma aba que já estava aberta ainda aponta para arquivos da versão anterior. O servidor guarda esses
// arquivos por um tempo (.asset-archive), mas, se mesmo assim algum falhar, o certo é recarregar para pegar a versão nova
// em vez de mostrar uma tela de erro ao cliente.

const KEY = "stale-chunk-reload-at";
const MIN_GAP_MS = 30_000; // no máximo uma recarga automática a cada 30 s (evita laço se o problema for outro)

export function isStaleChunkError(error: unknown): boolean {
  const msg = String((error as { message?: unknown } | null)?.message ?? error ?? "");
  return /dynamically imported module|Importing a module script failed|Loading chunk|Loading CSS chunk|Unable to preload CSS|error loading dynamically/i.test(msg);
}

/** Recarrega a página para pegar a versão nova. Devolve false se já recarregou há pouco (aí mostre a mensagem de erro). */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < MIN_GAP_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
