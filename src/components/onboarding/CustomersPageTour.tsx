import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { tourElement, waitForElement, cleanupDragCursor } from "./tour-utils";

// O formulário de cliente agora é uma página própria (/admin/customers/novo),
// então o tour só aponta o botão e não abre o formulário.

function buildSteps(): DriveStep[] {
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
        description: "Abre a página de cadastro, com abas Geral, Endereço, Comercial, Fiscal e Dados pessoais. Lá você pode buscar dados pelo CNPJ e definir limites de crédito e consignação (até quanto o cliente pode dever fiado ou levar em consignação).",
        side: "bottom",
        align: "end",
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
 * cards de resumo, abas, alternância Grade/Tabela, busca e o botão de novo
 * cliente (que leva à página /admin/customers/novo). Disparado sob demanda
 * pelo botão "?" — sem persistência de "já viu".
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
