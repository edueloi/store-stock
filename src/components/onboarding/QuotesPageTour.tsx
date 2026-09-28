import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./onboarding-tour.css";
import { tourElement, waitForElement, simulateClick, cleanupDragCursor } from "./tour-utils";

// Tour 100% spotlight/popover, sem canal de eventos com Quotes.tsx — fica
// inteiramente na listagem. ARMADILHA conhecida desta tela: o botão "Novo
// Orçamento" chama navigate("/admin/orcamentos/novo"), e essa rota
// (QuoteNew.tsx) faz POST real assim que monta, criando um orçamento vazio
// no banco só de navegar pra lá, sem nenhum input do usuário. Por isso este
// tour NUNCA chama navigate para essa rota nem para "/admin/orcamentos/:id"
// — o botão "Novo Orçamento" é só indicado com o cursor fantasma
// (simulateClick), que apenas anima um clique visual sem tocar no onClick
// real do elemento. O mesmo vale para as linhas da tabela, que abrem o
// detalhe real (autosave) ao clicar — nenhum passo clica numa linha.

function buildSteps(): DriveStep[] {
  return [
    {
      popover: {
        title: "Conhecendo Orçamentos",
        description: "Este tour mostra como montar orçamentos profissionais para seus clientes. Nenhum orçamento será criado, aberto ou excluído de verdade.",
      },
    },
    {
      element: tourElement("quotes-page"),
      popover: {
        title: "Para que serve esta tela",
        description: "Aqui você monta orçamentos com produtos e serviços, envia para o cliente e, quando aprovado, converte direto em venda — sem redigitar nada.",
        side: "top",
        align: "start",
      },
    },
    {
      popover: {
        title: "4 indicadores",
        description: "\"Total\" conta todos os orçamentos (exceto rascunhos). \"Em Aberto\" são os enviados aguardando resposta do cliente. \"Convertidos\" já viraram venda. \"Valor em Aberto\" soma o total dos orçamentos ainda em aberto.",
      },
    },
    {
      popover: {
        title: "Busca e filtros",
        description: "Busque por cliente ou número do orçamento, e filtre pela situação: Rascunho, Aberto, Convertido ou Cancelado.",
      },
    },
    {
      element: tourElement("quotes-new-btn"),
      onHighlightStarted: () => {
        simulateClick('[data-tour="quotes-new-btn"]');
      },
      popover: {
        title: "Criar um novo orçamento",
        description: "Esse botão abre um editor completo, com produtos, serviços, descontos e prazo de validade. Não vamos abri-lo de verdade aqui no tour — só indicar onde fica.",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: tourElement("quotes-table"),
      popover: {
        title: "Lista de orçamentos",
        description: "Cada linha mostra número, cliente, data, validade, total e status com badge colorido (Rascunho, Aberto, Aguardando Aprovação, Aprovado, Convertido, Cancelado, Expirado). Os botões de baixar PDF e excluir ficam à direita — não vamos clicar em nenhum aqui, e clicar na linha abriria o editor completo do orçamento.",
        side: "top",
        align: "start",
      },
    },
    {
      popover: {
        title: "Pronto!",
        description: "Agora você já sabe como funcionam os orçamentos. Sempre que precisar rever este passo a passo, clique no botão de ajuda (?) no topo da página.",
      },
    },
  ];
}

export interface QuotesPageTourHandle {
  start: () => void;
}

/**
 * Tour de página de Orçamentos (driver.js). Spotlight + popover explicando
 * os stats, filtros, botão "Novo Orçamento" e a tabela. Sem canal de eventos
 * — fica 100% na listagem. NUNCA chama a função navigate() importada do
 * react-router para "/admin/orcamentos/novo" nem "/admin/orcamentos/:id": o
 * botão "Novo Orçamento" é só indicado com o cursor fantasma
 * (simulateClick), que não toca no onClick real do elemento, e nenhum passo
 * clica numa linha da tabela. Disparado sob demanda pelo botão "?" — sem
 * persistência de "já viu".
 */
const QuotesPageTour = forwardRef<QuotesPageTourHandle>(function QuotesPageTour(_props, ref) {
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

    waitForElement('[data-tour="quotes-page"]')
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

export default QuotesPageTour;
