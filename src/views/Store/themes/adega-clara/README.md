# Adega Brisa

Segundo modelo de adega, independente da Adega Noturna. Identificador: `adega_clara`. Disponível em **Configurações → Vitrine → Modelos → Sabores & Presentes → Adega Brisa**. A seleção e o salvamento continuam pelo painel da loja.

A identidade usa creme, vinho, verde suave, fotografia com luz natural e títulos em Cormorant Garamond. Menu, abertura editorial, catálogo, história, ficha de produto, rodapé e sacola têm estilos exclusivos com prefixo `brs-`.

## Personalização das imagens

- Os banners cadastrados em **Banners do carrossel** substituem as fotos, os textos e os botões padrão.
- Sem carrossel cadastrado, **Banner Principal** substitui a fotografia de campanha.
- Fotos institucionais priorizam o Banner Principal e depois as fotos do carrossel, antes das imagens padrão.
- As categorias usam a capa cadastrada em `cover_url`, ou uma foto de produto quando não há capa.
- A galeria, as fotos e os detalhes dos produtos vêm do cadastro da loja.
- Nenhuma fotografia gerada é gravada automaticamente nas configurações do lojista.

Prefira fotografias com o assunto principal ao centro, pois o recorte muda no celular.

## Pedido e acessibilidade

A sacola clara mantém descontos, quantidades, variações, limite de estoque e seleção salva no navegador. O pedido pelo WhatsApp preserva acentos e caracteres especiais. As demais modalidades usam o checkout existente por composição.

O diálogo contém o foco, fecha por Escape e devolve o foco ao controle anterior. O carrossel tem navegação, pausa e gesto de deslizar. Animações respeitam a preferência de movimento reduzido.

As regras de comércio são compartilhadas pelo módulo `kit.ts`; o modelo tem páginas, composição e CSS próprios.

## Fotografias e prompts

Geradas com a ferramenta integrada `image_gen`, convertidas para WebP e salvas no projeto:

- `public/store-assets/adega-brisa-hero-v1.webp`
- `public/store-assets/adega-brisa-moment-v1.webp`

### Campanha principal

Use case: ads-marketing. Asset type: photographic hero for Adega Brisa, a light elegant Brazilian beverage storefront. Create a premium natural editorial still-life photograph in a square composition. On a warm ivory travertine table: one chilled pale rosé wine bottle with a blank cream label, two graceful stemmed wine glasses with pale rosé, a subtle green beer bottle with no branding, a small ceramic dish of green olives and a cut blood orange. Sunlit Mediterranean inspired Brazilian patio atmosphere, pale beige plaster wall, beautiful afternoon sunlight and soft leaf shadows, warm cream and muted blush palette, real condensation and realistic glass, refined genuine tactile material, shallow depth of field. Main products centered in composition, generous breathing room, photographed slightly above table level. Beautiful relaxed aperitivo scene, sophisticated and inviting. No people, no text, no logos, no watermark, not a website mockup.

### Campanha de encontros

Use case: ads-marketing. Asset type: second photographic campaign image for Adega Brisa, a light premium Brazilian beverage storefront. A wide landscape editorial photograph of a relaxed sunlit aperitivo table: a beautiful crystal tumbler of amber drink with large clear ice, two unlabeled chilled green beer bottles, one small glass of sparkling water and a halved orange, on warm cream stone with a folded natural linen napkin. Refined daytime beverage shop aesthetic, soft ivory and sand surroundings, gentle olive leaf shadows on a beige plaster wall, warm afternoon sunlight, luminous realistic glass and condensation, true photographic textures, candid yet carefully composed. Products arranged on right two-thirds, breathing room on the left, muted sage and amber accents. No humans, no text, no words, no logos, no watermark. Photograph only, not website UI.

## Validação

O teste `scripts/verify-adega-brisa-theme.cjs` usa dados fictícios e intercepta as APIs e a abertura do WhatsApp. Nenhum pedido ou mensagem é enviado.

Com Node 22, Playwright e um servidor Vite local, execute o script. `THEME_TEST_URL`, `PLAYWRIGHT_MODULE` e `BROWSER_PATH` permitem indicar as instalações. As capturas ficam em `output/adega-brisa/`.

A verificação cobre as quatro páginas em 320, 390, 768 e 1440 pixels, carrosséis, menu, busca, categorias, ordenação, carrinho, desconto, estoque, variações, persistência, checkout online, imagens personalizadas, preços ocultos e loja vazia.

A compilação do frontend Vite concluiu; a etapa global de PWA encontrou o mesmo limite de cache já observado no projeto: o chunk principal de 5,47 MB excedeu os 5 MiB configurados. A checagem TypeScript apontou erros fora deste modelo (backend, PDV, orçamento e transações). Nenhum erro de TypeScript foi apontado nos arquivos do novo tema. Essas pendências globais não foram alteradas.

