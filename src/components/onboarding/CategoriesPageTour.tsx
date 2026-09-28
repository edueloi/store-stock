import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement } from "./tour-utils";

// ── Canal de comunicação tour de página → tela ──────────────────────────────
//
// Namespace PRÓPRIO (page-tour:categories:*), separado do tour geral
// (onboarding-tour:*) já usado em Categories.tsx — nomes de evento distintos
// evitam qualquer colisão entre os dois tours.
export const CATEGORIES_PAGE_TOUR_EVENTS = {
  openNewCategory: "page-tour:categories:open-new-category",
  fillCategory: "page-tour:categories:fill-category",
  closeCategoryModal: "page-tour:categories:close-category-modal",
  openEditCategory: "page-tour:categories:open-edit-category",
} as const;

function buildSteps(): DriveStep[] {
  const goAfter = (driverObj: Driver, work: () => Promise<unknown>) => {
    work()
      .catch(() => { /* elemento não apareceu a tempo — segue o tour mesmo assim */ })
      .finally(() => driverObj.moveNext());
  };

  return [
    {
      popover: {
        title: "Conhecendo Categorias",
        description: "Vamos conhecer a tela de Categorias em detalhes.",
      },
    },
    {
      element: tourElement("categories-page"),
      popover: {
        title: "Organização do catálogo",
        description: "Aqui você organiza seus produtos em categorias, o que ajuda os clientes a navegar pela loja online.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("categories-new-btn"),
      popover: {
        title: "Nova categoria",
        description: "Vamos abrir o cadastro de uma categoria nova para você ver os campos disponíveis (nada será salvo).",
        side: "bottom",
        align: "start",
        disableButtons: ["previous"],
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(CATEGORIES_PAGE_TOUR_EVENTS.openNewCategory);
          goAfter(opts.driver, async () => {
            await waitForElement('[data-tour="category-name-field"]');
            dispatchTourEvent(CATEGORIES_PAGE_TOUR_EVENTS.fillCategory, { name: "Categoria Exemplo" });
          });
        },
      },
    },
    {
      element: tourElement("category-name-field"),
      popover: {
        title: "Nome da categoria",
        description: "Preenchemos com \"Categoria Exemplo\" só para ilustrar. Logo abaixo você escolhe um ícone e uma cor para identificar a categoria.",
        side: "bottom",
        align: "start",
        disableButtons: ["previous"],
      },
    },
    {
      popover: {
        title: "Ícone e cor",
        description: "Escolha um ícone (roupas, calçados, tecnologia, etc.) e uma cor — eles aparecem nos cards da categoria e ajudam a identificá-la rapidamente.",
      },
    },
    {
      popover: {
        title: "Capa da categoria",
        description: "Você também pode enviar uma imagem de capa para a categoria, exibida no topo do card. Vamos fechar este exemplo sem salvar.",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(CATEGORIES_PAGE_TOUR_EVENTS.closeCategoryModal);
          dispatchTourEvent(CATEGORIES_PAGE_TOUR_EVENTS.openEditCategory);
          goAfter(opts.driver, () => waitForElement('[data-tour="category-name-field"]', 2500));
        },
      },
    },
    {
      // Passo opcional: só aparece se havia ao menos uma categoria cadastrada
      // (o componente decide isso internamente ao receber o evento). Se a
      // lista estava vazia, o modal não abre e skipMissingElement pula o passo.
      element: tourElement("category-name-field"),
      popover: {
        title: "Editar categoria existente",
        description: "O botão \"Editar\" em cada card abre o mesmo formulário, já preenchido, para atualizar nome, ícone, cor ou capa.",
        side: "bottom",
        align: "start",
        disableButtons: ["previous"],
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(CATEGORIES_PAGE_TOUR_EVENTS.closeCategoryModal);
          opts.driver.moveNext();
        },
      },
    },
    {
      popover: {
        title: "Ver itens da categoria",
        description: "O botão \"Ver itens\" de cada card mostra os produtos daquela categoria e permite adicionar produtos sem categoria a ela.",
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já conhece os principais recursos de Categorias. Você pode rever este tour a qualquer momento pelo botão de ajuda (?).",
      },
    },
  ];
}

export interface CategoriesPageTourHandle {
  start: () => void;
}

/**
 * Tour de página de Categorias (driver.js). Mostra o cadastro completo
 * (nome, ícone, cor, capa) e a edição de uma categoria existente, sempre
 * fechando sem salvar. Nunca chama handleSave, uploadCover, handleDelete ou
 * assignSelectedProducts — "Ver itens" é só citado em texto, sem abrir o
 * modal de gerenciamento de produtos de verdade (esse modal grava associações
 * reais via assignSelectedProducts, então o tour não interage com ele).
 * Disparado sob demanda pelo botão "?" — sem persistência de "já viu".
 */
const CategoriesPageTour = forwardRef<CategoriesPageTourHandle>(function CategoriesPageTour(_props, ref) {
  const driverRef = useRef<Driver | null>(null);

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
        // Segurança extra: garante que o modal de exemplo não fique aberto
        // se o usuário sair do tour no meio dos passos.
        dispatchTourEvent(CATEGORIES_PAGE_TOUR_EVENTS.closeCategoryModal);
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
    };
  }, []);

  return null;
});

export default CategoriesPageTour;
