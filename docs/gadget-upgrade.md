# Gadget — renovação do modelo de tecnologia

Atualiza o modelo nativo `gadget`: campanhas em toda a largura, hero com composição própria no celular, controles e pausa, vitrines de produtos, seleção de variações, catálogo, carrinho lateral e rodapé. Não cria um site separado. Outros modelos não recebem os estilos desta atualização.

Campanhas cadastradas em `policies.storefront.hero_slides` continuam prioritárias. Sem campanhas cadastradas, o modelo mostra duas campanhas padrão, respeitando `banner_url` na primeira. `hero_autoplay_seconds: 0` desliga a rotação. Interação, aba oculta e preferência por movimento reduzido pausam a rotação. Links internos preservam a prévia do modelo.

O carrinho usa os itens, preços, limites de estoque, opções selecionadas e callbacks nativos do StoreLayout. Mantém reserva, WhatsApp, pedido sob consulta e checkout online. O formulário nativo permanece dentro da área rolável. A busca passa a ignorar acentos e a seleção de opções é limpa ao trocar de produto.

## Verificação

- `node scripts/verify-gadget-upgrade.cjs`: componentes reais em DOM simulado, campanhas, rotação, pausa, toque, movimento reduzido, campanha própria, menu, busca, favorito, galeria, opções, SKU esgotado, carrinho e callback de checkout.
- `npm run build`: build de produção e PWA.
- A automação visual do navegador não estava disponível nesta sessão. Os testes de DOM não comprovam medidas reais de layout.

## Imagens geradas

Modo: ferramenta integrada `image_gen.imagegen`, três imagens novas sem referências. Otimizadas em WebP com Sharp. São composições ilustrativas de campanha; não substituem as fotos reais do catálogo nem afirmam disponibilidade dos produtos fotografados.

- `public/store-assets/gadget-upgrade/productivity-hero-v1.webp`
- `public/store-assets/gadget-upgrade/audio-hero-v1.webp`
- `public/store-assets/gadget-upgrade/productivity-mobile-v1.webp`

### Produtividade — desktop

Use case: ads-marketing. Asset type: premium electronics ecommerce full-bleed website hero, wide 16:9 landscape. Photorealistic studio product campaign featuring a slim silver laptop open at three-quarter angle, screen with abstract cobalt blue gradient no interface, matte graphite over-ear headphones, sleek black wireless mouse and a compact silver USB-C hub with cable, arranged precisely on low smoked glass and dark brushed aluminum plinths occupying the RIGHT half. Elegant midnight navy seamless studio, subtle electric blue edge lighting, glossy controlled reflections and realistic materials. LEFT 45 percent almost empty deep navy negative space for white website typography. Product scale large, dramatic but refined and believable high-end product photography, no people, no text, no logos, no watermark, no floating components, no collage.

### Áudio — desktop

Use case: ads-marketing. Asset type: wide landscape 16:9 ecommerce hero for audio accessories. Photorealistic luxury product campaign: large graphite wireless over-ear headphones angled upright on a matte black pedestal, small white wireless earbuds in open charging case and a compact fabric-covered black portable speaker grouped on the RIGHT side. Rich near-black aubergine seamless studio background, soft violet and magenta rim light, meticulous cushion textures, believable product details and soft glossy reflections. LEFT 45 percent has very calm dark negative space for website copy. Understated premium studio advertising photography, no people, no brands, no text, no logos, no watermark, no collage.

### Produtividade — celular

Use case: ads-marketing. Asset type: tall portrait 3:4 mobile ecommerce hero campaign for electronics. Photorealistic high-end studio photograph of an open slim silver laptop with abstract blue gradient screen, graphite over-ear headphones, compact USB-C charging hub and black wireless mouse carefully grouped on a dark brushed aluminum stepped plinth in UPPER TWO THIRDS of frame. Deep midnight navy background with sophisticated cobalt blue rim lighting and soft reflections. LOWER THIRD is quiet dark navy shadow and negative space for white mobile page text. Realistic product design, clean premium lighting, no people, no text, no logos, no watermark, no collage.
