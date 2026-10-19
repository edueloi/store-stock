# Essência — perfumaria editorial

Identidade em areia, âmbar e grafite, hero amplo, catálogo com busca e filtros discretos, rodapé com contato e horários e páginas internas no mesmo estilo. Sem parallax, faixa animada ou categorias flutuantes.

O hero prioriza os slides cadastrados pela loja. Sem slides, usa `tenant.banner_url`; sem banner, usa `public/store-assets/fragrance-editorial-hero-v1.jpg`, uma versão JPEG otimizada da campanha já existente `fragrance-amber-hero-v1.png`. Fotos do catálogo continuam sendo as dos produtos cadastrados.

Preserva textos personalizados, URLs com `previewTheme`, favoritos, galeria, opções de volume, estoque por combinação, preços ocultos e modo de solicitação. As políticas cadastradas de entrega, troca e devolução aparecem na página sobre.

O script `scripts/verify-cosmetics-themes.cjs` verifica as quatro páginas em celular, tablet e desktop e os fluxos de catálogo e compra com API simulada, sem criar pedidos reais. Requer Vite em execução, Node 20+ e `PLAYWRIGHT_MODULE` apontando para Playwright.
