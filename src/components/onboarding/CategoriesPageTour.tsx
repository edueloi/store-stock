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
  const openExampleCategory = () => {
    dispatchTourEvent(CATEGORIES_PAGE_TOUR_EVENTS.openNewCategory);
    return waitForElement('[data-tour="category-name-field"]').then(() => {
      dispatchTourEvent(CATEGORIES_PAGE_TOUR_EVENTS.fillCategory, { name: "Categoria Exemplo" });
    });
  };

  return [
    {
      popover: {
        title: "Conhecendo Categorias",
        description: "Este tour mostra como criar uma categoria nova e como editar uma que já existe. Nada será salvo de verdade.",
      },
    },
    {
      element: tourElement("categories-page"),
      popover: {
        title: "Para que servem as categorias",
        description: "Categorias agrupam produtos parecidos (por exemplo: \"Bebidas\", \"Limpeza\", \"Eletrônicos\"). Isso ajuda o cliente a encontrar o que procura mais rápido quando navega pela sua loja online.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("categories-new-btn"),
      popover: {
        title: "Criar uma categoria nova",
        description: "Vamos abrir o formulário de cadastro para você ver quais campos existem (sem salvar nada de verdade).",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => goForward(opts.driver, openExampleCategory),
      },
    },
    {
      element: tourElement("category-name-field"),
      popover: {
        title: "Nome da categoria",
        description: "Preenchemos com \"Categoria Exemplo\" só para ilustrar. Logo abaixo você escolhe um ícone e uma cor para identificar essa categoria visualmente.",
        side: "bottom",
        align: "start",
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(CATEGORIES_PAGE_TOUR_EVENTS.closeCategoryModal);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      popover: {
        title: "Ícone e cor",
        description: "Escolha um ícone (roupas, calçados, tecnologia, etc.) e uma cor. Eles aparecem nos cards da categoria e ajudam a reconhecê-la rapidamente na lista.",
      },
    },
    {
      popover: {
        title: "Capa da categoria",
        description: "Você também pode enviar uma foto de capa, que aparece no topo do card da categoria e na loja online. Vamos fechar este exemplo sem salvar e mostrar como editar uma categoria que já existe.",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(CATEGORIES_PAGE_TOUR_EVENTS.closeCategoryModal);
          dispatchTourEvent(CATEGORIES_PAGE_TOUR_EVENTS.openEditCategory);
          goForward(opts.driver, () => waitForElement('[data-tour="category-name-field"]', 2500));
        },
        onPrevClick: (_el, _step, opts) => {
          goBack(opts.driver, openExampleCategory);
        },
      },
    },
    {
      // Passo opcional: só aparece se havia ao menos uma categoria cadastrada
      // (o componente decide isso internamente ao receber o evento). Se a
      // lista estava vazia, o modal não abre e skipMissingElement pula o passo.
      element: tourElement("category-name-field"),
      popover: {
        title: "Editar uma categoria existente",
        description: "Clicando em \"Editar\" em qualquer card da lista, você abre este mesmo formulário já preenchido, pronto para atualizar nome, ícone, cor ou capa.",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(CATEGORIES_PAGE_TOUR_EVENTS.closeCategoryModal);
          opts.driver.moveNext();
        },
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(CATEGORIES_PAGE_TOUR_EVENTS.closeCategoryModal);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      popover: {
        title: "Ver os produtos de uma categoria",
        description: "O botão \"Ver itens\", em cada card, mostra quais produtos já estão naquela categoria e permite adicionar produtos que ainda não têm categoria definida.",
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe criar e editar categorias. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
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
