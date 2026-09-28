import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, simulateFileDrag, cleanupDragCursor } from "./tour-utils";

// ── Canal de comunicação tour de página → tela ──────────────────────────────
//
// Namespace PRÓPRIO (page-tour:inventory:*), separado do tour geral
// (onboarding-tour:*) usado em OnboardingTour.tsx, para não colidir com os
// listeners que já existem em Inventory.tsx para o tour geral. O tour de
// página do Catálogo escuta este contrato via um novo useEffect em
// Inventory.tsx (bloco separado do já existente) — nunca chama handleSave.
export const INVENTORY_PAGE_TOUR_EVENTS = {
  openEditProduct: "page-tour:inventory:open-edit-product",
  openNewProduct: "page-tour:inventory:open-new-product",
  fillProduct: "page-tour:inventory:fill-product",
  fillProductImage: "page-tour:inventory:fill-product-image",
  closeProductModal: "page-tour:inventory:close-product-modal",
  openPdfModal: "page-tour:inventory:open-pdf-modal",
  closePdfModal: "page-tour:inventory:close-pdf-modal",
  openXmlModal: "page-tour:inventory:open-xml-modal",
  closeXmlModal: "page-tour:inventory:close-xml-modal",
} as const;

// Cada passo que muda o "estado da tela" (abrir/fechar um modal) sabe como
// desfazer isso ao voltar — assim "Voltar" sempre funciona de verdade, em
// vez de ficar desabilitado nesses pontos (que confundia o usuário, parecia
// bug). goTo(driver, work, index) só avança/retrocede depois do trabalho
// assíncrono (fechar modal A, abrir modal B, esperar elemento) terminar.
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
        title: "Conhecendo o Catálogo",
        description: "Vamos conhecer o Catálogo em detalhes — cada recurso desta tela, na prática.",
      },
    },
    {
      element: tourElement("inventory-page"),
      popover: {
        title: "Seus produtos",
        description: "Aqui ficam todos os produtos cadastrados na sua loja, com preço, estoque e organização por categoria.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("inventory-import-pdf-btn"),
      popover: {
        title: "Importar PDF",
        description: "Importa uma lista de produtos a partir de um PDF — nota fiscal ou catálogo de fornecedor. Vamos abrir para você ver (sem importar nada de verdade).",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.openPdfModal);
          goForward(opts.driver, () => waitForElement('[data-tour="pdf-import-dropzone"]'));
        },
      },
    },
    {
      element: tourElement("pdf-import-dropzone"),
      onHighlightStarted: () => {
        // Ilustra visualmente "arrastar o PDF até aqui" — cursor fantasma,
        // nenhum File real é criado, não dispara o parser do modal.
        simulateFileDrag('[data-tour="pdf-import-dropzone"]', "nota_fiscal_exemplo.pdf");
      },
      popover: {
        title: "Área de upload do PDF",
        description: "Arraste o PDF da nota fiscal ou catálogo do fornecedor aqui (ou clique para escolher o arquivo). O sistema lê os itens automaticamente. Vamos fechar este exemplo e ver o Importar XML.",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.closePdfModal);
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.openXmlModal);
          goForward(opts.driver, () => waitForElement('[data-tour="xml-import-dropzone"]'));
        },
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.closePdfModal);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      element: tourElement("xml-import-dropzone"),
      onHighlightStarted: () => {
        simulateFileDrag('[data-tour="xml-import-dropzone"]', "produtos_exemplo.xml");
      },
      popover: {
        title: "Importar XML",
        description: "Importa produtos a partir do XML de uma nota fiscal de compra, preenchendo automaticamente nome, preço, NCM e outros dados fiscais.",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.closeXmlModal);
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.openNewProduct, { name: "Produto Exemplo" });
          goForward(opts.driver, () => waitForElement('[data-tour="product-name-field"]'));
        },
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.closeXmlModal);
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.openPdfModal);
          goBack(opts.driver, () => waitForElement('[data-tour="pdf-import-dropzone"]'));
        },
      },
    },
    {
      element: tourElement("product-name-field"),
      onHighlightStarted: () => {
        dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.fillProduct, { price: 29.9, stock_quantity: 10 });
      },
      popover: {
        title: "Cadastro rápido",
        description: "Nome, preço de venda e estoque são os campos essenciais. Preenchemos com valores de exemplo só para ilustrar — nada é salvo.",
        side: "bottom",
        align: "start",
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.closeProductModal);
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.openXmlModal);
          goBack(opts.driver, () => waitForElement('[data-tour="xml-import-dropzone"]'));
        },
      },
    },
    {
      element: tourElement("product-gallery"),
      onHighlightStarted: () => {
        // Foto de exemplo (asset estático, sem upload real) só para ilustrar
        // como fica um produto com foto cadastrada.
        dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.fillProductImage);
      },
      popover: {
        title: "Mais opções no mesmo cadastro",
        description: "Além de fotos, o cadastro completo tem seção de categoria e dados fiscais (NCM, CFOP, CSOSN/CST) para a nota eletrônica. Vamos fechar sem salvar e ver a edição de um produto já existente.",
        side: "right",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.closeProductModal);
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.openEditProduct);
          goForward(opts.driver, () => waitForElement('[data-tour="product-name-field"]', 2500));
        },
      },
    },
    {
      // Passo opcional: só aparece se a edição de fato abriu (lista tinha produto).
      // skipMissingElement no driver cobre o caso de catálogo vazio, pulando
      // este passo com segurança em vez de travar o tour.
      element: tourElement("product-name-field"),
      popover: {
        title: "Editar produto existente",
        description: "O botão \"Editar\" (ícone de lápis) na lista abre o mesmo formulário, já preenchido, para você atualizar preço, estoque ou fotos. Vamos fechar sem salvar.",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.closeProductModal);
          opts.driver.moveNext();
        },
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.closeProductModal);
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.openNewProduct, { name: "Produto Exemplo" });
          goBack(opts.driver, () => waitForElement('[data-tour="product-gallery"]'));
        },
      },
    },
    {
      popover: {
        title: "Busca e filtros",
        description: "Use a busca por nome/SKU e os filtros de categoria, status e estoque crítico para localizar produtos rapidamente.",
      },
    },
    {
      element: tourElement("inventory-new-product-btn"),
      popover: {
        title: "Grade ou Tabela",
        description: "O botão ao lado do \"Novo Produto\" alterna entre visualização em tabela (mais dados por linha) e em grade (foco visual nas fotos).",
        side: "bottom",
        align: "end",
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já conhece os principais recursos do Catálogo. Você pode rever este tour a qualquer momento pelo botão de ajuda (?).",
      },
    },
  ];
}

export interface InventoryPageTourHandle {
  start: () => void;
}

/**
 * Tour de página do Catálogo (driver.js) — mais profundo que o tour geral,
 * cobre Importar PDF/XML (com animação de "arrastar arquivo"), cadastro
 * rápido de produto (com foto de exemplo), edição de produto existente e
 * filtros/toggle de visualização. Fica todo dentro de /admin/catalog (não
 * navega entre rotas) e nunca dispara handleSave, handleImport (dos modais
 * de import) ou handleDelete/confirmBulkDelete. Todo passo que muda o
 * estado da tela sabe desfazer isso via onPrevClick, então "Voltar" sempre
 * funciona de verdade. Disparado sob demanda pelo botão "?" — sem
 * persistência de "já viu".
 */
const InventoryPageTour = forwardRef<InventoryPageTourHandle>(function InventoryPageTour(_props, ref) {
  const driverRef = useRef<Driver | null>(null);

  const closeAnyOpenModal = () => {
    // Segurança extra: garante que nenhum modal de exemplo (produto ou
    // import) fique aberto se o usuário sair do tour no meio dos passos.
    dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.closeProductModal);
    dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.closePdfModal);
    dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.closeXmlModal);
    cleanupDragCursor();
  };

  const start = () => {
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
        closeAnyOpenModal();
        d.destroy();
      },
    });
    driverRef.current = d;
    d.drive();
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

export default InventoryPageTour;
