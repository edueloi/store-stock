import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, simulateClick, cleanupDragCursor } from "./tour-utils";

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
        description: "Este tour mostra como controlar o estoque dos seus produtos e como ajustar uma quantidade manualmente. Nada será aplicado de verdade.",
      },
    },
    {
      element: tourElement("stock-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui você acompanha o estoque de todos os produtos: quantas unidades tem de cada um, quais estão perto de vencer e o histórico de tudo que já entrou ou saiu.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("stock-view-inventory-btn"),
      popover: {
        title: "Posição e Auditoria",
        description: "\"Posição\" mostra a quantidade que você tem agora de cada produto. \"Auditoria\"mostra o histórico completo: toda compra, venda, perda ou ajuste que já aconteceu.",
        side: "bottom",
        align: "start",
      },
    },
    {
      popover: {
        title: "Filtros rápidos",
        description: "Os botões \"Todos\", \"Esgotado\", \"Baixo estoque\" e \"Vencimento\" filtram a lista na hora, para você ver rapidamente só os produtos que precisam de atenção.",
      },
    },
    {
      element: tourElement("stock-adjust-btn"),
      onHighlightStarted: () => {
        // Indica visualmente onde clicar para abrir o ajuste — cursor
        // fantasma, não dispara nenhum clique real no botão.
        simulateClick('[data-tour="stock-adjust-btn"]');
      },
      popover: {
        title: "Ajustar o estoque de um produto",
        description: "Clicando neste botão, você corrige manualmente a quantidade de um produto (por exemplo, depois de uma contagem física). Vamos abrir para você ver como funciona, sem aplicar nada de verdade.",
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
        description: "Escolha o motivo do ajuste: Compra (entrada de mercadoria), Ajuste (correção de contagem), Perda ou Devolução. Isso fica registrado no histórico de auditoria, para você sempre saber o porquê de cada mudança.",
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
        description: "Use os botões + e − para dizer quantas unidades entraram ou saíram. Nada é aplicado de verdade até você clicar em \"Aplicar\". Vamos fechar este exemplo sem aplicar.",
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
        description: "Agora você já sabe consultar e ajustar o estoque. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
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
          cleanupDragCursor();
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
      cleanupDragCursor();
    };
  }, []);

  return null;
});

export default StockPageTour;
