import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, simulateFileDrag, simulateClick, cleanupDragCursor } from "./tour-utils";

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

  // Reabre o modal de XML já processando o arquivo de exemplo (mesmo
  // caminho do passo original), usado tanto ao avançar quanto ao voltar
  // para esse ponto do tour.
  const openXmlPreview = () => {
    dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.openXmlModal);
    return waitForElement('[data-tour="xml-import-preview"]');
  };

  return [
    {
      popover: {
        title: "Conhecendo o Catálogo",
        description: "Este tour mostra, passo a passo, como usar a tela de Catálogo: importar produtos de um arquivo, cadastrar um produto novo e editar um já existente. Nada será salvo de verdade.",
      },
    },
    {
      element: tourElement("inventory-page"),
      popover: {
        title: "Seus produtos",
        description: "Aqui ficam todos os produtos que você vende na loja: nome, preço, estoque e a categoria de cada um.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("inventory-import-pdf-btn"),
      popover: {
        title: "Importar PDF",
        description: "Se você tem uma lista de produtos em PDF (uma nota fiscal ou o catálogo de um fornecedor, por exemplo), este botão lê o arquivo e sugere os produtos para cadastro, sem precisar digitar um por um. Vamos abrir para você ver como é (sem importar nada de verdade).",
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
        description: "É só arrastar o arquivo PDF até esta área (ou clicar para escolher no computador). Vamos fechar este exemplo e mostrar o Importar XML, que funciona de forma parecida.",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.closePdfModal);
          goForward(opts.driver, openXmlPreview);
        },
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.closePdfModal);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      // Abre o XML já processando o arquivo de exemplo de verdade (via
      // autoLoadUrl em XmlImportModal) — chega direto na tela de preview
      // com produtos reais extraídos do XML, não uma dropzone vazia.
      element: tourElement("xml-import-preview"),
      popover: {
        title: "Importar XML",
        description: "O Importar XML lê o arquivo eletrônico de uma nota fiscal de compra e já preenche nome, quantidade, preço e dados fiscais dos produtos. Veja o resultado: cada linha marcada como \"NOVO\" vira um produto novo, e \"ATUALIZAR\" soma no estoque de um produto que você já tem.",
        side: "top",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          goForward(opts.driver, () => waitForElement('[data-tour="xml-import-cancel-btn"]'));
        },
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.closeXmlModal);
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.openPdfModal);
          goBack(opts.driver, () => waitForElement('[data-tour="pdf-import-dropzone"]'));
        },
      },
    },
    {
      // Clica de verdade no botão "Cancelar" (nunca em "Confirmar") — mesmo
      // efeito de fechar sem importar, mas mostrando ao usuário exatamente
      // onde clicar quando ele quiser desistir de uma importação real.
      element: tourElement("xml-import-cancel-btn"),
      onHighlightStarted: () => {
        simulateClick('[data-tour="xml-import-cancel-btn"]');
      },
      popover: {
        title: "Nada é importado sem você confirmar",
        description: "Depois de revisar a lista, você clicaria em \"Confirmar\" para importar de verdade. Aqui no tour vamos clicar em \"Cancelar\", para deixar claro que nenhum produto foi criado.",
        side: "top",
        align: "end",
        onNextClick: (_el, _step, opts) => {
          const cancelBtn = tourElement("xml-import-cancel-btn")() as HTMLButtonElement | undefined;
          cancelBtn?.click();
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.openNewProduct, { name: "Produto Exemplo" });
          goForward(opts.driver, () => waitForElement('[data-tour="product-name-field"]'));
        },
        onPrevClick: (_el, _step, opts) => goBack(opts.driver, () => Promise.resolve()),
      },
    },
    {
      element: tourElement("product-name-field"),
      onHighlightStarted: () => {
        dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.fillProduct, { price: 29.9, stock_quantity: 10 });
      },
      popover: {
        title: "Cadastro manual de produto",
        description: "Quando você não tem PDF nem XML, dá para cadastrar um produto preenchendo os campos manualmente. Nome, preço de venda e estoque são os campos mais importantes. Preenchemos valores de exemplo só para ilustrar; nada é salvo de verdade.",
        side: "bottom",
        align: "start",
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(INVENTORY_PAGE_TOUR_EVENTS.closeProductModal);
          goBack(opts.driver, openXmlPreview);
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
        description: "Além das fotos (mostradas aqui como exemplo), o cadastro completo também tem uma seção de categoria e de dados fiscais (NCM, CFOP, CSOSN/CST), usados na hora de emitir a nota fiscal. Vamos fechar sem salvar e mostrar como editar um produto que já existe.",
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
        title: "Editar um produto existente",
        description: "Clicando no ícone de lápis \"Editar\", ao lado de qualquer produto na lista, você abre este mesmo formulário já preenchido com os dados atuais, pronto para atualizar preço, estoque ou fotos. Vamos fechar sem salvar.",
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
        description: "Use a barra de busca para achar um produto pelo nome ou código, e os filtros de categoria, status e estoque crítico para ver só o que interessa no momento.",
      },
    },
    {
      element: tourElement("inventory-new-product-btn"),
      popover: {
        title: "Visualização em Grade ou em Tabela",
        description: "O botão ao lado do \"Novo Produto\"alterna como a lista aparece na tela: em Tabela você vê mais dados de cada produto lado a lado; em Grade o foco fica nas fotos, como uma vitrine.",
        side: "bottom",
        align: "end",
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já conhece os principais recursos da tela de Catálogo. Se quiser rever este passo a passo em outro momento, é só clicar no botão de ajuda (?) no topo da página.",
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
