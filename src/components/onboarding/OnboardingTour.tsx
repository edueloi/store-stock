import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";

// ── API helpers (mesmo padrão de src/views/Dashboard/Home.tsx) ─────────────

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const jsonHeaders = () => ({ ...headers(), "Content-Type": "application/json" });

function handle403() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
}

async function getPref<T>(key: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(`/api/preferences/${key}`, { headers: headers() });
    if (r.status === 401 || r.status === 403) { handle403(); return fallback; }
    const d = await r.json();
    return d ?? fallback;
  } catch { return fallback; }
}

async function setPref(key: string, value: unknown) {
  try {
    await fetch(`/api/preferences/${key}`, {
      method: "PUT", headers: jsonHeaders(),
      body: JSON.stringify({ value }),
    });
  } catch { /* silencioso — não bloqueia a experiência do tour por causa disso */ }
}

export const ONBOARDING_TOUR_PREF_KEY = "has_seen_onboarding_tour";

// ── Resolução de elemento ───────────────────────────────────────────────
//
// A sidebar existe DUAS vezes no DOM ao mesmo tempo: a <aside> desktop (que
// fica com "display:none" em telas <lg via classe Tailwind, mas continua
// montada) e o drawer mobile (montado só quando aberto). Como os itens de
// menu têm o mesmo data-tour nos dois, document.querySelector pegaria sempre
// a primeira ocorrência (a desktop), que fica invisível no mobile. Por isso
// resolvemos manualmente pegando o primeiro elemento que está de fato visível
// (offsetParent !== null cobre display:none e ancestrais escondidos).
function visibleTourElement(selector: string): Element | undefined {
  const candidates = document.querySelectorAll<HTMLElement>(selector);
  for (const el of candidates) {
    if (el.offsetParent !== null) return el;
  }
  return candidates[0] ?? undefined;
}

const tourElement = (dataTourValue: string) => () => visibleTourElement(`[data-tour="${dataTourValue}"]`);

// ── Steps ────────────────────────────────────────────────────────────────

const steps: DriveStep[] = [
  {
    popover: {
      title: "Bem-vindo ao Store BoxSys!",
      description: "Vamos te mostrar o essencial em poucos passos.",
    },
  },
  {
    element: tourElement("sidebar"),
    popover: {
      title: "Menu principal",
      description: "Aqui ficam todas as áreas do sistema: vendas, estoque, financeiro, clientes e configurações.",
      side: "right",
      align: "start",
    },
  },
  {
    element: tourElement("menu-catalog"),
    popover: {
      title: "Catálogo",
      description: "É aqui que você cadastra seus produtos — nome, preço, fotos e estoque inicial.",
      side: "right",
      align: "start",
    },
  },
  {
    element: tourElement("menu-categories"),
    popover: {
      title: "Categorias",
      description: "Organizar os produtos em categorias antes ajuda a deixar o catálogo online mais fácil de navegar.",
      side: "right",
      align: "start",
    },
  },
  {
    element: tourElement("menu-pdv"),
    popover: {
      title: "PDV — Caixa",
      description: "É aqui que você realiza as vendas no balcão, com atalhos pra agilizar o atendimento.",
      side: "right",
      align: "start",
    },
  },
  {
    element: tourElement("menu-settings"),
    popover: {
      title: "Configurações",
      description: "Personalize sua loja online: tema, cores e integração com WhatsApp.",
      side: "right",
      align: "start",
    },
  },
  {
    popover: {
      title: "Pronto!",
      description: "Agora explore o sistema. Você pode rever este tour a qualquer momento clicando em \"Tour guiado\".",
    },
  },
];

export interface OnboardingTourHandle {
  /** Inicia o tour manualmente (ex: clique no botão "Tour guiado"). */
  start: () => void;
}

interface OnboardingTourProps {
  /** Se a sidebar/menu mobile está aberta no momento. */
  isSidebarOpen: boolean;
  /** Abre/fecha a sidebar/menu mobile (mesmo setter usado no AdminDashboard). */
  setIsSidebarOpen: (open: boolean) => void;
  /** true em telas <= 1024px, onde a sidebar é um drawer que começa fechado. */
  isMobile: boolean;
}

/**
 * Tour guiado (onboarding) do painel admin, usando driver.js.
 * Dispara automaticamente na primeira vez que o usuário loga (ver AdminDashboard),
 * e também pode ser reaberto manualmente pelo botão "Tour guiado".
 */
const OnboardingTour = forwardRef<OnboardingTourHandle, OnboardingTourProps>(
  function OnboardingTour({ isSidebarOpen, setIsSidebarOpen, isMobile }, ref) {
    const driverRef = useRef<Driver | null>(null);
    // Guarda se a sidebar mobile já estava aberta antes do tour começar, pra
    // devolver o estado original ao terminar/sair (e não deixar o menu aberto
    // sem querer se o usuário já tinha fechado ele antes de iniciar o tour).
    const wasSidebarOpenBeforeTour = useRef(false);

    const finishTour = (markAsSeen: boolean) => {
      // Fecha o menu mobile de volta se o tour foi quem abriu (não estava aberto antes).
      if (isMobile && !wasSidebarOpenBeforeTour.current) {
        setIsSidebarOpen(false);
      }
      if (markAsSeen) {
        setPref(ONBOARDING_TOUR_PREF_KEY, true);
      }
    };

    const start = () => {
      wasSidebarOpenBeforeTour.current = isSidebarOpen;

      const beginDrive = () => {
        const d = driver({
          showProgress: true,
          allowClose: true,
          skipMissingElement: true,
          overlayColor: "#0b1327",
          overlayOpacity: 0.6,
          stagePadding: 6,
          stageRadius: 8,
          popoverClass: "bx-onboarding-popover",
          showButtons: ["next", "previous", "close"],
          nextBtnText: "Próximo",
          prevBtnText: "Voltar",
          doneBtnText: "Concluir",
          progressText: "{{current}} de {{total}}",
          steps,
          // onDestroyStarted cobre TODOS os jeitos de sair do tour — clicar no "x"
          // (botão close), clicar fora do popover, apertar ESC, ou concluir o
          // último passo — então é o único lugar que precisamos tratar como
          // "visto" e devolver a sidebar mobile ao estado original.
          //
          // Importante: quando onDestroyStarted está configurado, o driver.js
          // NÃO destrói sozinho — ele chama este hook e para, esperando que a
          // gente chame d.destroy() de volta pra confirmar e seguir com a
          // destruição de verdade (é um gate, não um evento "fire and forget").
          // Por isso o d.destroy() abaixo é necessário e não causa loop: a
          // segunda chamada já não passa mais pelo gate (comportamento
          // verificado no bundle da lib).
          onDestroyStarted: () => {
            finishTour(true);
            d.destroy();
          },
        });
        driverRef.current = d;
        d.drive();
      };

      if (isMobile && !isSidebarOpen) {
        // No mobile a sidebar começa fechada — precisa abrir antes de destacar
        // os itens dela, senão o spotlight aponta pra um elemento invisível.
        setIsSidebarOpen(true);
        // Pequeno delay para a animação do drawer (motion/react) terminar e os
        // itens do menu existirem no DOM com a posição final antes do driver.js
        // calcular as coordenadas do highlight.
        window.setTimeout(beginDrive, 350);
      } else {
        beginDrive();
      }
    };

    useImperativeHandle(ref, () => ({ start }));

    // Limpeza: se o componente desmontar com o tour ativo (ex: navegação brusca),
    // garante que o overlay do driver.js não fique "preso" na tela.
    useEffect(() => {
      return () => {
        driverRef.current?.destroy();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
  }
);

export default OnboardingTour;

/**
 * Verifica a preferência do usuário e dispara o tour automaticamente se ele
 * ainda não viu. Deve ser chamado a partir de um useEffect no AdminDashboard,
 * passando a função `start` do ref do OnboardingTour.
 */
export async function maybeAutoStartTour(start: () => void) {
  const seen = await getPref<boolean>(ONBOARDING_TOUR_PREF_KEY, false);
  if (seen) return;
  // Pequeno delay para a UI do painel renderizar completamente antes do
  // spotlight calcular as posições dos elementos.
  window.setTimeout(start, 700);
}
