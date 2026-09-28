import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, simulateClick, cleanupDragCursor } from "./tour-utils";

// Canal de comunicação com ContasPagar.tsx — abre o modal "Nova Conta" de
// verdade e preenche campos de exemplo, mas nunca chama handleSave (POST
// real). Fechar sempre via closeModal, equivalente a clicar fora do modal
// ou no X, que já fazem isso na tela real.
const CONTAS_PAGAR_PAGE_TOUR_EVENTS = {
  openNewAccount: "page-tour:contas-pagar:open-new-account",
  fillAccount: "page-tour:contas-pagar:fill-account",
  closeModal: "page-tour:contas-pagar:close-modal",
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
    dispatchTourEvent(CONTAS_PAGAR_PAGE_TOUR_EVENTS.openNewAccount);
    return waitForElement('[data-tour="contas-pagar-form-description"]').then(() => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 10);
      dispatchTourEvent(CONTAS_PAGAR_PAGE_TOUR_EVENTS.fillAccount, {
        description: "Conta Exemplo",
        amount: "150.00",
        due_date: dueDate.toISOString().slice(0, 10),
      });
    });
  };

  return [
    {
      popover: {
        title: "Conhecendo Contas a Pagar",
        description: "Este tour mostra como controlar os pagamentos e vencimentos da sua loja. Nenhuma conta será criada, paga ou excluída de verdade.",
      },
    },
    {
      element: tourElement("contas-pagar-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui você cadastra e acompanha tudo que a loja precisa pagar: fornecedores, aluguel, contas fixas e variáveis, com vencimento e status de cada uma.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("contas-pagar-summary-cards"),
      popover: {
        title: "Resumo das contas",
        description: "\"A Pagar\" soma o que ainda está pendente e no prazo. \"Vencendo em Breve\" avisa o que vence nos próximos dias. \"Vencidas\" é o que passou do prazo sem pagamento. \"Pago\" soma tudo que já foi quitado.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("contas-pagar-status-filters"),
      popover: {
        title: "Filtrar por status",
        description: "Filtre a lista por situação: Pendentes, Vencidos, Pagos ou Cancelados. \"Todos\" mostra tudo junto.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("contas-pagar-cost-type-filter"),
      popover: {
        title: "Fixo ou Variável",
        description: "Classifica cada conta como custo Fixo (mesmo valor todo mês, como aluguel) ou Variável (muda conforme o consumo, como água e energia). Esse filtro ajuda a separar os dois tipos na lista.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("contas-pagar-period-nav"),
      popover: {
        title: "Navegar por período",
        description: "\"Tudo\" mostra todas as contas sem recorte de data. \"Mês\" e \"Ano\" filtram pelo vencimento, com setas para navegar entre os períodos.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("contas-pagar-new-btn"),
      popover: {
        title: "Cadastrar uma nova conta",
        description: "Esse botão abre o formulário para lançar uma nova conta a pagar, com opção de parcelamento ou recorrência. Vamos abrir para você ver como é (nada será salvo).",
        side: "bottom",
        align: "end",
        onNextClick: (_el, _step, opts) => goForward(opts.driver, openExampleAccount),
      },
    },
    {
      element: tourElement("contas-pagar-form-description"),
      popover: {
        title: "Descrição",
        description: "Preenchemos com \"Conta Exemplo\" só para ilustrar. É aqui que você identifica a conta, por exemplo \"Aluguel\" ou \"Fornecedor tal\".",
        side: "bottom",
        align: "start",
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(CONTAS_PAGAR_PAGE_TOUR_EVENTS.closeModal);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      element: tourElement("contas-pagar-form-amount-due"),
      popover: {
        title: "Valor e vencimento",
        description: "O valor total da conta e a data em que ela vence. Preenchemos R$ 150,00 com vencimento daqui a 10 dias, só como exemplo. Vamos fechar este exemplo sem salvar e seguir para a lista.",
        side: "top",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(CONTAS_PAGAR_PAGE_TOUR_EVENTS.closeModal);
          opts.driver.moveNext();
        },
      },
    },
    {
      element: tourElement("contas-pagar-table"),
      popover: {
        title: "Lista de contas",
        description: "Cada linha mostra a descrição, fornecedor, vencimento e status com badge colorido: pendente (âmbar), vencido (vermelho), pago (verde) ou cancelado (cinza). Parcelas e contas recorrentes têm um selo indicando isso.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("contas-pagar-export-btn"),
      onHighlightStarted: () => {
        simulateClick('[data-tour="contas-pagar-export-btn"]');
      },
      popover: {
        title: "Exportar",
        description: "Esse botão exporta a lista filtrada em Excel (com gráfico comparando custo Fixo x Variável) ou em PDF para impressão. Não vamos clicar de verdade aqui no tour.",
        side: "bottom",
        align: "end",
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe controlar suas contas a pagar. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface ContasPagarPageTourHandle {
  start: () => void;
}

/**
 * Tour de página de Contas a Pagar (driver.js). Spotlight + popover
 * explicando os cards de resumo, filtros, navegador de período, tabela e
 * exportação. Abre o modal "Nova Conta" de verdade (openCreate) e preenche
 * campos de exemplo, sempre fechando via closeModal — nunca chama
 * handleSave/handlePay/handleDelete/handleBulkPay/handleBulkDelete/
 * handleApplyInterest/handleImportFile. O botão Exportar é só indicado com
 * o cursor fantasma (simulateClick), sem gerar arquivo de verdade.
 * Disparado sob demanda pelo botão "?" — sem persistência de "já viu".
 */
const ContasPagarPageTour = forwardRef<ContasPagarPageTourHandle>(function ContasPagarPageTour(_props, ref) {
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
          // Segurança extra: garante que o modal de exemplo não fica aberto
          // se o usuário sair do tour no meio dos passos.
          dispatchTourEvent(CONTAS_PAGAR_PAGE_TOUR_EVENTS.closeModal);
          cleanupDragCursor();
          d.destroy();
        },
      });
      driverRef.current = d;
      d.drive();
    };

    // Carregamento assíncrono (fetchItems + fetchSuppliers + fetch tenant em
    // paralelo) — espera o container da página estar de fato no DOM antes de
    // iniciar o drive.
    waitForElement('[data-tour="contas-pagar-page"]')
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

export default ContasPagarPageTour;
