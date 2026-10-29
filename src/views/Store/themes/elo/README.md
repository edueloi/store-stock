# Élo Studio — tema `elo`

Modelo de moda com branco, cinza e rosa suave. Possui páginas, cabeçalho, rodapé, navegação móvel e sacola próprios.

## Ativação e conteúdo

Selecione **Configurações → Layout, Tema & Modelos → Moda → Élo Studio**. O identificador salvo é `elo`.

- Os banners cadastrados em `policies.storefront.hero_slides` substituem as campanhas padrão, com imagens, títulos, descrições, botões e links editáveis. O intervalo usa `hero_autoplay_seconds`; zero desativa a troca automática.
- Sem slides personalizados, `banner_url` substitui as fotos padrão. O primeiro título usa `hero_tagline`.
- A seção editorial e a página sobre usam primeiro `banner_url`, depois a imagem do segundo/primeiro slide e, por fim, a campanha padrão.
- Coleções usam as capas reais das categorias ou fotos dos produtos. As fotos de produto, preços, tamanhos, cores e estoque vêm dos cadastros existentes.
- Nome, logo, textos, contatos, endereço, horários e políticas continuam configuráveis no painel.
- Nenhuma fotografia de campanha é cadastrada automaticamente como produto.

## Comportamento

Hero com altura da primeira tela, transição suave, toque, setas, indicadores e pausa. O movimento respeita a preferência por animação reduzida. Carrossel de peças, favoritos, busca, filtros, ordenação e seleção de variações usam os dados reais da loja.

A sacola tem quantidade, remoção, resumo, limite de estoque, variações, persistência local por loja, foco de teclado e fechamento por Esc. Usa os modos existentes de WhatsApp, pedido, reserva e checkout. Os utilitários de comércio são reutilizados por `kit.ts`; toda a apresentação tem prefixo `els-`.

## Imagens de campanha

Geradas nesta tarefa com o recurso integrado **image_gen**, sem chamadas à API, convertidas para WebP e mantidas como arquivos substituíveis:

- `public/store-assets/elo-campaign-v1.webp`
- `public/store-assets/elo-editorial-v1.webp`

Prompt da campanha principal:

> Use case: ads-marketing. Asset type: wide full-screen fashion storefront hero background for Elo Studio, a delicate contemporary clothing boutique. Premium photorealistic fashion editorial, wide landscape 16:9 composition. An adult woman about 30 years old, elegant natural appearance, wearing a flowing off-white linen blouse with tailored soft taupe wide-leg trousers, standing relaxed in an airy modern courtyard of white and cool pale gray plaster walls. The model occupies the RIGHT THIRD of the photograph, full or three-quarter body, with large softly lit light gray negative space on the LEFT HALF reserved for HTML text. Soft diffused daylight, sophisticated quiet mood, subtle dusty rose accents in the setting, natural fabric drape and tactile texture, tasteful professional fashion photography, realistic skin. White, light gray and restrained rose palette, no dominant yellow or sepia tones. No text, no logos, no watermarks, no website UI, no collage.

Prompt da segunda campanha:

> Use case: ads-marketing. Asset type: second full-screen fashion campaign and editorial photograph for Elo Studio. Wide landscape 16:9 photorealistic luxury boutique editorial. An adult woman around 30 years old wearing a refined dusty rose flowing midi dress with delicate long sleeves and subtle pleats, walking naturally alongside pale gray stone columns in a bright minimalist courtyard. Place the woman on the RIGHT THIRD, three-quarter or full body. Leave generous uncluttered light gray and white architectural negative space across the LEFT HALF for website copy. Soft diffused daylight, muted colors, real fabric movement, relaxed elegance, professional editorial fashion photography, tactile fabric texture and natural skin. Delicate white, pale gray and muted rose palette, no yellow cast. No words, no logos, no watermark, no website layout, no collage.

## Verificação

`scripts/verify-elo-theme.cjs` usa dados fictícios e testa as páginas em 320, 390, 768 e 1440 px, navegação, campanhas, carrossel de peças, busca, filtros, ordenação, estoque, desconto, sacola, variações, persistência, checkout, conteúdo personalizado, preços ocultos e loja vazia. As capturas vão para `output/elo`. Os produtos e os contatos do teste são fictícios; nenhum pedido é enviado.

Requer Vite em `http://127.0.0.1:4191` ou `THEME_TEST_URL`, Node atual e Playwright/Edge disponíveis (caminhos configuráveis no script).

