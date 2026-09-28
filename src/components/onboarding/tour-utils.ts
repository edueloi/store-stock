// ── Helpers compartilhados entre todos os tours guiados (driver.js) ────────
//
// Extraído de OnboardingTour.tsx para reuso pelos tours de página
// (InventoryPageTour, CategoriesPageTour, StockPageTour) sem duplicar a
// lógica de resolução de elemento / espera ativa / disparo de eventos.
// Comportamento idêntico ao que já existia — apenas movido de arquivo.

/** Dispara um CustomEvent no window, usado como canal de comunicação entre um
 * tour e a tela real que ele está guiando (abrir/preencher/fechar modais de
 * verdade sem nunca acionar o salvamento real). */
export function dispatchTourEvent<T>(name: string, detail?: T) {
  window.dispatchEvent(new CustomEvent(name, detail === undefined ? undefined : { detail }));
}

// ── Resolução de elemento ───────────────────────────────────────────────
//
// A sidebar (e, em telas responsivas, outros elementos) pode existir DUAS
// vezes no DOM ao mesmo tempo: uma versão desktop e uma versão mobile, com o
// mesmo data-tour. document.querySelector pegaria sempre a primeira
// ocorrência, que pode estar invisível na tela atual. Por isso resolvemos
// manualmente pegando o primeiro elemento que está de fato visível
// (offsetParent !== null cobre display:none e ancestrais escondidos).
export function visibleTourElement(selector: string): Element | undefined {
  const candidates = document.querySelectorAll<HTMLElement>(selector);
  for (const el of candidates) {
    if (el.offsetParent !== null) return el;
  }
  return candidates[0] ?? undefined;
}

export const tourElement = (dataTourValue: string) => () => visibleTourElement(`[data-tour="${dataTourValue}"]`);

// ── Espera ativa por elementos/navegação (sem timeout fixo cego) ───────────
//
// Navegar para outra rota (navigate()) e abrir um modal são operações
// assíncronas — a tela alvo só termina de carregar depois de fetches em
// paralelo. Em vez de um timeout fixo (frágil: rápido demais falha, devagar
// demais irrita), fazemos polling curto até o elemento aparecer visível, com
// um teto de segurança para não travar o tour indefinidamente se algo não
// aparecer.
export function waitForElement(selector: string, timeoutMs = 6000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const el = visibleTourElement(selector);
      if (el) { resolve(el); return; }
      if (Date.now() - start >= timeoutMs) { reject(new Error(`onboarding-tour: elemento "${selector}" não apareceu a tempo`)); return; }
      window.setTimeout(tick, 100);
    };
    tick();
  });
}

// Mesma ideia, para telas onde optamos por não depender de um seletor
// específico no DOM — esperamos apenas a rota trocar de fato antes de seguir.
export function waitForPath(path: string, timeoutMs = 6000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (window.location.pathname === path) { resolve(); return; }
      if (Date.now() - start >= timeoutMs) { reject(new Error(`onboarding-tour: rota "${path}" não foi alcançada a tempo`)); return; }
      window.setTimeout(tick, 100);
    };
    tick();
  });
}
