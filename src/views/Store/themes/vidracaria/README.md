# Vitra — catálogo e projetos da vidraçaria

- **Configurações da loja → Checkout, Entrega & Integrações → Catálogo da vidraçaria**: habilita a solicitação de orçamento. O padrão é desligado. Desligado, nenhum menu/botão de projeto aparece, `/orcamento` volta ao catálogo e a API recusa novas solicitações.
- **Catálogo → editar produto → Catálogo virtual**: descrição, especificações, entrega e instalação e configuração das medidas/desenho por produto. Abas sem texto não aparecem no site. Medidas são ligadas por padrão apenas nos produtos já vendidos por m² ou metro linear; ferragens e kits por unidade não recebem campos extras automaticamente.
- **Estoque e Grades → Grades & Variações**: cadastre espessura, cor, dimensão fixa e acabamento como opções reais. A vitrine não inventa opções ou adicionais de preço. Uma dimensão fixa cadastrada como variação é diferente das medidas livres habilitadas por produto.
- Fotos do produto: galeria existente no cadastro. Banner: imagem principal/banners da loja. Fotos de ambientes: editor próprio na configuração da vidraçaria. Capas: cadastro de categorias. Nenhuma alteração do modelo substitui fotos ou dados dos produtos.

O cliente pode montar um projeto com produtos e serviços ativos do mesmo lojista, configurar opções, informar medidas em cm/m/mm, duplicar/editar/remover peças e pedir orientação quando permitido. O desenho é ilustrativo. O preço é estimado pela unidade configurada e mínimo faturável; itens sem medida confirmada ou preço público ficam sob consulta. O projeto é guardado na sessão do navegador, sem armazenar dados de contato.

O envio gera diretamente **Orçamentos → Rascunho**, com origem **Catálogo virtual**, peças, medidas, opções, contato e observações. Não cria venda, pagamento, reserva de estoque ou produção. Preços e opções são conferidos novamente no servidor. O cliente recebe o número da solicitação; a loja revisa o orçamento e usa o fluxo existente de aprovação/conversão. Medidas e escolhas acompanham a conversão em venda. O código de reenvio evita duplicação após falha de conexão.

Migração aditiva: `20261021160000_glass_catalog_details` adiciona `products.storefront_details` (JSON opcional). Não altera dados de produtos existentes nem habilita orçamento automaticamente.

Validação:

```powershell
node node_modules/tsx/dist/cli.mjs --test scripts/verify-glass-catalog.ts
# Com Vite em execução e PLAYWRIGHT_MODULE/BROWSER_PATH configurados:
node scripts/verify-glass-store-ui.cjs
```

Os testes de interface usam APIs simuladas e não enviam pedidos reais.
