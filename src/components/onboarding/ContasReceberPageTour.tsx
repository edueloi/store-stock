import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, simulateClick, cleanupDragCursor } from "./tour-utils";

// Namespace PRÓPRIO (page-tour:contas-receber:*). Além de trocar a aba ativa
// (Administrativo/Crediário), abre o modal "Nova Conta" de verdade e
// preenche campos de exemplo — nunca chama handleSave/handleReceive/
// handleDelete. Fechar sempre via closeModal (equivalente a clicar fora do
// modal ou no X, que já fazem isso na tela real).
export const CONTAS_RECEBER_PAGE_TOUR_EVENTS = {
  goToAdminTab: "page-tour:contas-receber:go-admin-tab",
  goToCrediarioTab: "page-tour:contas-receber:go-crediario-tab",
  openNewAccount: "page-tour:contas-receber:open-new-account",
  fillAccount: "page-tour:contas-receber:fill-account",
  closeModal: "page-tour:contas-receber:close-modal",
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
  const openExampleAccount = () => {
    dispatchTourEvent(CONTAS_RECEBER_PAGE_TOUR_EVENTS.openNewAccount);
    return waitForElement('[data-tour="contas-receber-form-description"]').then(() => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 10);
      dispatchTourEvent(CONTAS_RECEBER_PAGE_TOUR_EVENTS.fillAccount, {
        description: "Recebimento Exemplo",
        amount: "150.00",
        due_date: dueDate.toISOString().slice(0, 10),
      });
    });
  };

  return [
    {
      popover: {
        title: "Conhecendo Contas a Receber",
        description: "Este tour mostra como controlar os recebimentos da sua loja, tanto lançamentos manuais quanto vendas fiado. Nenhuma conta será criada, recebida ou excluída de verdade.",
      },
    },
    {
      element: tourElement("contas-receber-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui você acompanha tudo que a loja tem a receber: de clientes, prestação de serviço ou qualquer outro recebimento, com vencimento e status de cada um.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("contas-receber-tabs"),
      popover: {
        title: "Administrativo e Crediário",
        description: "\"Administrativo\" é para lançamentos manuais que você cadastra diretamente aqui. \"Crediário\" mostra as parcelas de vendas feitas fiado lá no PDV, geradas automaticamente pelo sistema de venda a prazo.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("contas-receber-summary-cards"),
      popover: {
        title: "Resumo dos recebimentos",
        description: "\"A Receber\" soma o que ainda está pendente e no prazo. \"Vencendo em Breve\" avisa o que vence nos próximos dias. \"Vencidas\" é o que passou do prazo sem recebimento. \"Recebido\" soma tudo que já entrou.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("contas-receber-status-filters"),
      popover: {
        title: "Filtrar por status",
        description: "Filtre a lista por situação: Pendentes, Vencidos, Recebidos ou Cancelados. \"Todos\" mostra tudo junto.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("contas-receber-period-nav"),
      popover: {
        title: "Navegar por período",
        description: "\"Tudo\" mostra todas as contas sem recorte de data. \"Mês\" e \"Ano\" filtram pelo vencimento, com setas para navegar entre os períodos.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("contas-receber-new-btn"),
      popover: {
        title: "Cadastrar uma nova conta",
        description: "Esse botão (só visível na aba Administrativo) abre o formulário para lançar uma nova conta a receber, com opção de parcelamento ou recorrência. Vamos abrir para você ver como é (nada será salvo).",
        side: "bottom",
        align: "end",
        onNextClick: (_el, _step, opts) => goForward(opts.driver, openExampleAccount),
      },
    },
    {
      element: tourElement("contas-receber-form-description"),
      popover: {
        title: "Descrição",
        description: "Preenchemos com \"Recebimento Exemplo\" só para ilustrar. É aqui que você identifica o recebimento, por exemplo \"Venda para cliente tal\" ou \"Serviço prestado\".",
        side: "bottom",
        align: "start",
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(CONTAS_RECEBER_PAGE_TOUR_EVENTS.closeModal);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      element: tourElement("contas-receber-form-amount-due"),
      popover: {
        title: "Valor e vencimento",
        description: "O valor total a receber e a data em que vence. Preenchemos R$ 150,00 com vencimento daqui a 10 dias, só como exemplo. Vamos fechar este exemplo sem salvar e seguir para a lista.",
        side: "top",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(CONTAS_RECEBER_PAGE_TOUR_EVENTS.closeModal);
          opts.driver.moveNext();
        },
      },
    },
    {
      element: tourElement("contas-receber-table"),
      popover: {
        title: "Lista de contas",
        description: "Cada linha mostra a descrição, cliente, vencimento e status com badge colorido: pendente (âmbar), vencido (vermelho), recebido (verde) ou cancelado (cinza). Parcelas e contas recorrentes têm um selo indicando isso.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("contas-receber-tabs"),
      onHighlightStarted: () => {
        simulateClick('[data-tour="contas-receber-crediario-tab-btn"]');
      },
      popover: {
        title: "Indo para o Crediário",
        description: "Vamos abrir a aba Crediário para você ver como ela funciona.",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(CONTAS_RECEBER_PAGE_TOUR_EVENTS.goToCrediarioTab);
          goForward(opts.driver, () => waitForElement('[data-tour="contas-receber-crediario-table"]', 2500));
        },
      },
    },
    {
      element: tourElement("contas-receber-crediario-table"),
      popover: {
        title: "Parcelas de crediário",
        description: "Lista todas as parcelas de vendas fiado em aberto, com o cliente, valor restante e se está vencida. Clicar numa linha leva ao cadastro daquele cliente, na aba de crediário dele (não vamos navegar de verdade aqui no tour).",
        side: "top",
        align: "start",
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(CONTAS_RECEBER_PAGE_TOUR_EVENTS.goToAdminTab);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe controlar suas contas a receber e o crediário. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface ContasReceberPageTourHandle {
  start: () => void;
}

/**
 * Tour de página de Contas a Receber (driver.js). Spotlight + popover
 * explicando as abas, cards de resumo, filtros e tabela. O botão "Nova Conta"
 * é só indicado com o cursor fantasma (simulateClick) — nunca abre o modal
 * real (openCreate) nem chama handleSave/handleReceive/handleDelete/
 * handleBulkReceive/handleBulkDelete/handleApplyInterest/handleImportFile.
 * Troca apenas a aba ativa (mainTab) via setMainTab, o mesmo que clicar nas
 * abas faria — nunca navega de verdade para o cadastro de cliente. Disparado
 * sob demanda pelo botão "?" — sem persistência de "já viu".
 */
const ContasReceberPageTour = forwardRef<ContasReceberPageTourHandle>(function ContasReceberPageTour(_props, ref) {
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
          // Segurança extra: garante que a tela volta pra aba Administrativo
          // e que o modal de exemplo não fica aberto se o usuário sair do
          // tour no meio dos passos.
          dispatchTourEvent(CONTAS_RECEBER_PAGE_TOUR_EVENTS.goToAdminTab);
          dispatchTourEvent(CONTAS_RECEBER_PAGE_TOUR_EVENTS.closeModal);
          cleanupDragCursor();
          d.destroy();
        },
      });
      driverRef.current = d;
      d.drive();
    };

    // Carregamento assíncrono (fetchItems + fetchCustomersList + fetch tenant
    // em paralelo) — espera o container da página estar de fato no DOM antes
    // de iniciar o drive.
    waitForElement('[data-tour="contas-receber-page"]')
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

export default ContasReceberPageTour;
