# Adega Noturna

Tema próprio com fotografia de campanha, cores de carvão e latão, tipografia DM Sans, carrosséis, categorias ilustradas, catálogo com filtros, página de produto, história, rodapé, contato e navegação inferior no celular.

## Trocar imagens e textos

As fotografias geradas são padrões do tema. Nenhuma imagem é gravada automaticamente no cadastro da loja.

- **Configurações → Vitrine → banners do carrossel:** envie suas imagens e edite títulos, descrições, links e botões. Os banners cadastrados substituem os padrões por completo. O intervalo permite desligar a troca automática com zero segundos.
- **Banner Principal:** substitui a fotografia padrão quando não há banners de carrossel. Também personaliza a abertura do catálogo e as fotos institucionais.
- **Categorias:** a capa cadastrada em `cover_url` tem prioridade. Sem capa, a vitrine usa uma foto de um produto da categoria.
- **Produtos:** fotos, galeria, preços, nomes, opções e estoque vêm do cadastro dos produtos.
- A seção institucional usa o Banner Principal; sem ele, usa uma foto do carrossel cadastrado; sem fotos cadastradas, usa o padrão de vinho. A página Sobre segue a mesma regra.
- Nome, logo, slogan, apresentação, contatos, redes sociais, endereço e horários continuam vindo das configurações da loja.

Para os banners, prefira fotos horizontais, com espaço para o texto à esquerda e o assunto principal à direita. No celular, a imagem é recortada para preencher a tela.

## Carrinho

`Cart.tsx` implementa a sacola exclusiva do tema. O painel oferece edição de quantidades, remoção, subtotal, variantes, limite de estoque, estado vazio, foco contido no diálogo, fechamento por Escape e retorno do foco. A seleção fica salva no navegador e é conferida contra o catálogo ao restaurar.

O pedido pelo WhatsApp monta a mensagem com quantidades, opções e valores da sacola, preservando acentos e caracteres especiais. Telefones brasileiros com DDD recebem o prefixo 55 quando necessário. Reservas, pedidos online e solicitações usam os manipuladores de checkout do sistema. O formulário existente é compartilhado com a sacola por composição, mantendo as regras de entrega e pagamento.

Animações respeitam a preferência de movimento reduzido. O banner tem controles de navegação, pausa e gesto de deslizar. Produtos podem ser percorridos com as setas, o teclado ou o toque.

## Imagens geradas

Criadas com a ferramenta integrada `image_gen`, convertidas para WebP e salvas no projeto:

- `public/store-assets/adega-night-hero-v1.webp`
- `public/store-assets/adega-wine-hero-v1.webp`

Prompt da primeira imagem:

> Use case: ads-marketing. Asset type: full-width photographic website hero background for an elegant Brazilian night-time beverage shop, Adega Noturna. Create a cinematic premium editorial still-life photograph in wide landscape 16:9 composition. A chilled dark green beer bottle with no label, a short crystal glass of golden amber drink and large clear ice cubes, condensation water droplets, a small cut lime, on a dark stone bar counter. Main objects grouped on right half, the left half is dark atmospheric negative space reserved for website text. Very dark charcoal background, warm golden light from the right, subtle muted forest green shadows, authentic tactile photographic textures, analog film grain, shallow depth of field, rich realistic reflections. Sophisticated neighborhood evening atmosphere, inviting, not nightclub neon. No people. No text, no words, no logos, no watermark. This is a photograph asset only, not a website mockup.

Prompt da segunda imagem:

> Use case: ads-marketing. Asset type: second landscape photographic hero banner for premium Brazilian beverage shop Adega Noturna. Wide 16:9 editorial photograph of a deep burgundy red wine bottle with no label, one elegant stemmed wine glass with red wine, dark purple grapes, on a charcoal stone counter in a stylish dimly lit wine bar. Objects on the RIGHT HALF of the image, left half empty dark charcoal negative space for website typography. Warm amber side lighting, subdued burgundy and golden tones, genuine glass reflections, subtle film grain, luxurious cinematic photography, tactile natural details, shallow depth of field. No people, no text, no labels, no logos, no watermark, no illustration, no UI mockup.

## Verificação

`scripts/verify-adega-theme.cjs` usa dados simulados, sem criar pedidos reais. Com um servidor Vite disponível, execute com Node 22 e Playwright. `THEME_TEST_URL` configura a URL; `PLAYWRIGHT_MODULE` e `BROWSER_PATH` permitem indicar instalações locais.

O teste confere início, catálogo, produto e Sobre em 320, 390, 768 e 1440 pixels, carrosséis, busca, categorias, ordenação, desconto, estoque, variações, persistência, sacola, checkout online, imagens personalizadas, preços ocultos e loja vazia. As capturas em `output/adega/` usam produtos fictícios para validar o layout.

A compilação Vite do aplicativo foi concluída, mas o comando global de build encontrou o limite de precache do PWA: o chunk principal ultrapassou os 5 MiB configurados. A checagem global TypeScript também apontou erros em arquivos fora do tema. Esses problemas globais não foram alterados neste trabalho.
