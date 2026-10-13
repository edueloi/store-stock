# BoxSys Store — Fragrance Atelier V2

Tema de perfumaria/beleza. Substitua os oito arquivos na pasta correspondente ao tema atual (mesmo nível relativo de `kit.ts`, `StoreFront.tsx` etc). **Não altere os arquivos dos outros temas.**

## Preservado
- Dados e textos de `tenant` e `tenant.policies.storefront` (`sf`)
- Metadados via `StoreSEO`, imagens e URLs
- `previewTheme` nas rotas via `useKit().path`
- Preços ocultos e modo pedido; produtos e categorias dinâmicos
- Favoritos, carrinho, variações, imagens e disponibilidade

## Importante antes de publicar
- Testar `npm run build` e fluxo de pedido com API real. Não há repositório completo neste pacote.
- Verificar importação do Tailwind já usado no projeto (o tema também utiliza algumas classes utilitárias de origem).
- O campo de observação não é exibido na nova página de produto porque o contrato de `addToCart` apresentado não possui suporte nativo comprovado para observações separadas de variações. Integrar ao modelo de pedido antes de adicioná-lo.
- Verificar regras de variações dependentes e estoque por combinação no backend.
- Testar checkout_mode=order_request, hide_prices, estoque desativado, sem fotos, celular 360px e previewTheme.
- A renderização é exclusivamente client-side; SEO de compartilhamento/crawlers pode exigir SSR/prerender além de StoreSEO.
