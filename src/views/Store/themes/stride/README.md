# Stride Sports

Modelo para camisetas, tênis e roupas, disponível em **Minha Loja → Layout, Tema & Modelos → Moda → Stride Sports**. A seleção usa o mesmo salvamento dos demais modelos. A demonstração utiliza `?previewTheme=stride` e preserva a prévia durante a navegação.

As páginas próprias são descobertas por `themes/own.ts`. O registro em `segments/registry.ts` integra o cartão, a categoria, os preços promocionais e o carrinho. Os componentes compartilhados de compra usam o prefixo CSS isolado `sr`.

O nome, o logo, a cor principal, as categorias, os produtos, os textos e os banners vêm do cadastro da loja. Um banner cadastrado substitui a imagem padrão; os slides cadastrados substituem o hero inteiro. Não há produtos fictícios no tema.

## Imagem de campanha

Asset: `public/store-assets/stride-campaign-v1.jpg`, 1536 × 1024, aproximadamente 251 KiB. Criado pela ferramenta integrada ImageGen e codificado em JPEG para uso no site. É uma imagem de campanha; as fotos do catálogo continuam sendo as dos produtos cadastrados.

Prompt utilizado:

> Use case: ads-marketing. Asset type: wide 3:2 landscape ecommerce hero photograph for an original sportswear store. Premium high-end sports fashion campaign, cinematic editorial photograph of a young adult woman athlete with natural curly hair wearing a simple white oversized T-shirt and black running shorts, leaning forward in dynamic sprint at right half of frame, white and subtle acid-lime running sneakers, dark charcoal concrete running track and sculptural gray urban architecture, hard afternoon side lighting, grainy analog film texture, authentic human proportions and realistic fabric. Entire left 45% mostly dark empty background with negative space for website headline to be added in HTML. Composition medium wide showing full figure and sneakers, energy and movement, sophisticated muted colors, charcoal black, white and one subtle acid lime accent. No words, no lettering, no brand logos, no watermarks. This is an atmosphere/campaign photograph, not a product listing or UI screenshot.

## Verificação

`scripts/verify-stride-theme.cjs` usa respostas de API simuladas e Playwright para verificar as quatro páginas em 375, 768 e 1440 px, a prévia, filtros, busca, favoritos, variações, estoque, preço promocional, sacola, abertura do checkout, preços ocultos, catálogo vazio, personalização, slides e menu móvel. Nenhum pedido real é criado.

Execute com Node 20+, Vite na porta 4179 e `PLAYWRIGHT_MODULE` apontando para Playwright ou playwright-core. `THEME_TEST_URL` e `BROWSER_PATH` permitem ajustar o servidor e o navegador.

## Compra completa

Com o modo **Checkout online** ativo, a Stride usa `/checkout` com contato, entrega/retirada e revisão. A sacola guarda somente produtos, opções e quantidades por loja durante sete dias; os preços e saldos atuais são recuperados do catálogo. Dados pessoais não são salvos no armazenamento da sacola.

O endereço usa a consulta ViaCEP no servidor, com tempo limite e preenchimento manual disponível. As taxas vêm das faixas de CEP cadastradas em Minha Loja. Nenhum prazo ou serviço de transportadora é inventado. As formas operacionais deste fluxo são PIX combinado com a loja e dinheiro/cartão na entrega ou retirada, conforme habilitados. A confirmação inicial significa **pedido recebido**, com pagamento pendente.

`/api/public/store-checkout` confere preços, variações, estoque e entrega numa transação. O identificador da tentativa impede pedidos e baixas duplicados. A confirmação privada exige o token enviado na compra/e-mail e pode ser reaberta sem criar outra venda. `/ajuda` exibe as políticas cadastradas pela loja.

Os e-mails ao cliente e à equipe entram na caixa de saída `store_order_emails`, na mesma transação do pedido. Um worker reenvia falhas até cinco tentativas. A equipe recebe também um PDF para conferência. Os destinatários são definidos em **Minha Loja → Checkout**; sem configuração, usa-se o administrador mais antigo. O painel mostra o e-mail do cliente, variações, observações e situação dos envios.

`scripts/verify-store-checkout.ts` testa as regras financeiras e de estoque com banco simulado. `scripts/verify-stride-checkout.cjs` verifica a compra no navegador em desktop e celular, com APIs simuladas e sem criar pedidos ou enviar e-mails reais.
