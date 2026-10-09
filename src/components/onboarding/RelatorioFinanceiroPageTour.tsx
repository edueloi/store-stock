import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, simulateClick, cleanupDragCursor } from "./tour-utils";

// Tela 100% leitura/relatório — o único "estado real" que o tour precisa
// trocar é a visão ativa (Dia/Mês/Resumo Anual), pra poder mostrar os
// elementos de cada uma. Namespace PRÓPRIO (page-tour:relatorio-financeiro:*).
export const RELATORIO_FINANCEIRO_PAGE_TOUR_EVENTS = {
  goToMonthView: "page-tour:relatorio-financeiro:go-month-view",
} as const;

function buildSteps(): DriveStep[] {
  const goForward = (driverObj: Driver, work: () => Promise<unknown>) => {
    work()
      .catch(() => { /* elemento não apareceu a tempo — segue o tour mesmo assim */ })
      .finally(() => driverObj.moveNext());
  };

  return [
    {
      popover: {
        title: "Conhecendo o Relatório Financeiro",
        description: "Este tour mostra como ler suas entradas, custo fixo e custo variável, por dia, por mês ou no resumo do ano inteiro.",
      },
    },
    {
      element: tourElement("relatorio-financeiro-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui você vê tudo que entrou (vendas) e tudo que saiu (custos fixos e variáveis) da sua loja, com o resultado líquido de cada período. É o raio-X financeiro do negócio.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("relatorio-year-nav"),
      popover: {
        title: "Navegador de ano",
        description: "Use as setas para trocar o ano do relatório. Todas as visões (Dia, Mês, Resumo Anual) usam esse mesmo ano selecionado.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("relatorio-view-toggle"),
      popover: {
        title: "Dia, Mês ou Resumo Anual",
        description: "\"Dia\" mostra o movimento de uma data específica. \"Mês\" (padrão) soma o mês inteiro. \"Resumo Anual\" compara os 12 meses lado a lado, com o total do ano.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("relatorio-origem-filtro"),
      popover: {
        title: "Filtro de origem",
        description: "\"Tudo\" soma vendas de produto e de serviço juntas. \"Catálogo\" mostra só as vendas de produtos do estoque. \"Serviço\" mostra só as ordens de serviço. Esse filtro se aplica a qualquer visão ativa.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("relatorio-view-toggle"),
      onHighlightStarted: () => {
        simulateClick('[data-tour="relatorio-month-view-btn"]');
      },
      popover: {
        title: "Vamos ver a visão Mês",
        description: "A visão Mês é a que mais detalha o dia a dia financeiro. Vamos trocar para ela.",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(RELATORIO_FINANCEIRO_PAGE_TOUR_EVENTS.goToMonthView);
          goForward(opts.driver, () => waitForElement('[data-tour="relatorio-summary-cards"]', 2500));
        },
      },
    },
    {
      element: tourElement("relatorio-summary-cards"),
      popover: {
        title: "Entradas, Custos e Resultado",
        description: "\"Entradas\" é tudo que a loja faturou no mês. \"Custos\" soma o custo fixo (aluguel, salários) e variável (mercadoria, comissão). \"Resultado\"é a diferença entre os dois: o que sobrou (ou faltou) no mês.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("relatorio-entradas-table"),
      popover: {
        title: "Entradas por operador",
        description: "Mostra quanto cada operador/vendedor recebeu, separado por forma de pagamento (dinheiro, PIX, débito, crédito), com o total geral na última linha.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("relatorio-custo-cards"),
      popover: {
        title: "Custo Fixo e Custo Variável",
        description: "\"Custo Variável\" muda conforme as vendas (mercadoria, comissão). \"Custo Fixo\" é o mesmo todo mês (aluguel, salários, assinaturas). Cada card lista os lançamentos que compõem aquele total.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("relatorio-export-btn"),
      onHighlightStarted: () => {
        // Indica visualmente onde clicar — cursor fantasma, sem gerar
        // nenhum arquivo nem imprimir nada de verdade.
        simulateClick('[data-tour="relatorio-export-btn"]');
      },
      popover: {
        title: "Exportar",
        description: "Esse botão, no topo da página, exporta em Excel ou PDF exatamente o que a tela está mostrando: se você estiver na visão Dia, exporta o dia; na visão Mês, o mês; no Resumo Anual, o ano inteiro. Não vamos clicar de verdade aqui no tour.",
        side: "bottom",
        align: "end",
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe ler o relatório financeiro em qualquer período. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface RelatorioFinanceiroPageTourHandle {
  start: () => void;
}

/**
 * Tour de página do Relatório Financeiro (driver.js). Tela 100%
 * leitura/relatório — troca apenas a visão ativa (Dia/Mês/Resumo Anual) via
 * setView("month"), o mesmo que clicar no botão "Mês" faria. Nunca chama
 * exportToExcel/exportToPDF (que geram arquivo de verdade) nem
 * printDayReport (que dispara impressão térmica/window.print real) — o botão
 * Exportar é só indicado com o cursor fantasma. Disparado sob demanda pelo
 * botão "?" — sem persistência de "já viu".
 */
const RelatorioFinanceiroPageTour = forwardRef<RelatorioFinanceiroPageTourHandle>(function RelatorioFinanceiroPageTour(_props, ref) {
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
          cleanupDragCursor();
          d.destroy();
        },
      });
      driverRef.current = d;
      d.drive();
    };

    // Carregamento assíncrono (fetch do relatório do ano) — espera o
    // container da página estar de fato no DOM antes de iniciar o drive.
    waitForElement('[data-tour="relatorio-financeiro-page"]')
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

export default RelatorioFinanceiroPageTour;
