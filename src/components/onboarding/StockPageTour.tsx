import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement } from "./tour-utils";

// ── Canal de comunicação tour de página → tela ──────────────────────────────
//
// Namespace PRÓPRIO (page-tour:stock:*) — Stock.tsx não tinha nenhum canal de
// tour antes; este é o primeiro e único, então não há colisão a evitar aqui,
// mas mantemos o mesmo padrão de nomenclatura dos outros dois tours de página.
export const STOCK_PAGE_TOUR_EVENTS = {
  openAdjustment: "page-tour:stock:open-adjustment",
  closeAdjustment: "page-tour:stock:close-adjustment",
} as const;

// Cada passo que muda o "estado da tela" (abrir/fechar o modal de ajuste)
// sabe como desfazer isso ao voltar, via onPrevClick — "Voltar" sempre
// funciona de verdade, sem precisar desabilitá-lo nesses pontos.
function buildSteps(): DriveStep[] {
  const goForward = (driverObj: Driver, work: () => Promise<unknown>) => {
    work()
      .catch(() => { /* elemento não apareceu a tempo — segue o tour mesmo assim */ })
      .finally(() => driverObj.moveNext());
  };
  const goBack = (driverObj: Driver, work: () => Promise<unknown>) => {
    work()
      .catch(() => { /* idem, ao voltar */ })
      .finally(() => driverObj.movePrevious());
  };

  return [
    {
      popover: {
        title: "Conhecendo o Estoque",
        description: "Vamos conhecer a tela de Estoque em detalhes.",
      },
    },
    {
      element: tourElement("stock-page"),
      popover: {
        title: "Controle de estoque",
        description: "Aqui você controla o estoque de todos os produtos: saldo atual, validade e histórico de movimentações.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("stock-view-inventory-btn"),
      popover: {
        title: "Posição x Auditoria",
        description: "\"Posição\" mostra o saldo atual de cada produto. \"Auditoria\" mostra o histórico de todas as movimentações (compras, ajustes, vendas, devoluções).",
        side: "bottom",
        align: "start",
      },
    },
    {
      popover: {
        title: "Filtros rápidos",
        description: "Use os chips \"Todos\", \"Esgotado\", \"Baixo estoque\" e \"Vencimento\" para focar rapidamente nos produtos que precisam de atenção.",
      },
    },
    {
      element: tourElement("stock-adjust-btn"),
      popover: {
        title: "Ajustar estoque",
        description: "Vamos abrir o ajuste de estoque de um produto para você ver como funciona (nada será aplicado de verdade).",
        side: "left",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(STOCK_PAGE_TOUR_EVENTS.openAdjustment);
          goForward(opts.driver, () => waitForElement('[data-tour="stock-adjustment-type"]', 2500));
        },
      },
    },
    {
      element: tourElement("stock-adjustment-type"),
      popover: {
        title: "Tipo de operação",
        description: "Escolha se o ajuste é uma Compra, Ajuste, Perda ou Devolução — isso fica registrado no histórico de auditoria.",
        side: "top",
        align: "start",
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(STOCK_PAGE_TOUR_EVENTS.closeAdjustment);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      element: tourElement("stock-adjustment-quantity"),
      popover: {
        title: "Quantidade",
        description: "Use os botões + e − para definir a variação de estoque. Serve para corrigir divergências de inventário — nada é aplicado até clicar em \"Aplicar\". Vamos fechar sem aplicar.",
        side: "top",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(STOCK_PAGE_TOUR_EVENTS.closeAdjustment);
          opts.driver.moveNext();
        },
        onPrevClick: (_el, _step, opts) => {
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já conhece os principais recursos do Estoque. Você pode rever este tour a qualquer momento pelo botão de ajuda (?).",
      },
    },
  ];
}

export interface StockPageTourHandle {
  start: () => void;
}

/**
 * Tour de página do Estoque (driver.js). Mostra a diferença entre Posição e
 * Auditoria, os filtros e o modal de Ajuste de Estoque, sempre fechando sem
 * aplicar. Nunca chama handleAdjustment (POST real em
 * /api/products/stock-adjustment) — só abre via openAdjust e fecha via
 * setIsAdjustmentModalOpen(false), exatamente como o botão "Cancelar" do
 * modal. Disparado sob demanda pelo botão "?" — sem persistência de "já viu".
 */
const StockPageTour = forwardRef<StockPageTourHandle>(function StockPageTour(_props, ref) {
  const driverRef = useRef<Driver | null>(null);

  const start = () => {
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
        steps: buildSteps(),
        onDestroyStarted: () => {
          // Segurança extra: garante que o modal de ajuste não fique aberto
          // se o usuário sair do tour no meio dos passos.
          dispatchTourEvent(STOCK_PAGE_TOUR_EVENTS.closeAdjustment);
          d.destroy();
        },
      });
      driverRef.current = d;
      d.drive();
    };

    // Carregamento assíncrono (fetchData faz dois awaits sequenciais antes de
    // setLoading(false)) — espera o container da página estar de fato no DOM
    // antes de iniciar o drive, em vez de um timeout fixo.
    waitForElement('[data-tour="stock-page"]')
      .then(beginDrive)
      .catch(beginDrive);
  };

  useImperativeHandle(ref, () => ({ start }));

  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
    };
  }, []);

  return null;
});

export default StockPageTour;
