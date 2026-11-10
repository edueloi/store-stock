import { lazy, type ComponentType } from "react";

/**
 * React.lazy com uma segunda chance: depois de um deploy novo o arquivo antigo da tela some do servidor,
 * e quem estava com a aba aberta receberia erro. Nesse caso recarrega a página uma vez para pegar a versão nova.
 */
export function lazyRetry<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await load();
    } catch (err) {
      const key = "chunk-reload-at";
      let last = 0;
      try { last = Number(sessionStorage.getItem(key) || 0); } catch { /* sem storage */ }
      if (Date.now() - last > 30_000) {
        try { sessionStorage.setItem(key, String(Date.now())); } catch { /* sem storage */ }
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
