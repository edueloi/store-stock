import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, simulateClick, cleanupDragCursor } from "./tour-utils";

// Tela 100% leitura — não existe nenhum modal de criação aqui, só as duas
// abas (Sessões/Relatório). O único "estado real" que o tour precisa trocar é
// justamente qual aba está ativa, pra poder mostrar os elementos da aba
// Relatório também. Namespace PRÓPRIO (page-tour:cash-history:*).
export const CASH_HISTORY_PAGE_TOUR_EVENTS = {
  goToSessionsTab: "page-tour:cash-history:go-sessions-tab",
  goToReportTab: "page-tour:cash-history:go-report-tab",
} as const;

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
        title: "Conhecendo o Histórico de Caixa",
        description: "Este tour mostra como consultar todas as aberturas e fechamentos de caixa já feitos, e como ler o relatório de vendas por período.",
      },
    },
    {
      element: tourElement("cash-history-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui fica o histórico completo de sessões de caixa: quem abriu, quem fechou, o valor contado e a diferença apurada em cada uma. É a tela para conferir o caixa de qualquer dia passado.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("cash-history-tabs"),
      popover: {
        title: "Sessões e Relatório",
        description: "\"Sessões\" lista cada abertura/fechamento de caixa individualmente. \"Relatório\" soma as vendas de um período inteiro, com gráficos e balanço por forma de pagamento.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("cash-history-kpis"),
      popover: {
        title: "Indicadores rápidos",
        description: "Total de sessões, quantas estão abertas agora, quantas já foram fechadas e quantas fecharam com diferença (sobra ou falta) no caixa.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("cash-history-table"),
      popover: {
        title: "Lista de sessões",
        description: "Cada linha é uma sessão de caixa. \"Aberto\" (azul) significa que o caixa ainda está em uso; \"Fechado\" (verde) já foi encerrado. A coluna Diferença mostra em verde quando sobrou dinheiro e em vermelho quando faltou. Clicar numa linha abre o detalhe completo daquela sessão (não vamos abrir agora, só mostrando onde fica).",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("cash-history-tabs"),
      onHighlightStarted: () => {
        simulateClick('[data-tour="cash-history-report-tab-btn"]');
      },
      popover: {
        title: "Indo para o Relatório",
        description: "Vamos abrir a aba Relatório para você ver o que tem lá.",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(CASH_HISTORY_PAGE_TOUR_EVENTS.goToReportTab);
          goForward(opts.driver, () => waitForElement('[data-tour="cash-history-report-period"]', 2500));
        },
      },
    },
    {
      element: tourElement("cash-history-report-period"),
      popover: {
        title: "Período do relatório",
        description: "Navegue por Mês ou Ano, ou escolha \"Período Livre\" para um intervalo customizado. O relatório inteiro (cards, gráficos e tabela) se ajusta automaticamente ao período escolhido.",
        side: "bottom",
        align: "start",
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(CASH_HISTORY_PAGE_TOUR_EVENTS.goToSessionsTab);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      element: tourElement("cash-history-report-cards"),
      popover: {
        title: "Total por forma de pagamento",
        description: "Cada card soma quanto entrou naquele período por forma de pagamento (dinheiro, PIX, débito, crédito), já descontando o troco dado nas vendas em dinheiro.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("cash-history-report-pie"),
      popover: {
        title: "Gráfico por forma de pagamento",
        description: "Visão proporcional das mesmas informações dos cards: qual forma de pagamento representa a maior fatia das vendas do período.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("cash-history-export-btn"),
      onHighlightStarted: () => {
        // Indica visualmente onde clicar — cursor fantasma, sem gerar
        // nenhum arquivo nem abrir o modal de exportação de verdade.
        simulateClick('[data-tour="cash-history-export-btn"]');
      },
      popover: {
        title: "Exportar",
        description: "Esse botão, no topo da página, abre um modal para escolher o período e baixar o relatório em Excel ou PDF. Não vamos clicar de verdade aqui no tour.",
        side: "bottom",
        align: "end",
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe consultar sessões de caixa e ler o relatório por período. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface CashHistoryPageTourHandle {
  start: () => void;
}

/**
 * Tour de página do Histórico de Caixa (driver.js). Tela 100% leitura — troca
 * apenas a aba ativa (Sessões/Relatório) via setMainTab, o mesmo que clicar
 * nas abas faria. Nunca chama openDetail (que busca o detalhe de uma sessão)
 * nem qualquer função de impressão térmica (printSessionReceipt) ou export
 * real (exportSessionsToExcel/exportSessionsToPDF) — o botão Exportar é só
 * indicado com o cursor fantasma. Disparado sob demanda pelo botão "?" — sem
 * persistência de "já viu".
 */
const CashHistoryPageTour = forwardRef<CashHistoryPageTourHandle>(function CashHistoryPageTour(_props, ref) {
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
          // Segurança extra: garante que a tela volta pra aba Sessões se o
          // usuário sair do tour no meio dos passos.
          dispatchTourEvent(CASH_HISTORY_PAGE_TOUR_EVENTS.goToSessionsTab);
          cleanupDragCursor();
          d.destroy();
        },
      });
      driverRef.current = d;
      d.drive();
    };

    // Carregamento assíncrono (fetch de sessões) — espera o container da
    // página estar de fato no DOM antes de iniciar o drive.
    waitForElement('[data-tour="cash-history-page"]')
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

export default CashHistoryPageTour;
