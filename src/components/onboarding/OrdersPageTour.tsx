import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { tourElement, waitForElement, simulateClick, cleanupDragCursor } from "./tour-utils";

// Tour 100% spotlight/popover — sem canal de eventos com Orders.tsx, porque
// nenhuma ação deste tour muda state real da tela. Pedidos só são criados
// pelo PDV, então não há "Novo Pedido" aqui. O modal de detalhe de um pedido
// real nunca é aberto: o menu "Ações" dentro dele tem handleUpdateStatus,
// handleCancelOrder, handleDeleteSingle e emissão de NF-e reais — risco
// demais deixar isso visível/clicável ao fim do tour. Por isso nenhum passo
// clica numa linha da tabela.

function buildSteps(): DriveStep[] {
  return [
    {
      popover: {
        title: "Conhecendo Pedidos",
        description: "Este tour mostra como acompanhar as vendas da sua loja. Pedidos são criados automaticamente pelo PDV — não há cadastro manual nesta tela.",
      },
    },
    {
      element: tourElement("orders-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui você acompanha todos os pedidos vindos do PDV: catálogo, serviços ou os dois juntos, com status de pagamento, forma de pagamento e emissão de nota fiscal.",
        side: "top",
        align: "start",
      },
    },
    {
      popover: {
        title: "4 indicadores",
        description: "\"Total\" conta todos os pedidos do período filtrado. \"Pendentes\" são pedidos ainda não efetivados. \"Efetivados\" já foram concluídos. \"Cancelados\" foram estornados.",
      },
    },
    {
      popover: {
        title: "Filtros",
        description: "Busque por ID, cliente ou telefone, filtre por status (Pendente, Efetivado, Cancelado), por tipo (Catálogo, Serviços, Misto) e por período de data.",
      },
    },
    {
      popover: {
        title: "Tabela de pedidos",
        description: "Cada linha mostra o pedido, cliente, forma de pagamento (com badges coloridos: dinheiro, PIX, débito, crédito), data, total, status e situação da nota fiscal. Clicar numa linha abre o detalhe completo do pedido — não vamos abrir nenhum aqui no tour, pois lá dentro há ações reais como cancelar ou emitir nota.",
      },
    },
    {
      element: tourElement("orders-export-btn"),
      onHighlightStarted: () => {
        simulateClick('[data-tour="orders-export-btn"]');
      },
      popover: {
        title: "Exportar",
        description: "Esse botão exporta a lista filtrada de pedidos em Excel. Não vamos clicar de verdade aqui no tour.",
        side: "bottom",
        align: "end",
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe acompanhar seus pedidos. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface OrdersPageTourHandle {
  start: () => void;
}

/**
 * Tour de página de Pedidos (driver.js). Spotlight + popover explicando os
 * KPIs, filtros, tabela e exportação. Não há canal de eventos com a tela real
 * — este tour nunca muda nenhum state de Orders.tsx. Nunca clica numa linha
 * da tabela nem chama handleUpdateStatus/handleCancelOrder/
 * handleDeleteSingle/qualquer função de emissão de NF-e: o modal de detalhe
 * de um pedido real nunca é aberto pelo tour. O botão Exportar é só indicado
 * com o cursor fantasma (simulateClick), sem gerar arquivo de verdade.
 * Disparado sob demanda pelo botão "?" — sem persistência de "já viu".
 */
const OrdersPageTour = forwardRef<OrdersPageTourHandle>(function OrdersPageTour(_props, ref) {
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

    waitForElement('[data-tour="orders-page"]')
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

export default OrdersPageTour;
