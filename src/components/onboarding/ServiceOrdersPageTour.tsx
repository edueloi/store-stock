import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { tourElement, waitForElement, simulateClick, cleanupDragCursor } from "./tour-utils";

// Tour 100% spotlight/popover, sem canal de eventos com ServiceOrders.tsx —
// fica inteiramente na listagem. Mesma armadilha do Orçamento: o botão "Nova
// Ordem de Serviço" chama navigate("/admin/ordens-servico/novo"), e essa
// rota (ServiceOrderNew.tsx) faz POST real assim que monta, criando uma OS
// vazia no banco só de navegar pra lá. Por isso este tour NUNCA chama
// navigate para essa rota nem para "/admin/ordens-servico/:id" — o botão é
// só indicado com o cursor fantasma (simulateClick), que apenas anima um
// clique visual sem tocar no onClick real do elemento. O mesmo vale para as
// linhas da tabela, que abrem o detalhe real (autosave agressivo) ao clicar
// — nenhum passo clica numa linha.

function buildSteps(): DriveStep[] {
  return [
    {
      popover: {
        title: "Conhecendo Ordens de Serviço",
        description: "Este tour mostra como controlar equipamentos recebidos para conserto. Nenhuma ordem de serviço será criada, aberta ou excluída de verdade.",
      },
    },
    {
      element: tourElement("service-orders-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui você recebe equipamentos de clientes para conserto, acompanha o checklist de reparo etapa por etapa e fatura o serviço quando concluído.",
        side: "top",
        align: "start",
      },
    },
    {
      popover: {
        title: "Busca e filtro de etapa",
        description: "Busque por número, cliente, marca ou modelo do equipamento, e filtre pela etapa do checklist. Se o módulo Gráfica estiver desligado na sua loja, as etapas \"Aguardando arte\" e \"Arte finalizada\" não aparecem nesse filtro.",
      },
    },
    {
      element: tourElement("service-orders-new-btn"),
      onHighlightStarted: () => {
        simulateClick('[data-tour="service-orders-new-btn"]');
      },
      popover: {
        title: "Abrir uma nova ordem de serviço",
        description: "Esse botão abre um formulário completo para cadastrar o equipamento, o cliente e o checklist de reparo. Não vamos abri-lo de verdade aqui no tour — só indicar onde fica.",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: tourElement("service-orders-table"),
      popover: {
        title: "Lista de ordens de serviço",
        description: "Cada linha mostra número, cliente, equipamento, etapa (badge colorido), responsável, valor e data. Marcando várias com a caixa de seleção você pode baixar um .zip com os PDFs ou excluir em massa — não vamos clicar em nada disso aqui, e clicar na linha abriria o detalhe completo da ordem.",
        side: "top",
        align: "start",
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe como funcionam as ordens de serviço. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface ServiceOrdersPageTourHandle {
  start: () => void;
}

/**
 * Tour de página de Ordens de Serviço (driver.js). Spotlight + popover
 * explicando os filtros, botão "Nova Ordem de Serviço" e a tabela. Sem canal
 * de eventos — fica 100% na listagem. NUNCA chama a função navigate()
 * importada do react-router para "/admin/ordens-servico/novo" nem
 * "/admin/ordens-servico/:id": o botão "Nova Ordem de Serviço" é só indicado
 * com o cursor fantasma (simulateClick), que não toca no onClick real do
 * elemento, e nenhum passo clica numa linha da tabela. Disparado sob demanda
 * pelo botão "?" — sem persistência de "já viu".
 */
const ServiceOrdersPageTour = forwardRef<ServiceOrdersPageTourHandle>(function ServiceOrdersPageTour(_props, ref) {
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

    waitForElement('[data-tour="service-orders-page"]')
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

export default ServiceOrdersPageTour;
