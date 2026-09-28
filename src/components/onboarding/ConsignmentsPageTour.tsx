import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, cleanupDragCursor } from "./tour-utils";

// Canal de comunicação com Consignments.tsx — abre o modal "Nova Sacola" de
// verdade via setShowForm(true) e preenche o nome do cliente de exemplo via
// setForm, mas nunca chama handleCreate (POST real, que pode inclusive
// disparar um window.confirm nativo se o cliente já tiver sacola aberta).
// Fechar sempre via closeForm (setShowForm(false)), equivalente a clicar no
// X ou fora do modal, que já fazem isso na tela real. O modal de DETALHE de
// uma sacola real (com handleCancel/handleReopen/handleResolve/
// handleSaveEdit) nunca é aberto pelo tour — mesmo padrão do "ajuste de
// pontos" do LoyaltyPageTour: ação sensível, só indicada por spotlight, sem
// clicar em nenhuma linha da tabela.
const CONSIGNMENTS_PAGE_TOUR_EVENTS = {
  openNewBag: "page-tour:consignments:open-new-bag",
  fillBag: "page-tour:consignments:fill-bag",
  closeForm: "page-tour:consignments:close-form",
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
  const openExampleBag = () => {
    dispatchTourEvent(CONSIGNMENTS_PAGE_TOUR_EVENTS.openNewBag);
    return waitForElement('[data-tour="consignments-form-customer"]').then(() => {
      dispatchTourEvent(CONSIGNMENTS_PAGE_TOUR_EVENTS.fillBag, {
        customer_name: "Cliente Exemplo",
      });
    });
  };

  return [
    {
      popover: {
        title: "Conhecendo Consignação",
        description: "Este tour mostra como funciona a consignação de produtos. Nenhuma sacola será criada, resolvida, cancelada ou excluída de verdade.",
      },
    },
    {
      element: tourElement("consignments-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui você monta uma \"sacola\" de produtos e envia para o cliente avaliar em casa. Depois, ele decide o que fica (você fatura) e o que devolve.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("consignments-stat-cards"),
      popover: {
        title: "Resumo das sacolas",
        description: "\"Abertas\" são sacolas com o cliente. \"Vencendo Hoje\" e \"Em Atraso\" avisam sobre o prazo de devolução. \"Fechadas\" já foram resolvidas. \"Valor em Sacolas\" soma o total dos produtos ainda com clientes.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("consignments-status-tabs"),
      popover: {
        title: "Abas de status",
        description: "Filtre a lista por situação: Todas, Em Atraso, Vencendo Hoje, Parcial (algumas peças já decididas) ou pelos status Aberta, Fechada, Cancelada.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("consignments-new-btn"),
      popover: {
        title: "Montar uma nova sacola",
        description: "Esse botão abre o formulário para escolher o cliente, os produtos e o prazo de devolução. Vamos abrir para você ver como é (nada será salvo).",
        side: "bottom",
        align: "end",
        onNextClick: (_el, _step, opts) => goForward(opts.driver, openExampleBag),
      },
    },
    {
      element: tourElement("consignments-form-customer"),
      popover: {
        title: "Cliente",
        description: "Preenchemos \"Cliente Exemplo\" só para ilustrar. Você pode buscar um cliente já cadastrado ou digitar um nome novo diretamente aqui.",
        side: "bottom",
        align: "start",
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(CONSIGNMENTS_PAGE_TOUR_EVENTS.closeForm);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      element: tourElement("consignments-form-due-days"),
      popover: {
        title: "Prazo de devolução",
        description: "Quantos dias o cliente tem para decidir o que fica e o que devolve. Passado o prazo, a sacola aparece como \"Em Atraso\" na lista. Vamos fechar este exemplo sem salvar e seguir para a lista.",
        side: "top",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(CONSIGNMENTS_PAGE_TOUR_EVENTS.closeForm);
          opts.driver.moveNext();
        },
      },
    },
    {
      element: tourElement("consignments-table"),
      popover: {
        title: "Lista de sacolas",
        description: "Cada linha mostra número, cliente, quantidade de itens, status (badge colorido), prazo e valor. Clicar numa linha abre o detalhe da sacola, com opções de resolver, cancelar ou reabrir — não vamos abrir nenhuma aqui no tour, pois são ações reais e sensíveis.",
        side: "top",
        align: "start",
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe como funciona a consignação. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface ConsignmentsPageTourHandle {
  start: () => void;
}

/**
 * Tour de página de Consignação (driver.js). Spotlight + popover explicando
 * os stat cards, abas de status e a tabela. Abre o modal "Nova Sacola" de
 * verdade (setShowForm(true)), preenche o nome do cliente de exemplo, sempre
 * fechando via setShowForm(false). Nunca chama handleCreate (POST real, pode
 * disparar window.confirm), handleCancel, handleReopen, handleResolve ou
 * handleSaveEdit — todas do modal de DETALHE de uma sacola real, que este
 * tour nunca abre. Nenhum passo clica numa linha da tabela. Disparado sob
 * demanda pelo botão "?" — sem persistência de "já viu".
 */
const ConsignmentsPageTour = forwardRef<ConsignmentsPageTourHandle>(function ConsignmentsPageTour(_props, ref) {
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
          dispatchTourEvent(CONSIGNMENTS_PAGE_TOUR_EVENTS.closeForm);
          cleanupDragCursor();
          d.destroy();
        },
      });
      driverRef.current = d;
      d.drive();
    };

    waitForElement('[data-tour="consignments-page"]')
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

export default ConsignmentsPageTour;
export { CONSIGNMENTS_PAGE_TOUR_EVENTS };
