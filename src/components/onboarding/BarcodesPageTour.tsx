import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, simulateClick, cleanupDragCursor } from "./tour-utils";

// ── Canal de comunicação tour de página → tela ──────────────────────────────
//
// Namespace PRÓPRIO (page-tour:barcodes:*) — Barcodes.tsx não tinha nenhum
// canal de tour antes; este é o primeiro. O tour escuta este contrato via um
// novo useEffect em Barcodes.tsx, chamando só toggleSelect/selectAll/
// clearAll — nunca handlePrint (que abre uma janela nova e dispara
// window.print() de verdade).
export const BARCODES_PAGE_TOUR_EVENTS = {
  selectSample: "page-tour:barcodes:select-sample",
  clearSelection: "page-tour:barcodes:clear-selection",
} as const;

// Cada passo que muda o "estado da tela" (selecionar/limpar produtos) sabe
// como desfazer isso ao voltar, via onPrevClick — "Voltar" sempre funciona
// de verdade, sem precisar desabilitá-lo nesses pontos.
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
        title: "Conhecendo Etiquetas & Códigos de Barras",
        description: "Este tour mostra como selecionar produtos, configurar o layout da etiqueta e imprimir. Nenhuma etiqueta será impressa de verdade.",
      },
    },
    {
      element: tourElement("barcodes-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui você gera etiquetas com código de barras e QR Code para colar nos produtos físicos da loja, prontas para um leitor de código de barras escanear no PDV.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("barcodes-select-sample-btn"),
      onHighlightStarted: () => {
        simulateClick('[data-tour="barcodes-select-sample-btn"]');
      },
      popover: {
        title: "Selecionar produtos",
        description: "Marque os produtos para os quais quer gerar etiqueta. Vamos selecionar um produto de exemplo, só para você ver a pré-visualização em ação.",
        side: "right",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(BARCODES_PAGE_TOUR_EVENTS.selectSample);
          goForward(opts.driver, () => waitForElement('[data-tour="barcodes-label-size"]', 2500));
        },
      },
    },
    {
      element: tourElement("barcodes-label-size"),
      popover: {
        title: "Tamanho da etiqueta",
        description: "Escolha o tamanho físico da etiqueta (pequena, média ou grande), de acordo com a folha ou rolo de etiquetas que você vai usar na impressora.",
        side: "left",
        align: "start",
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(BARCODES_PAGE_TOUR_EVENTS.clearSelection);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      element: tourElement("barcodes-layout"),
      popover: {
        title: "Colunas por linha",
        description: "Define quantas etiquetas ficam lado a lado em cada linha da folha impressa. Ajuste conforme o modelo de folha de etiquetas que você tem.",
        side: "left",
        align: "start",
      },
    },
    {
      element: tourElement("barcodes-fields"),
      popover: {
        title: "Campos exibidos na etiqueta",
        description: "Escolha o que aparece impresso: nome do produto, preço, código de barras, QR Code e número/SKU. Quanto mais campos, maior a etiqueta precisa ser para caber tudo.",
        side: "left",
        align: "start",
      },
    },
    {
      element: tourElement("barcodes-preview"),
      popover: {
        title: "Pré-visualização",
        description: "Aqui você vê exatamente como cada etiqueta vai ficar impressa, já com o código de barras e os campos escolhidos, antes de mandar para a impressora.",
        side: "left",
        align: "start",
      },
    },
    {
      element: tourElement("barcodes-print-btn"),
      onHighlightStarted: () => {
        // Indica visualmente onde clicar — cursor fantasma, nunca dispara
        // handlePrint (que abre janela nova e chama window.print()).
        simulateClick('[data-tour="barcodes-print-btn"]');
      },
      popover: {
        title: "Imprimir etiquetas",
        description: "Quando estiver tudo certo, este botão abre a janela de impressão do navegador com todas as etiquetas selecionadas. Não vamos clicar de verdade aqui no tour.",
        side: "top",
        align: "end",
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe selecionar produtos, configurar e imprimir etiquetas. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface BarcodesPageTourHandle {
  start: () => void;
}

/**
 * Tour de página de Etiquetas & Códigos de Barras (driver.js). Mostra a
 * seleção de produtos, as configurações de layout/campos e a pré-
 * visualização, sempre sem imprimir nada de verdade. Nunca chama
 * handlePrint (que abre uma janela nova via window.open e dispara
 * window.print() real) — só seleciona/limpa produtos via toggleSelect,
 * exatamente como clicar no checkbox de um produto faria, e indica o botão
 * de imprimir só com o cursor fantasma (simulateClick). O passo de
 * pré-visualização é opcional: se a seleção de exemplo não gerar a seção a
 * tempo, skipMissingElement pula o passo com segurança. Disparado sob
 * demanda pelo botão "?" — sem persistência de "já viu".
 */
const BarcodesPageTour = forwardRef<BarcodesPageTourHandle>(function BarcodesPageTour(_props, ref) {
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
          // Segurança extra: garante que a seleção de exemplo não fique
          // marcada se o usuário sair do tour no meio dos passos.
          dispatchTourEvent(BARCODES_PAGE_TOUR_EVENTS.clearSelection);
          cleanupDragCursor();
          d.destroy();
        },
      });
      driverRef.current = d;
      d.drive();
    };

    // Carregamento assíncrono (fetch de produtos) — espera o container da
    // página estar de fato no DOM antes de iniciar o drive, em vez de um
    // timeout fixo.
    waitForElement('[data-tour="barcodes-page"]')
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

export default BarcodesPageTour;
