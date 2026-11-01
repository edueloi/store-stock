# M&M — vidros e alumínios

Perfil `policies.storefront.brand_identity: "mm-glass"`, restrito ao modelo `vidracaria`. Mantém produtos, categorias, fotos de produtos, estoque e fluxo de pedido existentes. As imagens são ambientes ilustrativos gerados, apresentados como inspiração, sem atribuição de obra executada pela empresa.

O hero usa toda a largura e uma composição própria no celular. Banner personalizado continua prioritário. Os controles de visibilidade Vitra de hero, destaques, categorias, galeria e encerramento permanecem disponíveis. O texto institucional completo fica na página Sobre. Produto e carrinho usam os fluxos nativos, com acabamento exclusivo em CSS.

Validação: `node scripts/verify-mm-store.cjs` (componentes React reais em DOM simulado) e `npm run build`. O teste não substitui revisão visual em navegador.

## Imagens

Modo: ferramenta integrada `image_gen.imagegen`, geração de duas imagens novas, sem referências. Otimizadas em WebP com Sharp, sem alteração do conteúdo.

- `public/store-assets/mm-glass/shower-hero-v1.webp`: hero desktop e encerramento.
- `public/store-assets/mm-glass/windows-portrait-v1.webp`: hero móvel e seção editorial.

### Prompt do hero

Use case: ads-marketing. Asset type: photographic full-width website hero for a Brazilian glass and aluminum distributor. Wide landscape 16:9 architectural editorial photograph of an elegant contemporary bathroom featuring a large transparent frameless glass shower enclosure on the right, precise polished chrome hinges and handle, subtle green glass edges; floor-to-ceiling slim charcoal aluminum framed window beyond it opening onto lush greenery. Ivory limestone, soft daylight, realistic clear glass reflections, exact believable construction. Left third is a quiet deep shadowed navy-gray stone wall with usable negative space for white website copy. Premium material detail, natural architectural photography, no people, no text, no logos, no watermark, no collage.

### Prompt vertical

Use case: ads-marketing. Asset type: portrait editorial photograph for a glass distributor website mobile hero and architecture section. Tall 3:4 architectural photograph of a contemporary Brazilian interior featuring generous floor-to-ceiling glass sliding doors with slender graphite aluminum frames, beautiful crisp clear glass reflections and precise metal tracks, opening onto a lush planted courtyard; pale limestone floor, very restrained furnishing. Main glass doors clearly visible in upper two thirds, lower third dark cool navy shaded stone for white text overlay. Premium architectural magazine photography, elegant natural daylight, believable construction, no people, no text, no logos, no watermark.
