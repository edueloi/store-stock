import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { tourElement, waitForElement, cleanupDragCursor } from "./tour-utils";

// Tela 100% leitura (sem modal de criação) — não existe nenhum estado real pra
// abrir/fechar aqui, então este tour não precisa de canal de eventos próprio,
// diferente de StockPageTour/MarkupPageTour. Só spotlight + popover explicando
// cada parte da tela.
function buildSteps(): DriveStep[] {
  return [
    {
      popover: {
        title: "Conhecendo o Calendário Financeiro",
        description: "Este tour mostra como visualizar suas contas a pagar e a receber organizadas por dia, direto no calendário do mês.",
      },
    },
    {
      element: tourElement("calendario-financeiro-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui você vê, dia a dia, tudo que vence: contas a pagar e a receber juntas no mesmo calendário, para planejar o fluxo de caixa do mês com antecedência.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("calendario-totais"),
      popover: {
        title: "Totais do mês",
        description: "\"A Pagar no Mês\" e \"A Receber no Mês\" somam os lançamentos visíveis no calendário atual. \"Saldo Projetado\"é a diferença entre os dois: quanto sobraria (ou faltaria) se tudo fosse pago e recebido no prazo.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("calendario-nav"),
      popover: {
        title: "Navegar entre meses",
        description: "Use as setas para andar mês a mês, ou escolha o ano direto na lista. O botão \"Hoje\", no topo da página, volta rapidamente para o mês atual.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("calendario-filtro"),
      popover: {
        title: "Filtrar por situação",
        description: "Filtre os lançamentos exibidos: \"Pendentes\" (ainda não vencidos), \"Vencidos\" (passaram do prazo sem baixa) ou \"Histórico\" (já pagos ou recebidos). \"Todos\" mostra tudo junto.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: tourElement("calendario-grid"),
      popover: {
        title: "A grade do calendário",
        description: "Cada dia mostra dois badges quando há lançamento: o valor em vermelho é o total a pagar, o valor em verde é o total a receber. Dias sem lançamento ficam em branco. Clicar num dia com lançamentos abre o painel de detalhes daquele dia (não vamos abrir agora, só mostrando onde fica).",
        side: "top",
        align: "start",
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe consultar seus vencimentos por dia no calendário. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface CalendarioFinanceiroPageTourHandle {
  start: () => void;
}

/**
 * Tour de página do Calendário Financeiro (driver.js). Tela 100% leitura — só
 * spotlight + popover explicando totais, navegação, filtro e a grade. Nunca
 * abre o painel de detalhes do dia (setSelectedDay) nem interage com nenhum
 * estado real da tela. Disparado sob demanda pelo botão "?" — sem persistência
 * de "já viu".
 */
const CalendarioFinanceiroPageTour = forwardRef<CalendarioFinanceiroPageTourHandle>(function CalendarioFinanceiroPageTour(_props, ref) {
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

    // Carregamento assíncrono (fetchData busca payables/receivables em
    // paralelo) — espera o container da página estar de fato no DOM antes de
    // iniciar o drive, em vez de um timeout fixo.
    waitForElement('[data-tour="calendario-financeiro-page"]')
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

export default CalendarioFinanceiroPageTour;
