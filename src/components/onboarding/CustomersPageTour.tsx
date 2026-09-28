import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { dispatchTourEvent, tourElement, waitForElement, cleanupDragCursor } from "./tour-utils";

// Canal de comunicação com Customers.tsx — abre o drawer "Novo Cliente" de
// verdade (openCreate) e preenche campos de exemplo via um evento fill-customer
// próprio (os campos da tela são states individuais fName/fPhone/fEmail, não
// um objeto form único). Nunca chama handleSave (POST/PUT real) nem
// handleDelete (abre confirmDialog → DELETE real, nunca referenciado aqui).
// Fechar sempre via closeForm.
const CUSTOMERS_PAGE_TOUR_EVENTS = {
  openNewCustomer: "page-tour:customers:open-new-customer",
  fillCustomer: "page-tour:customers:fill-customer",
  closeForm: "page-tour:customers:close-form",
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
  const openExampleCustomer = () => {
    dispatchTourEvent(CUSTOMERS_PAGE_TOUR_EVENTS.openNewCustomer);
    return waitForElement('[data-tour="customer-form-name"]').then(() => {
      dispatchTourEvent(CUSTOMERS_PAGE_TOUR_EVENTS.fillCustomer, {
        name: "Cliente Exemplo",
        phone: "(11) 99999-0000",
      });
    });
  };

  return [
    {
      popover: {
        title: "Conhecendo Clientes",
        description: "Este tour mostra como cadastrar clientes, acompanhar pendências e limites de crédito. Nenhum cliente será criado, alterado ou excluído de verdade.",
      },
    },
    {
      element: tourElement("customers-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui ficam todos os clientes da loja: contato, endereço, histórico de dívidas e notas internas, como preferências ou observações de risco.",
        side: "top",
        align: "start",
      },
    },
    {
      popover: {
        title: "Resumo de clientes",
        description: "\"Total Clientes\" conta todos os cadastrados. \"Com Pendências\" mostra quantos têm dívida em aberto. \"Saldo em Aberto\" soma tudo que está pendente. \"Clientes em Risco\" são os marcados manualmente por histórico de atraso ou problema.",
      },
    },
    {
      popover: {
        title: "Abas Todos / Com pendências",
        description: "A aba \"Todos os Clientes\" lista o cadastro completo. \"Com pendências\" filtra só quem tem alguma dívida em aberto, útil para cobranças.",
      },
    },
    {
      popover: {
        title: "Grade ou Tabela",
        description: "Alterne entre visualização em \"Grade\" (cards, bom para ver detalhes rápido) ou \"Tabela\" (mais compacta, boa para listas grandes). Sua escolha fica salva.",
      },
    },
    {
      popover: {
        title: "Buscar cliente",
        description: "Busque por nome, telefone ou e-mail para encontrar rapidamente um cliente específico.",
      },
    },
    {
      element: tourElement("customers-new-btn"),
      popover: {
        title: "Cadastrar um cliente novo",
        description: "Vamos abrir o formulário e preencher um exemplo, só para você ver quais campos existem (nada será salvo).",
        side: "bottom",
        align: "end",
        onNextClick: (_el, _step, opts) => goForward(opts.driver, openExampleCustomer),
      },
    },
    {
      element: tourElement("customer-form-name"),
      popover: {
        title: "Nome e telefone",
        description: "Preenchemos com \"Cliente Exemplo\" e um telefone só para ilustrar. Você também pode buscar dados automaticamente pelo CNPJ, quando for pessoa jurídica.",
        side: "bottom",
        align: "start",
        onPrevClick: (_el, _step, opts) => {
          dispatchTourEvent(CUSTOMERS_PAGE_TOUR_EVENTS.closeForm);
          goBack(opts.driver, () => Promise.resolve());
        },
      },
    },
    {
      element: tourElement("customer-form-credit"),
      popover: {
        title: "Limites de crédito e consignação",
        description: "Defina até quanto esse cliente pode dever fiado (crédito) ou levar em consignação. A tela usa esses limites para avisar quando o cliente estiver perto do teto. Vamos fechar este exemplo sem salvar.",
        side: "top",
        align: "start",
        onNextClick: (_el, _step, opts) => {
          dispatchTourEvent(CUSTOMERS_PAGE_TOUR_EVENTS.closeForm);
          opts.driver.moveNext();
        },
      },
    },
    {
      popover: {
        title: "Lista de clientes e badges de risco",
        description: "Cada card ou linha mostra saldo em aberto (vermelho) ou limite de crédito disponível (quando não há dívida). O selo \"Risco\" aparece nos clientes marcados manualmente por algum problema anterior, como atraso ou cheque sem fundo.",
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe cadastrar clientes e acompanhar pendências. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface CustomersPageTourHandle {
  start: () => void;
}

/**
 * Tour de página de Clientes (driver.js). Spotlight + popover explicando os
 * cards de resumo, abas, alternância Grade/Tabela e busca. Abre o drawer
 * "Novo Cliente" de verdade (openCreate) e preenche nome/telefone de exemplo
 * via evento fill-customer (campos são states individuais), sempre fechando
 * via closeForm — nunca chama handleSave (POST/PUT real) nem handleDelete
 * (que abre confirmDialog → DELETE real). Não há passo de edição: a edição de
 * cliente só existe na tela de detalhe, fora do escopo deste tour. Disparado
 * sob demanda pelo botão "?" — sem persistência de "já viu".
 */
const CustomersPageTour = forwardRef<CustomersPageTourHandle>(function CustomersPageTour(_props, ref) {
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
          // Segurança extra: garante que o drawer de exemplo não fica aberto
          // se o usuário sair do tour no meio dos passos.
          dispatchTourEvent(CUSTOMERS_PAGE_TOUR_EVENTS.closeForm);
          cleanupDragCursor();
          d.destroy();
        },
      });
      driverRef.current = d;
      d.drive();
    };

    // Carregamento assíncrono (fetchAll: customers + debtors em paralelo) —
    // espera o container da página estar de fato no DOM antes de iniciar.
    waitForElement('[data-tour="customers-page"]')
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

export default CustomersPageTour;
export { CUSTOMERS_PAGE_TOUR_EVENTS };
