# Cardápios digitais

Os três atendimentos têm apresentação independente da vitrine da loja. A base é branca ou cinza claro, com Manrope, pesos moderados e miniaturas neutras para produtos sem foto. Fotografias reais continuam vindo do cadastro.

## Composições

- **Delivery — `/cardapio`**: marca horizontal, opção de entrega ou retirada, informações de recebimento, categorias horizontais, destaques e produtos em linhas. A sacola revisa os itens primeiro; os dados de contato, endereço e pagamento aparecem na próxima etapa.
- **Balcão — `/cardapio/balcao`**: categorias na lateral do computador, seleção compacta, orientação para retirada e resumo do pedido próprio. No celular, os itens usam duas colunas e deixam nomes e preços em destaque.
- **Mesa — `/cardapio/mesa/:n`**: fundo branco, identificação da mesa e quantidade de pessoas, produtos separados por linhas e pedido acessado em uma camada própria, inclusive no computador.

As cores de destaque são discretas e exclusivas da modalidade: verde escuro, azul acinzentado e vinho suave. O tema da loja não altera o fundo nem a cor dos botões do cardápio.

## Componentes

`DigitalMenu.tsx` mantém os dados, a identificação da modalidade e o envio do pedido. `Navigation.tsx` compõe a marca, a abertura de cada atendimento e as categorias. `Products.tsx` apresenta itens e detalhes. `Bag.tsx` monta a revisão e o fechamento. `Panels.tsx` contém identificação, informações e histórico.

Os modais contêm o foco, fecham por Escape quando não estão enviando, bloqueiam a rolagem do fundo e restauram o foco. O corpo do pedido rola separadamente da confirmação. Os botões de ação têm texto branco com contraste sobre fundo escuro. A preferência de movimento reduzido é respeitada no CSS.

## Verificação

`scripts/verify-menu-layouts.cjs` usa Playwright com APIs interceptadas e produtos fictícios. Verifica as três composições em 320, 390, 768 e 1440 pixels, fundo neutro, busca, produtos com e sem foto, quantidade, observação, contraste, sacola, entrega e retirada, pagamento, envio por modalidade, mesa e pessoas, fechamento por teclado e ausência de erros JavaScript.

Os seis envios do teste são simulados: nenhum pedido real é criado. As capturas estão em `output/cardapios/`. Configure `MENU_TEST_URL`, `PLAYWRIGHT_MODULE` e `BROWSER_PATH` conforme o ambiente e execute com Node 22.

A compilação isolada do cardápio com esbuild passou. A checagem global TypeScript continua apontando pendências em outros módulos, sem erros apontados nos componentes do cardápio nesta validação.
