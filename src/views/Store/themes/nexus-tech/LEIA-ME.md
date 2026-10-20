# Nexus Tech

Navegação horizontal com marca à esquerda, tipografia do hero mais leve e faixa de categorias em maiúsculas. A campanha bento existente e os slides cadastrados são preservados.

Os lançamentos avançam a cada 4,2 segundos quando visíveis. Setas laterais permitem avançar e voltar; a barra de rolagem fica oculta e o gesto de deslizar continua disponível. O automático pausa durante hover, foco, interação manual, aba em segundo plano ou quando a área sai de vista. A preferência de movimento reduzido desliga o automático. Com poucos produtos, as setas somem.

O comparativo e o bloco de exploração por categoria da página inicial foram removidos. As categorias continuam acessíveis no menu e nos filtros do catálogo.

O rodapé usa uma superfície contínua em grafite com marca, navegação, contato e horários. Foram removidos os cartões brancos e a chamada duplicada. As regras visuais antigas em `src/index.css` deixaram de sobrescrever o tema.

Verificação: `scripts/verify-nexus-theme.cjs`, com APIs simuladas e sem pedidos reais.
