# Modelos de vitrine — campanhas e identidades

Cada modelo possui composição de campanha, tipografia, catálogo e rodapé próprios. O banner e os slides cadastrados pelo lojista têm prioridade sobre a imagem padrão. As imagens são locais e continuam disponíveis em lojas sem produtos cadastrados.

| Modelo | Direção visual | Imagem padrão | Prompt e origem |
| --- | --- | --- | --- |
| Fazenda Forte | Campanha dividida, verde profundo, tipografia robusta e catálogo técnico | [agro-editorial-hero-v1.jpg](../../../../public/store-assets/agro-editorial-hero-v1.jpg) | [Detalhes](agro/LEIA-ME.md) |
| Rancho & Ração | Marca central, fotografia panorâmica e cartões de despensa | [feed-editorial-hero-v1.jpg](../../../../public/store-assets/feed-editorial-hero-v1.jpg) | [Detalhes](feed/LEIA-ME.md) |
| Horta Viva | Campanha botânica imersiva, ficha sobre a foto e editorial de cultivo | [garden-editorial-hero-v1.jpg](../../../../public/store-assets/garden-editorial-hero-v1.jpg) | [Detalhes](garden/LEIA-ME.md) |
| Elétrica Pro | Campanha arquitetônica em grafite e lista técnica de materiais | [electric-editorial-hero-v1.jpg](../../../../public/store-assets/electric-editorial-hero-v1.jpg) | [Detalhes](electric/LEIA-ME.md) |
| Mundo de Brincar | Brinquedoteca em tons suaves, foto dividida e cartões acolhedores | [toys-editorial-hero-v1.jpg](../../../../public/store-assets/toys-editorial-hero-v1.jpg) | [Detalhes](toys/LEIA-ME.md) |
| Vitrine Mix | Grande título, composição de objetos e catálogo de utilidades | [variety-editorial-hero-v1.jpg](../../../../public/store-assets/variety-editorial-hero-v1.jpg) | [Detalhes](variety/LEIA-ME.md) |
| Aura Feminina | Boutique editorial, campanha de moda e coleção com imagens amplas | [aura-editorial-hero-v1.jpg](../../../../public/store-assets/aura-editorial-hero-v1.jpg) | [Detalhes](aura/LEIA-ME.md) |

As sete artes foram produzidas com a ferramenta ImageGen integrada da OpenAI e salvas em `public/store-assets/`. Cada documento acima contém o prompt final completo. Os JPEGs foram otimizados a partir dos PNGs originais, sem edição visual.

Verificação local, com dados simulados e sem efetuar pedidos reais:

- `scripts/verify-rural-themes.cjs`: Fazenda Forte, Rancho & Ração e Horta Viva.
- `scripts/verify-retail-themes.cjs`: Elétrica Pro, Mundo de Brincar, Vitrine Mix e Aura Feminina.
- Viewports de 375, 768 e 1440 px; início, catálogo, produto e sobre.
- Filtros, busca, favoritos, galeria, variações, estoque, promoção, sacola, checkout, preços ocultos, banner próprio, slides, menu, barra de compra e políticas.
- Compilação: `npm run build`.

