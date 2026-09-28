import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, simulateClick, cleanupDragCursor } from "./tour-utils";

// Canal de comunicação com Technicians.tsx — abre o modal "Novo Técnico" de
// verdade (openNew) e preenche campos de exemplo, mas nunca chama handleSave
// (POST/PUT real), handleDelete (window.confirm, nunca referenciado aqui) nem
// handleToggleActive (PUT real fora do modal — só indicado com simulateClick).
// Fechar sempre via setShowModal(false).
const TECHNICIANS_PAGE_TOUR_EVENTS = {
  openNewTechnician: "page-tour:technicians:open-new-technician",
  fillTechnician: "page-tour:technicians:fill-technician",
  closeTechnicianModal: "page-tour:technicians:close-technician-modal",
  openEditTechnician: "page-tour:technicians:open-edit-technician",
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
  const openExampleTechnician = () => {
    dispatchTourEvent(TECHNICIANS_PAGE_TOUR_EVENTS.openNewTechnician);
    return waitForElement('[data-tour="technician-form-name"]').then(() => {
      dispatchTourEvent(TECHNICIANS_PAGE_TOUR_EVENTS.fillTechnician, {
        name: "Técnico Exemplo",
        phone: "(11) 97777-0000",
      });
    });
  };

  return [
    {
      popover: {
        title: "Conhecendo Técnicos",
        description: "Este tour mostra como cadastrar técnicos e prestadores de serviço. Nada será criado, alterado ou excluído de verdade.",
      },
    },
    {
      element: tourElement("technicians-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui você cadastra técnicos e prestadores de serviço para poder atribuí-los às Ordens de Serviço, sabendo sempre quem é responsável por cada atendimento.",
        side: "top",
        align: "start",
      },
    },
    {
      popover: {
        title: "Buscar técnico",
        description: "Busque por nome para encontrar rapidamente um técnico específico na lista.",
      },
    },
    {
      element: tourElement("technicians-new-btn"),
      popover: {
        title: "Cadastrar um técnico novo",
        description: "Vamos abrir o formulário e preencher um exemplo, só para você ver quais campos existem (nada será salvo).",
        side: "bottom",
        align: "end",
        onNextClick: (_el, _step, opts) => goForward(opts.driver, openExampleTechnician),
      },
    },
    {
      element: tourElement("technician-form-name"),
      popover: {
        title: "Nome e telefone",
        description: "Preenchemos com \"Técnico Exemplo\" e um telefone só para ilustrar. Você também pode vincular o técnico a um usuário do sistema, para facilitar a identificação no PDV. Vamos fechar este exemplo sem salvar.",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(TECHNICIANS_PAGE_TOUR_EVENTS.closeTechnicianModal);
          dispatchTourEvent(TECHNICIANS_PAGE_TOUR_EVENTS.openEditTechnician);
          goForward(opts.driver, () => waitForElement('[data-tour="technician-form-name"]', 2500));
        },
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(TECHNICIANS_PAGE_TOUR_EVENTS.closeTechnicianModal);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      // Passo opcional: só aparece se havia ao menos um técnico cadastrado
      // (o componente decide isso internamente ao receber o evento). Se a
      // lista estava vazia, o modal não abre e skipMissingElement pula o
      // passo com segurança.
      element: tourElement("technician-form-name"),
      popover: {
        title: "Editar um técnico existente",
        description: "Clicando no ícone de lápis \"Editar\", em qualquer card da lista, você abre este mesmo formulário já preenchido, pronto para atualizar contato ou observações. Vamos fechar sem salvar.",
        side: "bottom",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(TECHNICIANS_PAGE_TOUR_EVENTS.closeTechnicianModal);
          opts.driver.moveNext();
        },
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(TECHNICIANS_PAGE_TOUR_EVENTS.closeTechnicianModal);
          goBack(opts.driver, openExampleTechnician);
        },
      },
    },
    {
      element: tourElement("technician-toggle-active-btn"),
      onHighlightStarted: () => {
        simulateClick('[data-tour="technician-toggle-active-btn"]');
      },
      popover: {
        title: "Ativar ou desativar",
        description: "Esse botão ativa ou desativa o técnico. Um técnico inativo deixa de aparecer para seleção nas Ordens de Serviço, mas o histórico dele é mantido. Não vamos clicar de verdade aqui no tour.",
        side: "top",
        align: "start",
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe cadastrar, editar e ativar/desativar técnicos. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface TechniciansPageTourHandle {
  start: () => void;
}

/**
 * Tour de página de Técnicos (driver.js). Mostra o cadastro de um técnico
 * novo e a edição de um técnico existente (com fallback seguro se a lista
 * estiver vazia), sempre fechando sem salvar. O botão de ativar/desativar é
 * apenas indicado com o cursor fantasma (simulateClick), nunca clicado de
 * verdade. Nunca chama handleSave (POST/PUT real), handleDelete
 * (window.confirm) nem handleToggleActive (PUT real fora do modal) — só
 * abre/preenche/fecha o modal via setShowModal/setEditing, exatamente como o
 * botão "Cancelar" do modal faz. Disparado sob demanda pelo botão "?" — sem
 * persistência de "já viu".
 */
const TechniciansPageTour = forwardRef<TechniciansPageTourHandle>(function TechniciansPageTour(_props, ref) {
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
          dispatchTourEvent(TECHNICIANS_PAGE_TOUR_EVENTS.closeTechnicianModal);
          cleanupDragCursor();
          d.destroy();
        },
      });
      driverRef.current = d;
      d.drive();
    };

    // Carregamento assíncrono (fetchTechnicians + fetchTeamUsers) — espera o
    // container da página estar de fato no DOM antes de iniciar o drive.
    waitForElement('[data-tour="technicians-page"]')
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

export default TechniciansPageTour;
export { TECHNICIANS_PAGE_TOUR_EVENTS };
