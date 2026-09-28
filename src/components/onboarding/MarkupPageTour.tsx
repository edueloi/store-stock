import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, simulateClick, cleanupDragCursor } from "./tour-utils";

// ── Canal de comunicação tour de página → tela ──────────────────────────────
//
// Namespace PRÓPRIO (page-tour:markup:*), separado do tour geral e dos
// demais tours de página — Markup.tsx não tinha nenhum canal de tour antes.
// O tour escuta este contrato via um novo useEffect em Markup.tsx, chamando
// só setShowProductPicker/selectProduct — nunca applyPrice (que faz o PUT
// real em /api/products/:id, aplicando o preço sugerido ao catálogo).
export const MARKUP_PAGE_TOUR_EVENTS = {
  openProductPicker: "page-tour:markup:open-product-picker",
  selectSampleProduct: "page-tour:markup:select-sample-product",
  closeProductPicker: "page-tour:markup:close-product-picker",
} as const;

// Cada passo que muda o "estado da tela" (abrir/fechar o seletor de produto)
// sabe como desfazer isso ao voltar, via onPrevClick — "Voltar" sempre
// funciona de verdade, sem precisar desabilitá-lo nesses pontos.
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
        title: "Conhecendo a Calculadora de Markup",
        description: "Este tour mostra como calcular o preço ideal de venda a partir do custo do produto, impostos e margem desejada. Nada é salvo ou alterado no catálogo de verdade.",
      },
    },
    {
      element: tourElement("markup-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui você descobre por quanto vender um produto para cobrir custos, impostos, comissões e ainda ter a margem de lucro que deseja. O resultado vem com um DRE completo, mostrando para onde vai cada parte do preço.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("markup-select-product-btn"),
      popover: {
        title: "Selecionar um produto do catálogo",
        description: "Você pode calcular o markup para um produto já cadastrado: o custo dele preenche o campo automaticamente. Vamos abrir o seletor e escolher um produto de exemplo.",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(MARKUP_PAGE_TOUR_EVENTS.openProductPicker);
          goForward(opts.driver, () => waitForElement('[data-tour="markup-product-picker"]', 2500));
        },
      },
    },
    {
      element: tourElement("markup-product-picker"),
      popover: {
        title: "Lista de produtos",
        description: "Vamos escolher o primeiro produto da lista só como exemplo, para você ver o custo preenchido automaticamente na calculadora.",
        side: "top",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(MARKUP_PAGE_TOUR_EVENTS.selectSampleProduct);
          goForward(opts.driver, () => waitForElement('[data-tour="markup-margin-field"]', 2500));
        },
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(MARKUP_PAGE_TOUR_EVENTS.closeProductPicker);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      element: tourElement("markup-margin-field"),
      popover: {
        title: "Margem de lucro desejada",
        description: "Este é o percentual de lucro que você quer embutir no preço final, depois de descontar todos os custos e despesas. Quanto maior a margem, maior o preço sugerido.",
        side: "top",
        align: "start",
        onPrevClick: (_el, _step, opts) => {
          goBack(opts.driver, () => {
            dispatchTourEvent(MARKUP_PAGE_TOUR_EVENTS.openProductPicker);
            return waitForElement('[data-tour="markup-product-picker"]');
          });
        },
      },
    },
    {
      element: tourElement("markup-tax-field"),
      popover: {
        title: "Impostos sobre a venda",
        description: "Percentual de imposto pago sobre o preço de venda (Simples Nacional, ICMS, ISS, etc.). Ele entra no cálculo para garantir que o preço final cubra também essa despesa, sem corroer sua margem.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("markup-donut-chart"),
      popover: {
        title: "Distribuição do preço",
        description: "Este gráfico mostra visualmente como o preço de venda sugerido se divide: quanto vai para custo do produto, impostos, taxas, despesas fixas e, por fim, quanto sobra de lucro líquido.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("markup-analysis-table"),
      popover: {
        title: "Análise do catálogo",
        description: "Com os parâmetros atuais, esta tabela compara todos os seus produtos com custo cadastrado: mostra o preço sugerido de cada um e sinaliza quais estão vendendo abaixo do markup recomendado, para você ajustar antes de perder margem.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("markup-save-btn"),
      onHighlightStarted: () => {
        // Indica visualmente onde clicar — cursor fantasma, sem gravar nada.
        simulateClick('[data-tour="markup-save-btn"]');
      },
      popover: {
        title: "Salvar, PDF e Excel",
        description: "\"Salvar Config.\" guarda seus parâmetros (impostos, margem, etc.) para a próxima vez que você abrir esta tela. \"PDF\" e \"Excel\" exportam o cálculo completo para compartilhar ou imprimir. Não vamos clicar de verdade aqui no tour.",
        side: "bottom",
        align: "end",
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe calcular o preço ideal de venda e acompanhar quais produtos precisam de ajuste de preço. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface MarkupPageTourHandle {
  start: () => void;
}

/**
 * Tour de página da Calculadora de Markup (driver.js). Mostra a seleção de
 * produto do catálogo, os campos de margem/impostos, o gráfico de
 * distribuição e a tabela de análise do catálogo. Nunca chama applyPrice
 * (PUT real em /api/products/:id) — só abre o seletor via
 * openProductPicker e escolhe o primeiro produto via selectSampleProduct,
 * exatamente como clicar num item da lista faria. Os botões "Salvar
 * Config."/PDF/Excel são só indicados com o cursor fantasma (simulateClick),
 * nunca clicados de verdade, para não gravar em localStorage nem disparar
 * downloads sem o usuário pedir. Disparado sob demanda pelo botão "?" — sem
 * persistência de "já viu".
 */
const MarkupPageTour = forwardRef<MarkupPageTourHandle>(function MarkupPageTour(_props, ref) {
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
          // Segurança extra: garante que o seletor de produto não fique
          // aberto se o usuário sair do tour no meio dos passos.
          dispatchTourEvent(MARKUP_PAGE_TOUR_EVENTS.closeProductPicker);
          cleanupDragCursor();
          d.destroy();
        },
      });
      driverRef.current = d;
      d.drive();
    };

    // Carregamento assíncrono (fetchAll busca produtos e tenant em paralelo)
    // — espera o container da página estar de fato no DOM antes de iniciar
    // o drive, em vez de um timeout fixo.
    waitForElement('[data-tour="markup-page"]')
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

export default MarkupPageTour;
