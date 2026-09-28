import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, cleanupDragCursor } from "./tour-utils";

// Canal de comunicação com Sellers.tsx — troca de aba, abre o modal "Novo
// Vendedor" e o drawer "Nova Meta" de verdade e preenche campos de exemplo,
// mas nunca chama handleSave/handleDelete/handleToggleActive (vendedor) nem
// handleSaveGoal/handleDeleteGoal (meta, que usa window.confirm — nunca
// referenciado por este tour). Fechar sempre via setShowModal(false) /
// closeGoalForm.
const SELLERS_PAGE_TOUR_EVENTS = {
  goRankingTab: "page-tour:sellers:go-ranking-tab",
  goCadastroTab: "page-tour:sellers:go-cadastro-tab",
  goMetasTab: "page-tour:sellers:go-metas-tab",
  openNewSeller: "page-tour:sellers:open-new-seller",
  fillSeller: "page-tour:sellers:fill-seller",
  closeSellerModal: "page-tour:sellers:close-seller-modal",
  openNewGoal: "page-tour:sellers:open-new-goal",
  fillGoal: "page-tour:sellers:fill-goal",
  closeGoalForm: "page-tour:sellers:close-goal-form",
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
  const goToCadastroAndOpenSeller = () => {
    dispatchTourEvent(SELLERS_PAGE_TOUR_EVENTS.goCadastroTab);
    dispatchTourEvent(SELLERS_PAGE_TOUR_EVENTS.openNewSeller);
    return waitForElement('[data-tour="seller-form-name"]').then(() => {
      dispatchTourEvent(SELLERS_PAGE_TOUR_EVENTS.fillSeller, {
        name: "Vendedor Exemplo",
        phone: "(11) 98888-0000",
        commission_rate: 5,
      });
    });
  };
  const goToMetasAndOpenGoal = () => {
    dispatchTourEvent(SELLERS_PAGE_TOUR_EVENTS.closeSellerModal);
    dispatchTourEvent(SELLERS_PAGE_TOUR_EVENTS.goMetasTab);
    dispatchTourEvent(SELLERS_PAGE_TOUR_EVENTS.openNewGoal);
    return waitForElement('[data-tour="seller-goal-form-title"]').then(() => {
      dispatchTourEvent(SELLERS_PAGE_TOUR_EVENTS.fillGoal, {
        title: "Meta Exemplo",
        target_value: "10000",
      });
    });
  };

  return [
    {
      popover: {
        title: "Conhecendo Vendedores",
        description: "Este tour mostra o ranking de vendas, o cadastro da equipe e as metas por vendedor ou loja. Nada será criado, alterado ou excluído de verdade.",
      },
    },
    {
      element: tourElement("sellers-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui você acompanha comissões e desempenho de cada vendedor, cadastra a equipe e define metas de vendas para acompanhar o progresso ao longo do mês.",
        side: "top",
        align: "start",
      },
    },
    {
      popover: {
        title: "3 abas",
        description: "\"Ranking & Comissões\" mostra quem mais vendeu e quanto cada um tem a receber. \"Metas\" acompanha objetivos de faturamento/vendas. \"Cadastro\" é onde você adiciona ou edita vendedores.",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(SELLERS_PAGE_TOUR_EVENTS.goRankingTab);
          opts.driver.moveNext();
        },
      },
    },
    {
      popover: {
        title: "Cards de resumo do ranking",
        description: "Vendedores Ativos, Vendas no Mês, Receita Total e Comissões a Pagar — tudo referente ao período selecionado (mês e ano) logo acima.",
      },
    },
    {
      popover: {
        title: "Por Receita ou % de Meta",
        description: "Alterne o ranking entre \"Por Receita\" (quem faturou mais) e \"% de Meta Batida\" (quem está mais perto de bater a própria meta), útil para reconhecer esforço além do volume de vendas.",
      },
    },
    {
      popover: {
        title: "Cadastrar um vendedor novo",
        description: "Na aba \"Cadastro\" você adiciona vendedores com nome, contato, comissão e vínculo opcional com um usuário do sistema. Vamos abrir o formulário e preencher um exemplo (nada será salvo).",
        onNextClick: (_el, _step, opts) => goForward(opts.driver, goToCadastroAndOpenSeller),
      },
    },
    {
      element: tourElement("seller-form-name"),
      popover: {
        title: "Nome, telefone e comissão",
        description: "Preenchemos com \"Vendedor Exemplo\", telefone e 5% de comissão só para ilustrar. A comissão é calculada sobre o total vendido por esse vendedor. Vamos fechar este exemplo sem salvar e ver como funciona a aba Metas.",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => goForward(opts.driver, goToMetasAndOpenGoal),
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(SELLERS_PAGE_TOUR_EVENTS.closeSellerModal);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      element: tourElement("seller-goal-form-title"),
      popover: {
        title: "Criar uma meta",
        description: "Preenchemos \"Meta Exemplo\" e um valor alvo de R$ 10.000,00 só para ilustrar. Uma meta pode ser de um vendedor específico ou da loja como um todo (\"Loja geral\"), com tipo (faturamento, vendas, etc.) e período configuráveis. Vamos fechar sem salvar.",
        side: "left",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(SELLERS_PAGE_TOUR_EVENTS.closeGoalForm);
          opts.driver.moveNext();
        },
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(SELLERS_PAGE_TOUR_EVENTS.closeGoalForm);
          goBack(opts.driver, goToCadastroAndOpenSeller);
        },
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já conhece o ranking, o cadastro de vendedores e as metas. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface SellersPageTourHandle {
  start: () => void;
}

/**
 * Tour de página de Vendedores (driver.js). Spotlight + popover explicando as
 * 3 abas (Ranking, Metas, Cadastro), o ranking por receita/meta, o cadastro
 * de vendedor (abre o modal de verdade via openNew, preenche nome/telefone/
 * comissão de exemplo, fecha via setShowModal(false)) e a criação de meta
 * (abre o drawer de verdade via openNewGoal, preenche título/valor de
 * exemplo, fecha via closeGoalForm). Nunca chama handleSave, handleDelete
 * (window.confirm), handleToggleActive, handleSaveGoal ou handleDeleteGoal
 * (window.confirm) em nenhum caminho. Disparado sob demanda pelo botão "?" —
 * sem persistência de "já viu".
 */
const SellersPageTour = forwardRef<SellersPageTourHandle>(function SellersPageTour(_props, ref) {
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
          // Segurança extra: garante que nenhum modal/drawer de exemplo
          // fica aberto se o usuário sair do tour no meio dos passos.
          dispatchTourEvent(SELLERS_PAGE_TOUR_EVENTS.closeSellerModal);
          dispatchTourEvent(SELLERS_PAGE_TOUR_EVENTS.closeGoalForm);
          cleanupDragCursor();
          d.destroy();
        },
      });
      driverRef.current = d;
      d.drive();
    };

    // Carregamento assíncrono (fetchStats + fetchSellers + fetchSellerGoals +
    // fetchTeamUsers em paralelo) — espera o container da página estar de
    // fato no DOM antes de iniciar o drive.
    waitForElement('[data-tour="sellers-page"]')
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

export default SellersPageTour;
export { SELLERS_PAGE_TOUR_EVENTS };
