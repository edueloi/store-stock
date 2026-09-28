import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, cleanupDragCursor } from "./tour-utils";

// Canal de comunicação com Goals.tsx — abre o drawer "Nova Meta" de verdade
// e preenche campos de exemplo, mas nunca chama handleSave (POST/PUT real)
// nem handleDelete (DELETE real, atrás de um window.confirm nativo — nunca
// referenciado por este tour). Fechar sempre via closeForm.
const GOALS_PAGE_TOUR_EVENTS = {
  openNewGoal: "page-tour:goals:open-new-goal",
  fillGoal: "page-tour:goals:fill-goal",
  closeForm: "page-tour:goals:close-form",
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
  const openExampleGoal = () => {
    dispatchTourEvent(GOALS_PAGE_TOUR_EVENTS.openNewGoal);
    return waitForElement('[data-tour="goals-form-title"]').then(() => {
      dispatchTourEvent(GOALS_PAGE_TOUR_EVENTS.fillGoal, { title: "Meta Exemplo", target: "10000" });
    });
  };

  return [
    {
      popover: {
        title: "Conhecendo as Metas",
        description: "Este tour mostra como acompanhar metas de faturamento, vendas e outros indicadores da loja. Nenhuma meta será criada de verdade.",
      },
    },
    {
      element: tourElement("goals-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui você define objetivos (faturar X, vender Y unidades, etc.) para um período, e acompanha o progresso em tempo real conforme as vendas acontecem.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("goals-summary-cards"),
      popover: {
        title: "Resumo das metas",
        description: "\"Total Ativas\" conta todas as metas em andamento. \"Atingidas\" são as que já bateram 100%. \"No Caminho\" estão entre 50% e 99% do objetivo. \"Em Risco\" estão abaixo de 50% e precisam de atenção.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("goals-period-filter"),
      popover: {
        title: "Filtrar por período",
        description: "Filtre as metas exibidas por período: diária, semanal, mensal, trimestral, semestral ou anual. \"Todas\" mostra metas de qualquer período juntas.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("goals-grid"),
      popover: {
        title: "Cards de meta",
        description: "Cada card mostra a barra de progresso e o percentual concluído. O selo \"Meta atingida!\" aparece ao chegar em 100%. O ícone de chama indica que faltam 3 dias ou menos para o prazo terminar, um alerta visual pra não deixar a meta vencer sem acompanhar.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("goals-new-btn"),
      popover: {
        title: "Criar uma nova meta",
        description: "Esse botão abre o painel para escolher o tipo de meta (faturamento, vendas, etc.), o período e o valor alvo. Vamos abrir para você ver como é (nada será salvo).",
        side: "bottom",
        align: "end",
        onNextClick: (_el, _step, opts) => goForward(opts.driver, openExampleGoal),
      },
    },
    {
      element: tourElement("goals-form-title"),
      popover: {
        title: "Título da meta",
        description: "Preenchemos com \"Meta Exemplo\" só para ilustrar. Um bom título ajuda a identificar a meta rapidamente na lista, por exemplo \"Faturar R$ 50.000 em Junho\".",
        side: "left",
        align: "start",
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(GOALS_PAGE_TOUR_EVENTS.closeForm);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      element: tourElement("goals-form-target"),
      popover: {
        title: "Valor alvo e resumo",
        description: "É o número que a meta precisa atingir para ser considerada concluída. Preenchemos R$ 10.000,00 como exemplo — repare que o \"Resumo da Meta\" logo abaixo atualiza em tempo real conforme você preenche. Vamos fechar este exemplo sem salvar.",
        side: "left",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(GOALS_PAGE_TOUR_EVENTS.closeForm);
          opts.driver.moveNext();
        },
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe acompanhar o progresso das suas metas. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface GoalsPageTourHandle {
  start: () => void;
}

/**
 * Tour de página de Metas (driver.js). Spotlight + popover explicando os
 * cards de resumo, o filtro de período e os cards de meta. Abre o drawer
 * "Nova Meta" de verdade (openCreate) e preenche campos de exemplo, sempre
 * fechando via closeForm — nunca chama handleSave. Nunca chama handleDelete
 * (que dispara window.confirm nativo) em nenhum caminho. Disparado sob
 * demanda pelo botão "?" — sem persistência de "já viu".
 */
const GoalsPageTour = forwardRef<GoalsPageTourHandle>(function GoalsPageTour(_props, ref) {
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
          // se o usuário sair do tour no meio dos passos.
          dispatchTourEvent(GOALS_PAGE_TOUR_EVENTS.closeForm);
          cleanupDragCursor();
          d.destroy();
        },
      });
      driverRef.current = d;
      d.drive();
    };

    // Carregamento assíncrono (fetchGoals) — espera o container da página
    // estar de fato no DOM antes de iniciar o drive.
    waitForElement('[data-tour="goals-page"]')
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

export default GoalsPageTour;
