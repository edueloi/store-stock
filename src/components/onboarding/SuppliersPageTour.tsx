import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement } from "./tour-utils";

// ── Canal de comunicação tour de página → tela ──────────────────────────────
//
// Namespace PRÓPRIO (page-tour:suppliers:*) — Suppliers.tsx não tinha nenhum
// canal de tour antes; este é o primeiro. O tour escuta este contrato via um
// novo useEffect em Suppliers.tsx, chamando só setIsModalOpen/setEditing/
// closeModal — nunca handleSave (POST/PUT real) nem handleDelete (DELETE
// real).
export const SUPPLIERS_PAGE_TOUR_EVENTS = {
  openNewSupplier: "page-tour:suppliers:open-new-supplier",
  fillSupplier: "page-tour:suppliers:fill-supplier",
  closeSupplierModal: "page-tour:suppliers:close-supplier-modal",
  openEditSupplier: "page-tour:suppliers:open-edit-supplier",
} as const;

// Cada passo que muda o "estado da tela" (abrir/fechar o modal) sabe como
// desfazer isso ao voltar, via onPrevClick — "Voltar" sempre funciona de
// verdade, sem precisar desabilitá-lo nesses pontos.
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
  const openExampleSupplier = () => {
    dispatchTourEvent(SUPPLIERS_PAGE_TOUR_EVENTS.openNewSupplier);
    return waitForElement('[data-tour="supplier-name-field"]').then(() => {
      dispatchTourEvent(SUPPLIERS_PAGE_TOUR_EVENTS.fillSupplier, {
        name: "Fornecedor Exemplo",
        category: "Materiais de exemplo",
        phone: "(11) 3000-0000",
      });
    });
  };

  return [
    {
      popover: {
        title: "Conhecendo Fornecedores",
        description: "Este tour mostra como cadastrar um fornecedor novo e como editar um que já existe. Nada será salvo de verdade.",
      },
    },
    {
      element: tourElement("suppliers-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Fornecedores são as empresas ou pessoas que te vendem as mercadorias e insumos da sua loja. Aqui você guarda os dados de contato de cada um, para nunca perder o telefone ou e-mail de quem fornece o quê.",
        side: "top",
        align: "start",
      },
    },
    {
      popover: {
        title: "Grade ou Lista",
        description: "Alterne entre \"Grade\" (cards visuais, bom para poucos fornecedores) e \"Lista\" (mais compacta, com contato rápido e observações visíveis de uma vez), conforme o que for mais prático para você.",
      },
    },
    {
      element: tourElement("suppliers-new-btn"),
      popover: {
        title: "Cadastrar um fornecedor novo",
        description: "Vamos abrir o formulário e preencher um exemplo, só para você ver quais campos existem (sem salvar nada de verdade).",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => goForward(opts.driver, openExampleSupplier),
      },
    },
    {
      element: tourElement("supplier-name-field"),
      popover: {
        title: "Nome do fornecedor",
        description: "Preenchemos com \"Fornecedor Exemplo\" só para ilustrar. É o nome fantasia ou razão social que você reconhece na hora de lançar uma compra.",
        side: "bottom",
        align: "start",
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(SUPPLIERS_PAGE_TOUR_EVENTS.closeSupplierModal);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      element: tourElement("supplier-category-field"),
      popover: {
        title: "O que ele fornece",
        description: "Descreva rapidamente o que este fornecedor vende para você (ex: \"Embalagens\", \"Tecidos\", \"Calçados\"). Ajuda a identificar o fornecedor certo na hora de repor um tipo de produto.",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(SUPPLIERS_PAGE_TOUR_EVENTS.closeSupplierModal);
          dispatchTourEvent(SUPPLIERS_PAGE_TOUR_EVENTS.openEditSupplier);
          goForward(opts.driver, () => waitForElement('[data-tour="supplier-name-field"]', 2500));
        },
      },
    },
    {
      // Passo opcional: só aparece se havia ao menos um fornecedor cadastrado
      // (o componente decide isso internamente ao receber o evento). Se a
      // lista estava vazia, o modal não abre e skipMissingElement pula o
      // passo com segurança.
      element: tourElement("supplier-name-field"),
      popover: {
        title: "Editar um fornecedor existente",
        description: "Clicando no ícone de lápis \"Editar\", em qualquer card ou linha da lista, você abre este mesmo formulário já preenchido, pronto para atualizar contato, endereço ou condições de pagamento. Vamos fechar sem salvar.",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(SUPPLIERS_PAGE_TOUR_EVENTS.closeSupplierModal);
          opts.driver.moveNext();
        },
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(SUPPLIERS_PAGE_TOUR_EVENTS.closeSupplierModal);
          goBack(opts.driver, openExampleSupplier);
        },
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe cadastrar e editar fornecedores. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface SuppliersPageTourHandle {
  start: () => void;
}

/**
 * Tour de página de Fornecedores (driver.js). Mostra a alternância
 * Grade/Lista, o cadastro de um fornecedor novo (nome e o que fornece) e a
 * edição de um fornecedor existente, sempre fechando sem salvar. Nunca
 * chama handleSave (POST/PUT real em /api/suppliers) nem handleDelete
 * (DELETE real) — só abre/preenche/fecha o modal via setIsModalOpen/
 * setEditing, exatamente como o botão "Cancelar" do modal faz. Disparado
 * sob demanda pelo botão "?" — sem persistência de "já viu".
 */
const SuppliersPageTour = forwardRef<SuppliersPageTourHandle>(function SuppliersPageTour(_props, ref) {
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
          // Segurança extra: garante que o modal de exemplo não fique aberto
          // se o usuário sair do tour no meio dos passos.
          dispatchTourEvent(SUPPLIERS_PAGE_TOUR_EVENTS.closeSupplierModal);
          d.destroy();
        },
      });
      driverRef.current = d;
      d.drive();
    };

    // Carregamento assíncrono (fetchSuppliers) — espera o container da
    // página estar de fato no DOM antes de iniciar o drive, em vez de um
    // timeout fixo.
    waitForElement('[data-tour="suppliers-page"]')
      .then(beginDrive)
      .catch(beginDrive);
  };

  useImperativeHandle(ref, () => ({ start }));

  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
    };
  }, []);

  return null;
});

export default SuppliersPageTour;
