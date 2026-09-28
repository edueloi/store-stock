import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, simulateClick, cleanupDragCursor } from "./tour-utils";

// Canal de comunicação com Finance.tsx — abre o modal "Novo Lançamento" de
// verdade (openModal("income")) e preenche campos de exemplo, mas nunca chama
// handleSave (POST real), handleEditSave (PUT real), handleDeleteOne,
// handleDeleteBulk ou executeDelete (DELETE reais). Fechar sempre via
// closeModal, equivalente a clicar em Cancelar, que já faz isso na tela real.
const FINANCE_PAGE_TOUR_EVENTS = {
  openNewEntry: "page-tour:finance:open-new-entry",
  fillEntry: "page-tour:finance:fill-entry",
  closeModal: "page-tour:finance:close-modal",
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
  const openExampleEntry = () => {
    dispatchTourEvent(FINANCE_PAGE_TOUR_EVENTS.openNewEntry);
    return waitForElement('[data-tour="finance-form-description"]').then(() => {
      dispatchTourEvent(FINANCE_PAGE_TOUR_EVENTS.fillEntry, {
        description: "Lançamento Exemplo",
        amount: 150,
      });
    });
  };

  return [
    {
      popover: {
        title: "Conhecendo o Fluxo de Caixa",
        description: "Este tour mostra como controlar as entradas, saídas e retiradas da sua loja. Nenhum lançamento será criado, editado ou excluído de verdade.",
      },
    },
    {
      element: tourElement("finance-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui você registra manualmente tudo que entra e sai do caixa da loja: receitas, despesas e retiradas de sócios. Vendas do PDV entram aqui automaticamente.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("finance-summary-cards"),
      popover: {
        title: "Resumo do período",
        description: "\"Total Entradas\" e \"Total Saídas\" somam receitas e despesas do período em navegação. \"Retiradas\" mostra o que foi sacado. \"Saldo Acumulado\" é o total desde o início da loja, independente do período filtrado.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("finance-filters-toggle"),
      popover: {
        title: "Filtros",
        description: "Busque por descrição ou filtre por origem (venda PDV, serviço) e forma de pagamento (crédito, débito, PIX, dinheiro, boleto).",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("finance-period-nav"),
      popover: {
        title: "Navegar por período",
        description: "Alterne entre visão \"Mês\" e \"Ano\", navegue com as setas, ou use \"Período Livre\" para escolher datas específicas.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("finance-new-entry-actions"),
      popover: {
        title: "Lançar um novo movimento",
        description: "Três botões, um só modal: Receita (verde), Despesa (vermelho) e Retirada (âmbar). Vamos abrir o de Receita para você ver como é (nada será salvo).",
        side: "bottom",
        align: "end",
        onNextClick: (_el, _step, opts) => goForward(opts.driver, openExampleEntry),
      },
    },
    {
      element: tourElement("finance-form-description"),
      popover: {
        title: "Descrição e valor",
        description: "Preenchemos \"Lançamento Exemplo\" e R$ 150,00 só para ilustrar. É aqui que você identifica o lançamento e informa o valor.",
        side: "bottom",
        align: "start",
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(FINANCE_PAGE_TOUR_EVENTS.closeModal);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      element: tourElement("finance-form-type-toggle"),
      popover: {
        title: "Os 3 tipos de lançamento",
        description: "Receita soma ao caixa, Despesa subtrai, e Retirada registra dinheiro sacado por sócios ou para uso pessoal — todas afetam o saldo acumulado. Vamos fechar este exemplo sem salvar e seguir para a lista.",
        side: "top",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(FINANCE_PAGE_TOUR_EVENTS.closeModal);
          opts.driver.moveNext();
        },
      },
    },
    {
      element: tourElement("finance-table"),
      popover: {
        title: "Histórico de movimentações",
        description: "Cada linha mostra descrição, data, categoria e os valores (bruto, desconto, taxa e líquido quando aplicável). Vendas do PDV trazem o detalhamento automático de taxas de cartão.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("finance-export-btn"),
      onHighlightStarted: () => {
        simulateClick('[data-tour="finance-export-btn"]');
      },
      popover: {
        title: "Exportar",
        description: "Esse botão exporta a lista filtrada em Excel ou PDF. Não vamos clicar de verdade aqui no tour.",
        side: "bottom",
        align: "end",
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe controlar seu fluxo de caixa. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface FinancePageTourHandle {
  start: () => void;
}

/**
 * Tour de página de Fluxo de Caixa (driver.js). Spotlight + popover
 * explicando os cards de resumo, filtros, navegador de período, tabela e
 * exportação. Abre o modal "Novo Lançamento" de verdade (openModal) e
 * preenche campos de exemplo, sempre fechando via closeModal — nunca chama
 * handleSave/handleEditSave/handleDeleteOne/handleDeleteBulk/executeDelete.
 * O botão Exportar é só indicado com o cursor fantasma (simulateClick), sem
 * gerar arquivo de verdade. Disparado sob demanda pelo botão "?" — sem
 * persistência de "já viu".
 */
const FinancePageTour = forwardRef<FinancePageTourHandle>(function FinancePageTour(_props, ref) {
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
          dispatchTourEvent(FINANCE_PAGE_TOUR_EVENTS.closeModal);
          cleanupDragCursor();
          d.destroy();
        },
      });
      driverRef.current = d;
      d.drive();
    };

    waitForElement('[data-tour="finance-page"]')
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

export default FinancePageTour;
export { FINANCE_PAGE_TOUR_EVENTS };
