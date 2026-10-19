# Beauty Studio — editorial

Skincare e autocuidado em marfim, pedra e verde-sálvia. Hero amplo, catálogo com busca, categoria e ordenação, rodapé discreto e páginas internas com a mesma identidade. Sem parallax, arcos decorativos e animações de entrada.

O hero usa os slides cadastrados pela loja; sem slides, usa `tenant.banner_url`; sem banner, usa `public/store-assets/beauty-editorial-hero-v1.jpg`. Os títulos e botões personalizados continuam disponíveis. As fotos do catálogo vêm exclusivamente dos produtos cadastrados.

A imagem padrão foi criada com a ferramenta integrada ImageGen e codificada em JPEG para o site. Prompt utilizado:

> Use case: ads-marketing. Asset type: wide 3:2 landscape hero campaign photograph for a sophisticated skincare ecommerce website. Premium editorial still life, unbranded frosted ivory serum bottle with glass pipette, elegant white moisturizer jar and one matte sage green cleanser tube, arranged on pale honed limestone near the RIGHT side of the frame. Warm ivory plaster wall, natural window light and soft leaf shadows, tactile real glass and ceramic, gentle water reflections, quiet contemporary spa aesthetic. Left 45% calm uncluttered negative space in warm ivory for dark HTML headline. Palette exclusively ivory, oat, stone and muted sage, understated and expensive. Realistic luxury skincare product photography, careful light and surface texture, no saturated pink, no cartoon style, no arches, no text, no labels, no letters, no logos, no watermark. Products should feel substantial and photographic, not plastic 3D renders. The result is a campaign image, not a catalog product listing or webpage screenshot.

As rotas mantêm `previewTheme`. A compra preserva opções, estoque, favoritos, observações, preços ocultos e modo de solicitação. Endereço, contatos, horários e políticas vêm do cadastro.

Verificação: `scripts/verify-cosmetics-themes.cjs` com Vite em execução e Playwright. Usa API simulada, sem criar pedidos reais.
