# BoxSys Pet — V2 Ocean Mint

Tema atualizado para pet shop, com paleta verde-petróleo, turquesa, menta, creme e amarelo.

## Instalação
1. Faça commit/backup da pasta original do tema pet.
2. Substitua **apenas** os nove arquivos correspondentes nessa pasta pelos desta pasta.
3. Os arquivos usam imports relativos originais; mantenha a pasta junto a `StoreLayout` e `store-routing`.
4. Rode `npm run build` e verifique a configuração do projeto.

## Características
- Responsividade e ajustes para toque e leitura em telas pequenas.
- Transições nos cards, bolhas de categorias, botões, menu e hero.
- `prefers-reduced-motion` respeitado.
- SEO existente, `tenant`, `sf`, rotas e `previewTheme` preservados.
- Estoque e quantidade controlados no formulário de produto, com reset ao trocar de produto.
- Catálogo não oferece ordenação por preços/ofertas quando eles são ocultos.

## Validar antes de publicar
Verificar dados reais de multi-tenant, produtos com variações/SKUs, regra de estoque, cart e checkout. Não foram executados build ou testes do seu repositório completo.

## Personalizar cor
O acento respeita `--theme-accent`; caso não exista, o padrão é `#0da999`. Outras cores ficam no topo de `styles.css` (`--pt-ink`, `--pt-cream`, `--pt-sand`, etc.).
