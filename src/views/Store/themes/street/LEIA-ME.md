# Street Drop — editorial

Hero amplo com campanha própria, catálogo com busca, categoria e ordenação, rodapé discreto e páginas internas alinhadas. Sem parallax, faixas animadas e categorias decorativas repetidas.

Os slides cadastrados têm prioridade. Sem slides, o hero usa o banner da loja; sem banner, usa `public/store-assets/street-editorial-hero-v1.jpg`. As fotos dos produtos continuam vindo do catálogo. Nome, logo, títulos e botões personalizados são preservados, assim como as rotas de prévia, preços ocultos, favoritos, opções e estoque.

A imagem padrão foi criada com ImageGen integrado e codificada em JPEG para carregar mais rápido. Prompt utilizado:

> Use case: ads-marketing. Asset type: wide 3:2 landscape hero campaign photograph for an original premium streetwear ecommerce store. Photorealistic contemporary fashion editorial, adult male model in an oversized heavy cotton ecru T-shirt, straight black cargo pants and understated unbranded cream sneakers, standing naturally on the RIGHT side beside raw dark concrete architecture in a real urban street. Full body, candid calm attitude, refined contemporary clothing, realistic human proportions and textile details. Left 45% largely empty charcoal concrete wall for white headline added in HTML. Palette black, white, concrete gray, desaturated natural color, deep soft afternoon shadows, subtle analog photographic grain. Serious, understated, sophisticated clothing campaign, not sports action, not cartoon, no neon, no stickers, no artificial graphics, no text, no lettering, no logos, no watermark. This is a campaign image, not a catalog product photo or webpage screenshot.

Verificação: `scripts/verify-street-themes.cjs` usa Playwright e API simulada para conferir layout, hero, catálogo e compra sem criar pedidos reais.
