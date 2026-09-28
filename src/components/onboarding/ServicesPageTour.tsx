import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, cleanupDragCursor } from "./tour-utils";

// Canal de comunicação com Services.tsx — abre o modal "Novo Serviço" de
// verdade (openNew) e preenche campos de exemplo, mas nunca simula o submit
// do form (handleSave faz POST/PUT real), nunca abre o modal de exclusão
// (deleteTarget → handleDelete, DELETE real), nunca chama handleToggle (PUT
// real fora do modal) nem handleImageFile (POST real de upload — a área de
// imagem é só indicada com spotlight, sem selecionar arquivo). Fechar sempre
// via closeModal.
const SERVICES_PAGE_TOUR_EVENTS = {
  openNewService: "page-tour:services:open-new-service",
  fillService: "page-tour:services:fill-service",
  closeServiceModal: "page-tour:services:close-service-modal",
  openEditService: "page-tour:services:open-edit-service",
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
  const openExampleService = () => {
    dispatchTourEvent(SERVICES_PAGE_TOUR_EVENTS.openNewService);
    return waitForElement('[data-tour="service-form-name"]').then(() => {
      dispatchTourEvent(SERVICES_PAGE_TOUR_EVENTS.fillService, {
        name: "Serviço Exemplo",
        price: "50,00",
      });
    });
  };

  return [
    {
      popover: {
        title: "Conhecendo Serviços",
        description: "Este tour mostra como cadastrar os serviços vendidos no PDV — impressão, cartão de visita, xerox e outros. Nada será criado, alterado ou excluído de verdade.",
      },
    },
    {
      element: tourElement("services-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui você cadastra os serviços oferecidos pela loja, com preço, categoria e forma de cobrança, para que apareçam disponíveis na hora de vender no PDV.",
        side: "top",
        align: "start",
      },
    },
    {
      popover: {
        title: "Resumo",
        description: "Total, Ativos e Inativos mostram rapidamente quantos serviços estão cadastrados e quantos estão disponíveis para venda no momento.",
      },
    },
    {
      popover: {
        title: "Filtro por categoria",
        description: "Essas pílulas filtram a lista por categoria (Vidros, Placas, Corte/Gravação, Instalação, Acabamento, etc.), útil quando você tem muitos serviços cadastrados.",
      },
    },
    {
      popover: {
        title: "Lista ou Grade",
        description: "Alterne entre \"Lista\" (mais compacta, boa para comparar preços rápido) e \"Grade\" (cards visuais agrupados por categoria).",
      },
    },
    {
      element: tourElement("services-new-btn"),
      popover: {
        title: "Cadastrar um serviço novo",
        description: "Vamos abrir o formulário e preencher um exemplo, só para você ver quais campos existem (nada será salvo).",
        side: "bottom",
        align: "end",
        onNextClick: (_el, _step, opts) => goForward(opts.driver, openExampleService),
      },
    },
    {
      element: tourElement("service-form-name"),
      popover: {
        title: "Nome e preço",
        description: "Preenchemos com \"Serviço Exemplo\" e R$ 50,00 só para ilustrar.",
        side: "bottom",
        align: "start",
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(SERVICES_PAGE_TOUR_EVENTS.closeServiceModal);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      element: tourElement("service-form-pricing"),
      popover: {
        title: "Preço fixo ou por medida",
        description: "\"Preço fixo\" cobra um valor por unidade vendida. \"Por m²\" ou \"Por metro linear\" calcula o preço pela área ou comprimento informado na venda — ideal para vidros, placas e outros serviços sob medida.",
        side: "top",
        align: "start",
      },
    },
    {
      element: tourElement("service-form-image"),
      popover: {
        title: "Imagem do serviço",
        description: "Você pode enviar uma foto (JPG ou PNG, até 2 MB) para identificar o serviço visualmente no PDV. Vamos só mostrar onde fica — não vamos selecionar um arquivo de verdade aqui no tour.",
        side: "top",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(SERVICES_PAGE_TOUR_EVENTS.closeServiceModal);
          dispatchTourEvent(SERVICES_PAGE_TOUR_EVENTS.openEditService);
          goForward(opts.driver, () => waitForElement('[data-tour="service-form-name"]', 2500));
        },
      },
    },
    {
      // Passo opcional: só aparece se havia ao menos um serviço cadastrado
      // (o componente decide isso internamente ao receber o evento). Se a
      // lista estava vazia, o modal não abre e skipMissingElement pula o
      // passo com segurança.
      element: tourElement("service-form-name"),
      popover: {
        title: "Editar um serviço existente",
        description: "Clicando no ícone de lápis \"Editar\", em qualquer linha ou card, você abre este mesmo formulário já preenchido, pronto para atualizar preço, categoria ou imagem. Vamos fechar sem salvar.",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(SERVICES_PAGE_TOUR_EVENTS.closeServiceModal);
          opts.driver.moveNext();
        },
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(SERVICES_PAGE_TOUR_EVENTS.closeServiceModal);
          goBack(opts.driver, openExampleService);
        },
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe cadastrar e editar serviços. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface ServicesPageTourHandle {
  start: () => void;
}

/**
 * Tour de página de Serviços (driver.js). Mostra o cadastro completo (nome,
 * preço fixo x por medida, área de imagem só com spotlight) e a edição de um
 * serviço existente (com fallback seguro se a lista estiver vazia), sempre
 * fechando via closeModal. Nunca simula o submit do form (handleSave faz
 * POST/PUT real), nunca abre o modal de exclusão (deleteTarget →
 * handleDelete, DELETE real), nunca chama handleToggle (PUT real fora do
 * modal) nem handleImageFile (POST real de upload de imagem — nunca simulado
 * neste tour). Disparado sob demanda pelo botão "?" — sem persistência de
 * "já viu".
 */
const ServicesPageTour = forwardRef<ServicesPageTourHandle>(function ServicesPageTour(_props, ref) {
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
          // Segurança extra: garante que o modal de exemplo não fica aberto
          // se o usuário sair do tour no meio dos passos.
          dispatchTourEvent(SERVICES_PAGE_TOUR_EVENTS.closeServiceModal);
          cleanupDragCursor();
          d.destroy();
        },
      });
      driverRef.current = d;
      d.drive();
    };

    // Carregamento assíncrono (fetchServices) — espera o container da página
    // estar de fato no DOM antes de iniciar o drive.
    waitForElement('[data-tour="services-page"]')
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

export default ServicesPageTour;
export { SERVICES_PAGE_TOUR_EVENTS };
