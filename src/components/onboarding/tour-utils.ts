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

// ── Animação de "arrastar arquivo" (cursor fantasma) ────────────────────────
//
// Para ilustrar Importar PDF/XML sem soltar um arquivo de verdade no input,
// desenhamos um cursor de mouse + chip de arquivo que se move do canto da
// tela até a dropzone alvo, com a dropzone reagindo visualmente (mesma
// classe de destaque que ela já usa no hover real, se existir — senão um
// anel azul genérico). Puramente decorativo: nenhum File/DataTransfer real é
// criado, então não há como isso disparar o parser real do modal.
let dragCursorEl: HTMLDivElement | null = null;

function ensureDragCursorStyles() {
  if (document.getElementById("bx-tour-drag-style")) return;
  const style = document.createElement("style");
  style.id = "bx-tour-drag-style";
  style.textContent = `
    .bx-tour-drag-cursor {
      /* Acima do popover do driver.js (z-index: 1000000000) para nunca ficar
         escondido atrás dele, qualquer que seja a posição do popover. */
      position: fixed; z-index: 1000000001; pointer-events: none;
      display: flex; align-items: center; gap: 6px;
      transition: left 900ms cubic-bezier(0.65, 0, 0.35, 1), top 900ms cubic-bezier(0.65, 0, 0.35, 1), opacity 250ms ease;
      opacity: 0;
    }
    .bx-tour-drag-cursor .bx-tour-drag-chip {
      background: #0b1327; color: #fff; font: 700 11px/1 system-ui, sans-serif;
      padding: 6px 10px; border-radius: 8px; box-shadow: 0 6px 18px rgba(11,19,39,0.35);
      white-space: nowrap;
    }
    .bx-tour-drag-cursor svg { filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35)); }
    .bx-tour-drop-target-active {
      outline: 2px dashed #297ed1 !important;
      outline-offset: 2px;
      background-color: rgba(41, 126, 209, 0.06) !important;
      transition: background-color 200ms ease;
    }
    .bx-tour-click-pulse {
      position: fixed; z-index: 1000000001; pointer-events: none;
      width: 34px; height: 34px; margin-left: -17px; margin-top: -17px;
      border-radius: 50%; border: 2px solid #297ed1; opacity: 0;
    }
    .bx-tour-click-pulse.bx-tour-click-pulse-go {
      animation: bx-tour-pulse 550ms ease-out;
    }
    @keyframes bx-tour-pulse {
      0% { transform: scale(0.4); opacity: 0.9; }
      100% { transform: scale(1.4); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

const CURSOR_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="#0b1327" stroke="#fff" stroke-width="1"><path d="M4 2l14 8-6 1.5L9 18z"/></svg>`;

/**
 * Anima um cursor fantasma "arrastando" um chip com o nome do arquivo desde
 * o canto inferior direito da tela até o centro do elemento alvo (a
 * dropzone), marca o alvo como "ativo" (mesmo efeito visual de um dragover
 * real) e depois desfaz tudo. Resolve depois que a animação termina.
 */
export function simulateFileDrag(targetSelector: string, fileName: string): Promise<void> {
  return new Promise((resolve) => {
    ensureDragCursorStyles();
    const target = visibleTourElement(targetSelector) as HTMLElement | undefined;
    if (!target) { resolve(); return; }

    const rect = target.getBoundingClientRect();
    const endX = rect.left + rect.width / 2;
    const endY = rect.top + rect.height / 2;
    const startX = window.innerWidth - 60;
    const startY = window.innerHeight - 60;

    const cursor = document.createElement("div");
    cursor.className = "bx-tour-drag-cursor";
    cursor.style.left = `${startX}px`;
    cursor.style.top = `${startY}px`;
    cursor.innerHTML = `${CURSOR_SVG}<span class="bx-tour-drag-chip">${fileName}</span>`;
    document.body.appendChild(cursor);
    dragCursorEl = cursor;

    // Força um reflow antes de mudar left/top+opacity para a transição CSS animar.
    void cursor.offsetWidth;
    cursor.style.opacity = "1";

    window.setTimeout(() => {
      cursor.style.left = `${endX}px`;
      cursor.style.top = `${endY}px`;
      target.classList.add("bx-tour-drop-target-active");
    }, 60);

    window.setTimeout(() => {
      target.classList.remove("bx-tour-drop-target-active");
      cursor.style.opacity = "0";
      window.setTimeout(() => {
        cursor.remove();
        if (dragCursorEl === cursor) dragCursorEl = null;
        resolve();
      }, 260);
    }, 1100);
  });
}

/** Remove qualquer cursor fantasma que tenha ficado preso na tela (ex: usuário
 * fechou o tour no meio da animação). Chame ao destruir/sair do tour. */
export function cleanupDragCursor() {
  dragCursorEl?.remove();
  dragCursorEl = null;
  document.querySelectorAll(".bx-tour-drop-target-active").forEach((el) => el.classList.remove("bx-tour-drop-target-active"));
  document.querySelectorAll(".bx-tour-click-pulse").forEach((el) => el.remove());
}

/**
 * Variante mais simples de simulateFileDrag: move um cursor fantasma (sem
 * chip de arquivo) do canto da tela até o centro do elemento alvo e faz um
 * "pulso" de clique ali, para indicar visualmente onde o usuário clicaria.
 * Puramente decorativo — não dispara nenhum evento de clique real no alvo.
 */
export function simulateClick(targetSelector: string): Promise<void> {
  return new Promise((resolve) => {
    ensureDragCursorStyles();
    const target = visibleTourElement(targetSelector) as HTMLElement | undefined;
    if (!target) { resolve(); return; }

    const rect = target.getBoundingClientRect();
    const endX = rect.left + rect.width / 2;
    const endY = rect.top + rect.height / 2;
    const startX = window.innerWidth - 60;
    const startY = window.innerHeight - 60;

    const cursor = document.createElement("div");
    cursor.className = "bx-tour-drag-cursor";
    cursor.style.left = `${startX}px`;
    cursor.style.top = `${startY}px`;
    cursor.innerHTML = CURSOR_SVG;
    document.body.appendChild(cursor);
    dragCursorEl = cursor;

    void cursor.offsetWidth;
    cursor.style.opacity = "1";

    window.setTimeout(() => {
      cursor.style.left = `${endX}px`;
      cursor.style.top = `${endY}px`;
    }, 60);

    window.setTimeout(() => {
      const pulse = document.createElement("div");
      pulse.className = "bx-tour-click-pulse bx-tour-click-pulse-go";
      pulse.style.left = `${endX}px`;
      pulse.style.top = `${endY}px`;
      document.body.appendChild(pulse);
      window.setTimeout(() => pulse.remove(), 600);
    }, 1000);

    window.setTimeout(() => {
      cursor.style.opacity = "0";
      window.setTimeout(() => {
        cursor.remove();
        if (dragCursorEl === cursor) dragCursorEl = null;
        resolve();
      }, 260);
    }, 1500);
  });
}
