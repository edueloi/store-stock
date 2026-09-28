import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, waitForPath } from "./tour-utils";

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

// ── Canal de comunicação tour → tela ────────────────────────────────────────
//
// O tour precisa navegar de verdade para dentro de Catálogo e Categorias e
// interagir com os modais reais de "Novo Produto" / "Nova Categoria" (abrir,
// preencher campos de exemplo, fechar) sem nunca disparar o salvamento real.
// Em vez de expor as funções internas desses componentes (refs/imperative
// handles), usamos CustomEvents no window: o tour dispara, e um useEffect em
// Inventory.tsx / Categories.tsx escuta e chama só as funções seguras
// (abrir/preencher/fechar) — nunca handleSave nem submit de formulário. Esses
// nomes de evento são o contrato entre este arquivo e os dois componentes.
const TOUR_EVENTS = {
  openNewProduct: "onboarding-tour:open-new-product",
  fillProduct: "onboarding-tour:fill-product",
  closeProductModal: "onboarding-tour:close-product-modal",
  openNewCategory: "onboarding-tour:open-new-category",
  fillCategory: "onboarding-tour:fill-category",
  closeCategoryModal: "onboarding-tour:close-category-modal",
} as const;

// dispatchTourEvent / visibleTourElement / tourElement / waitForElement /
// waitForPath agora vivem em ./tour-utils (compartilhados com os tours de
// página) — comportamento idêntico ao que havia aqui antes, só movido.

// ── Steps ────────────────────────────────────────────────────────────────
//
// `navigate` (react-router) é injetado via prop pelo AdminDashboard e
// referenciado através de um ref (buildSteps recebe a função atual) porque a
// lista de steps do driver.js é montada uma vez por `start()`.
function buildSteps(navigate: (path: string) => void): DriveStep[] {
  // Avança o driver manualmente depois de um passo assíncrono (navegação +
  // espera de elemento). skipMissingElement/skip aqui significa "não travar o
  // tour": se algo não aparecer a tempo, seguimos para o próximo passo em vez
  // de deixar o usuário preso num popover sem resposta.
  const goAfter = (driverObj: Driver, work: () => Promise<unknown>) => {
    work()
      .catch(() => { /* elemento/rota não apareceu a tempo — segue o tour mesmo assim */ })
      .finally(() => driverObj.moveNext());
  };
  const goBack = (driverObj: Driver, work: () => Promise<unknown>) => {
    work()
      .catch(() => { /* idem, ao voltar */ })
      .finally(() => driverObj.movePrevious());
  };
  const openExampleProduct = () => {
    dispatchTourEvent(TOUR_EVENTS.openNewProduct, { name: "Produto Exemplo" });
    return waitForElement('[data-tour="product-name-field"]').then(() => {
      dispatchTourEvent(TOUR_EVENTS.fillProduct, { price: 29.9, stock_quantity: 10 });
    });
  };
  const openExampleCategory = () => {
    dispatchTourEvent(TOUR_EVENTS.openNewCategory);
    return waitForElement('[data-tour="category-name-field"]').then(() => {
      dispatchTourEvent(TOUR_EVENTS.fillCategory, { name: "Categoria Exemplo" });
    });
  };

  return [
    {
      popover: {
        title: "Bem-vindo ao Store BoxSys!",
        description: "Vamos te mostrar o essencial em poucos passos — inclusive como cadastrar um produto e uma categoria, na prática.",
      },
    },
    {
      element: tourElement("sidebar"),
      popover: {
        title: "Menu principal",
        description: "Aqui ficam todas as áreas do sistema: vendas, estoque, financeiro, clientes e configurações. Vamos entrar em algumas telas de verdade agora.",
        side: "right",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          navigate("/admin/catalog");
          goAfter(opts.driver, () => waitForElement('[data-tour="inventory-page"]'));
        },
      },
    },
    {
      element: tourElement("inventory-page"),
      popover: {
        title: "Catálogo",
        description: "É aqui que você cadastra e organiza seus produtos — nome, preço, fotos e estoque. Vamos abrir o cadastro de um produto novo para você ver como funciona (nada será salvo).",
        side: "top",
        align: "start",
        onNextClick: (_el, _step, opts) => goAfter(opts.driver, openExampleProduct),
        // "Voltar" aqui volta o próprio menu (passo anterior não navega para
        // nenhuma outra tela), então basta retroceder o driver normalmente.
        onPrevClick: (_el, _step, opts) => opts.driver.movePrevious(),
      },
    },
    {
      element: tourElement("product-name-field"),
      popover: {
        title: "Nome do produto",
        description: "Preenchemos com \"Produto Exemplo\" só para ilustrar. Nada é salvo até você clicar em \"Cadastrar Produto\".",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("product-price-field"),
      onHighlightStarted: () => {
        dispatchTourEvent(TOUR_EVENTS.fillProduct, { price: 29.9 });
      },
      popover: {
        title: "Preço de Venda",
        description: "O preço de venda ao consumidor. Aqui preenchemos R$ 29,90 como exemplo.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("product-stock-field"),
      onHighlightStarted: () => {
        dispatchTourEvent(TOUR_EVENTS.fillProduct, { stock_quantity: 10 });
      },
      popover: {
        title: "Estoque Atual",
        description: "A quantidade disponível para venda. Aqui preenchemos 10 unidades como exemplo.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("product-gallery"),
      popover: {
        title: "Fotos do produto",
        description: "Aqui você adiciona as fotos do produto, arrastando arquivos ou tirando uma foto pelo celular. Vamos fechar este exemplo sem salvar e seguir para Categorias.",
        side: "right",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(TOUR_EVENTS.closeProductModal);
          navigate("/admin/categories");
          goAfter(opts.driver, () => waitForElement('[data-tour="categories-page"]'));
        },
      },
    },
    {
      element: tourElement("categories-new-btn"),
      popover: {
        title: "Categorias",
        description: "Organizar os produtos em categorias antes ajuda a deixar o catálogo online mais fácil de navegar. Vamos ver o cadastro de uma categoria também (sem salvar nada).",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(TOUR_EVENTS.openNewCategory);
          goAfter(opts.driver, async () => {
            await waitForElement('[data-tour="category-name-field"]');
            dispatchTourEvent(TOUR_EVENTS.fillCategory, { name: "Categoria Exemplo" });
          });
        },
        // Volta de Categorias para o Catálogo, reabrindo o produto de exemplo
        // no mesmo estado em que estava (nome/preço/estoque preenchidos).
        onPrevClick: (_el, _step, opts) => {
          navigate("/admin/catalog");
          goBack(opts.driver, () => waitForElement('[data-tour="inventory-page"]').then(openExampleProduct));
        },
      },
    },
    {
      element: tourElement("category-name-field"),
      popover: {
        title: "Nome da categoria",
        description: "Preenchemos com \"Categoria Exemplo\" só para ilustrar. Vamos fechar sem salvar e seguir para o PDV.",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(TOUR_EVENTS.closeCategoryModal);
          navigate("/admin/pdv");
          goAfter(opts.driver, () => waitForPath("/admin/pdv"));
        },
        onPrevClick: (_el, _step, opts) => opts.driver.movePrevious(),
      },
    },
    {
      popover: {
        title: "PDV — Caixa",
        description: "É aqui que você realiza as vendas no balcão, com atalhos pra agilizar o atendimento.",
        onNextClick: (_el, _step, opts) => {
          navigate("/admin/settings");
          goAfter(opts.driver, () => waitForPath("/admin/settings"));
        },
        // Volta do PDV para Categorias, reabrindo a categoria de exemplo.
        onPrevClick: (_el, _step, opts) => {
          navigate("/admin/categories");
          goBack(opts.driver, () => waitForElement('[data-tour="categories-page"]').then(openExampleCategory));
        },
      },
    },
    {
      popover: {
        title: "Configurações",
        description: "Personalize sua loja online: tema, cores e integração com WhatsApp.",
        onNextClick: (_el, _step, opts) => opts.driver.moveNext(),
        // Volta de Configurações para o PDV.
        onPrevClick: (_el, _step, opts) => {
          navigate("/admin/pdv");
          goBack(opts.driver, () => waitForPath("/admin/pdv"));
        },
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora explore o sistema. Você pode rever este tour a qualquer momento clicando em \"Tour guiado\".",
      },
    },
  ];
}

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
  /** navigate() do react-router (useNavigate), vindo do AdminDashboard — o tour
   * usa para navegar de verdade entre Catálogo, Categorias, PDV e Configurações. */
  navigate: (path: string) => void;
}

/**
 * Tour guiado (onboarding) do painel admin, usando driver.js.
 * Dispara automaticamente na primeira vez que o usuário loga (ver AdminDashboard),
 * e também pode ser reaberto manualmente pelo botão "Tour guiado".
 *
 * Além de destacar itens de menu, este tour navega de verdade para dentro de
 * Catálogo e Categorias e abre os modais reais de cadastro para ilustrar o
 * preenchimento — sempre fechando sem salvar (ver TOUR_EVENTS acima). Nenhum
 * passo do tour chama handleSave/submit desses componentes.
 */
const OnboardingTour = forwardRef<OnboardingTourHandle, OnboardingTourProps>(
  function OnboardingTour({ isSidebarOpen, setIsSidebarOpen, isMobile, navigate }, ref) {
    const driverRef = useRef<Driver | null>(null);
    // Guarda se a sidebar mobile já estava aberta antes do tour começar, pra
    // devolver o estado original ao terminar/sair (e não deixar o menu aberto
    // sem querer se o usuário já tinha fechado ele antes de iniciar o tour).
    const wasSidebarOpenBeforeTour = useRef(false);
    // Sempre acessível a partir dos closures dos steps (montados uma vez),
    // sem precisar recriar os steps a cada render.
    const navigateRef = useRef(navigate);
    navigateRef.current = navigate;

    const finishTour = (markAsSeen: boolean) => {
      // Fecha o menu mobile de volta se o tour foi quem abriu (não estava aberto antes).
      if (isMobile && !wasSidebarOpenBeforeTour.current) {
        setIsSidebarOpen(false);
      }
      // Segurança extra: garante que nenhum modal de exemplo fique aberto se o
      // usuário sair do tour no meio dos passos de Catálogo/Categorias.
      dispatchTourEvent(TOUR_EVENTS.closeProductModal);
      dispatchTourEvent(TOUR_EVENTS.closeCategoryModal);
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
          steps: buildSteps((path) => navigateRef.current(path)),
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
        // calcular as coordenadas do highlight. Isto é só uma animação CSS
        // conhecida (não um fetch), então um timeout curto fixo é apropriado
        // aqui — diferente da espera por navegação/carregamento de tela, que
        // usa waitForElement/waitForPath (polling) em vez de timeout cego.
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
