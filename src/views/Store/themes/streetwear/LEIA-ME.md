# Streetwear & Skate — editorial

Hero amplo com campanha própria, catálogo com busca, categoria e ordenação, rodapé discreto e páginas internas alinhadas. Sem parallax, faixas animadas e categorias decorativas repetidas.

Os slides cadastrados têm prioridade. Sem slides, o hero usa o banner da loja; sem banner, usa `public/store-assets/streetwear-editorial-hero-v1.jpg`. As fotos dos produtos continuam vindo do catálogo. Nome, logo, títulos e botões personalizados são preservados, assim como as rotas de prévia, preços ocultos, favoritos, opções e estoque.

A imagem padrão foi criada com ImageGen integrado e codificada em JPEG para carregar mais rápido. Prompt utilizado:

> Use case: ads-marketing. Asset type: wide 3:2 landscape hero campaign photograph for a sophisticated streetwear and skate clothing ecommerce store. Premium photorealistic editorial of an adult woman with natural dark hair wearing an oversized washed black T-shirt and relaxed stone-colored denim trousers, simple unbranded white sneakers, holding a plain natural wood skateboard by her side while leaning against warm weathered pale concrete architecture. Subject entirely in the RIGHT half, full body visible, relaxed authentic everyday pose. Entire LEFT 45% calm empty warm gray concrete wall for dark HTML copy. Real urban location, natural late afternoon side light, thoughtful fashion magazine composition, realistic cotton texture, stone and sand palette with black clothing, muted desaturated colors and soft analog grain. Mature minimalist campaign for clothing, no cartoon, no neon, no pastel decorations, no text, no lettering, no logos, no watermark. Campaign photograph, not a UI screenshot.

Verificação: `scripts/verify-street-themes.cjs` usa Playwright e API simulada para conferir layout, hero, catálogo e compra sem criar pedidos reais.
