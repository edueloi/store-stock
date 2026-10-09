import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, simulateClick, cleanupDragCursor } from "./tour-utils";

// Canal de comunicação com Loyalty.tsx — troca de aba e, só na aba
// Recompensas, abre o drawer "Nova Recompensa" de verdade (openCreateReward)
// e preenche campos de exemplo, sempre fechando via setShowRewardForm(false).
// Nunca chama handleSaveSettings, handleSaveReward, deleteReward
// (window.confirm), toggleReward ou handleAdjustPoints — a aba Settings e o
// ajuste manual de pontos são tratados só como spotlight explicativo, sem
// preencher ou abrir nada.
const LOYALTY_PAGE_TOUR_EVENTS = {
  goOverviewTab: "page-tour:loyalty:go-overview-tab",
  goPointsTab: "page-tour:loyalty:go-points-tab",
  goRewardsTab: "page-tour:loyalty:go-rewards-tab",
  goSettingsTab: "page-tour:loyalty:go-settings-tab",
  openNewReward: "page-tour:loyalty:open-new-reward",
  fillReward: "page-tour:loyalty:fill-reward",
  closeRewardForm: "page-tour:loyalty:close-reward-form",
  forceCloseAdjust: "page-tour:loyalty:force-close-adjust",
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
  const goToRewardsAndOpenForm = () => {
    dispatchTourEvent(LOYALTY_PAGE_TOUR_EVENTS.goRewardsTab);
    dispatchTourEvent(LOYALTY_PAGE_TOUR_EVENTS.openNewReward);
    return waitForElement('[data-tour="loyalty-reward-form-name"]').then(() => {
      dispatchTourEvent(LOYALTY_PAGE_TOUR_EVENTS.fillReward, {
        name: "Recompensa Exemplo",
        points: "100",
      });
    });
  };

  return [
    {
      popover: {
        title: "Conhecendo Fidelidade",
        description: "Este tour mostra o programa de pontos e recompensas da sua loja. Nada será criado, alterado ou excluído de verdade — e nenhum ajuste de pontos real será feito em nenhum cliente.",
      },
    },
    {
      element: tourElement("loyalty-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui você configura um programa de pontos: clientes ganham pontos a cada compra e podem trocá-los por descontos ou brindes que você define.",
        side: "top",
        align: "start",
      },
    },
    {
      popover: {
        title: "4 abas",
        description: "\"Visão Geral\" resume os números do programa. \"Pontos\" mostra o saldo de cada cliente. \"Recompensas\" é onde você cadastra o que pode ser trocado. \"Configurações\" define a regra de pontuação.",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(LOYALTY_PAGE_TOUR_EVENTS.goOverviewTab);
          opts.driver.moveNext();
        },
      },
    },
    {
      popover: {
        title: "Cards de resumo",
        description: "Clientes com Pontos, Pontos Emitidos, Resgates e Recompensas Ativas — a visão geral do programa. Logo abaixo, a \"Regra de Pontuação\" mostra quanto o cliente precisa gastar para ganhar 1 ponto.",
      },
    },
    {
      popover: {
        title: "Aba Pontos",
        description: "Aqui você vê o saldo de pontos de cada cliente, os aniversariantes do mês (destacados para ações de fidelização) e pode consultar o histórico de cada um. Pontos são gerados automaticamente ao finalizar uma venda no PDV com cliente identificado.",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(LOYALTY_PAGE_TOUR_EVENTS.goPointsTab);
          opts.driver.moveNext();
        },
      },
    },
    {
      element: tourElement("loyalty-adjust-points-btn"),
      onHighlightStarted: () => {
        simulateClick('[data-tour="loyalty-adjust-points-btn"]');
      },
      popover: {
        title: "Ajuste manual de pontos",
        description: "Esse botão (+) abre um pequeno formulário para adicionar ou remover pontos manualmente de um cliente, útil para bônus ou correções. É uma ação sensível — não vamos abri-lo de verdade aqui no tour, só indicar onde fica.",
        side: "bottom",
        align: "start",
      },
    },
    {
      popover: {
        title: "Cadastrar uma recompensa",
        description: "Na aba \"Recompensas\"você define o que o cliente pode resgatar com os pontos: desconto (fixo ou percentual) ou um brinde do estoque. Vamos abrir o formulário e preencher um exemplo (nada será salvo).",
        onNextClick: (_el, _step, opts) => goForward(opts.driver, goToRewardsAndOpenForm),
      },
    },
    {
      element: tourElement("loyalty-reward-form-name"),
      popover: {
        title: "Nome e custo em pontos",
        description: "Preenchemos com \"Recompensa Exemplo\"e 100 pontos só para ilustrar. Acima você escolhe o tipo: Desconto ou Brinde. Vamos fechar este exemplo sem salvar.",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(LOYALTY_PAGE_TOUR_EVENTS.closeRewardForm);
          dispatchTourEvent(LOYALTY_PAGE_TOUR_EVENTS.goSettingsTab);
          opts.driver.moveNext();
        },
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(LOYALTY_PAGE_TOUR_EVENTS.closeRewardForm);
          goBack(opts.driver, goToRewardsAndOpenForm);
        },
      },
    },
    {
      element: tourElement("loyalty-settings-card"),
      popover: {
        title: "Configurações do programa",
        description: "Aqui você define o nome do programa, a cada quantos reais gastos o cliente ganha 1 ponto, a validade dos pontos e uma temporada opcional. Esses campos afetam o programa de verdade assim que salvos, então não vamos preenchê-los aqui — apenas mostrar onde ficam.",
        side: "top",
        align: "start",
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(LOYALTY_PAGE_TOUR_EVENTS.goRewardsTab);
          goBack(opts.driver, goToRewardsAndOpenForm);
        },
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já conhece o programa de fidelidade: visão geral, pontos, recompensas e configurações. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface LoyaltyPageTourHandle {
  start: () => void;
}

/**
 * Tour de página de Fidelidade (driver.js). Spotlight + popover explicando as
 * 4 abas (Overview, Points, Rewards, Settings). Na aba Recompensas, abre o
 * drawer "Nova Recompensa" de verdade (openCreateReward), preenche nome/
 * pontos de exemplo, sempre fechando via setShowRewardForm(false). Na aba
 * Pontos, o botão de ajuste manual é só indicado com o cursor fantasma
 * (simulateClick), nunca aberto de verdade — ação irreversível fora do
 * escopo deste tour. Na aba Configurações, os campos são apenas citados via
 * spotlight, nunca preenchidos. Nunca chama handleSaveSettings,
 * handleSaveReward, deleteReward (window.confirm), toggleReward ou
 * handleAdjustPoints em nenhum caminho. Disparado sob demanda pelo botão "?"
 * — sem persistência de "já viu".
 */
const LoyaltyPageTour = forwardRef<LoyaltyPageTourHandle>(function LoyaltyPageTour(_props, ref) {
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
          // Segurança extra: garante que o drawer de exemplo não fica aberto
          // e que nenhum formulário de ajuste de pontos ficou aberto, mesmo
          // que este tour nunca os abra de verdade — defesa em profundidade
          // barata caso o usuário saia do tour no meio dos passos.
          dispatchTourEvent(LOYALTY_PAGE_TOUR_EVENTS.closeRewardForm);
          dispatchTourEvent(LOYALTY_PAGE_TOUR_EVENTS.forceCloseAdjust);
          cleanupDragCursor();
          d.destroy();
        },
      });
      driverRef.current = d;
      d.drive();
    };

    // A tela mostra um spinner dedicado enquanto carrega (fetchAll: program +
    // summary + products em paralelo) — o container com data-tour só existe
    // no DOM depois do loading, então esperamos ativamente por ele.
    waitForElement('[data-tour="loyalty-page"]')
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

export default LoyaltyPageTour;
export { LOYALTY_PAGE_TOUR_EVENTS };
