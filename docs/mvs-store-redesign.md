# MVS Soluções — renovação da loja

Perfil `policies.storefront.brand_identity: "mvs"`, restrito ao modelo nativo `nexus_tech`. O modelo permanece selecionado; não é um site separado. A identidade usa verde profundo, tons claros e dourado, mantendo o logo e as fotos reais dos produtos.

Home com hero de largura total, duas campanhas padrão e composição própria para celular, vitrine de produtos e categorias reais, novidades e seções de iluminação e atendimento. Campanhas salvas em `hero_slides` têm prioridade. `banner_url` continua prioritário na primeira campanha padrão; `hero_autoplay_seconds: 0` desliga a rotação. Imagem móvel e controle de pausa são extensões opcionais do HeroSlider compartilhado, sem alterar o visual padrão dos demais modelos.

O catálogo da MVS tem busca sem acentos, categorias em seletor compacto, filtros, favoritos e carregamento em blocos de 12 produtos. As escolhas e quantidades são limpas ao trocar de produto. A sacola usa o estado de carrinho e os callbacks nativos de reserva, WhatsApp, pedido sob consulta e checkout online. Não altera preço, estoque ou pedido.

## Validação

`node scripts/verify-mvs-store.cjs` verifica componentes reais em DOM simulado: campanhas, pausa, toque, rolagem vertical, imagem móvel, campanha própria, menu, categoria, favoritos, busca, paginação, opções, SKU esgotado e sacola com callback de checkout. `npm run build` verifica build de produção e PWA. A automação visual do navegador estava indisponível nesta sessão; testes de DOM não verificam medidas reais de layout.

## Imagens e prompts

Modo: ferramenta integrada `image_gen.imagegen`, três imagens novas sem referência. Saída otimizada em WebP com Sharp. Os ambientes e os produtos das campanhas são ilustrativos; não são apresentados como obras executadas, nem substituem fotos reais do catálogo ou afirmam disponibilidade de modelos específicos.

- `public/store-assets/mvs/home-solutions-hero-v1.webp`
- `public/store-assets/mvs/practical-tools-hero-v1.webp`
- `public/store-assets/mvs/home-solutions-mobile-v1.webp`

### Casa e iluminação

Use case: ads-marketing. Asset type: full-width website hero for a Brazilian electrical, lighting and home solutions store. Wide 16:9 premium architectural photograph of a beautiful contemporary house entrance at blue hour. RIGHT half features a pale warm travertine wall with one elegant black rectangular wall sconce casting warm 3000K up/down light, a discreet white turret security camera tucked neatly under the roof overhang, a slim dark green front door and a few lush plants. Main products visible and realistic, refined quiet atmosphere, warm light contrasting deep forest green shadows. LEFT 45 percent is an empty softly shadowed dark forest green rendered wall, clean negative space intended for white website copy. High-end architectural advertising photography, no people, no signage, no text, no logos, no watermarks, no collage.

### Ferramentas e soluções práticas

Use case: ads-marketing. Asset type: wide 16:9 product campaign hero for an electrical, hardware and practical accessories store. Photorealistic premium studio photograph of an orange-and-black digital multimeter with blank dark screen, neatly coiled red and black test leads, compact precision screwdriver set in a dark case, a white three socket power strip and a small silver USB-C charging plug precisely arranged on olive graphite stone plinths in RIGHT half. Deep forest green seamless studio background, subtle golden warm rim light, believable real product materials and practical tools. LEFT 45 percent dark empty green negative space for website copy. Understated cinematic product photography, no people, no text, no brands, no logos, no watermark, no floating objects.

### Campanha móvel

Use case: ads-marketing. Asset type: portrait 3:4 mobile website hero for a Brazilian lighting, electrical and security store. Photorealistic elegant contemporary entrance at dusk, black rectangular up-and-down wall sconce glowing warmly on textured pale travertine wall, discreet white dome security camera under a slim dark roof overhang, dark forest green door edge and soft leafy plant. Architectural details and products occupy UPPER TWO THIRDS, LOWER THIRD is quiet deep forest green shaded wall negative space for white page typography. Premium realistic architectural photography, restrained warm golden 3000K lighting, no people, no text, no logos, no watermark, no collage.
