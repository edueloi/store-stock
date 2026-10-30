# Modelos de ótica no BoxSys

Os modelos **LUMIÈRE Ótica** (`lumiere`) e **ÓRBITA Eyewear** (`orbita`) ficam em **Minha Loja → Design / Modelos → Óticas & Armações**. Ambos também aparecem em Todos. Os cards usam a mesma prévia real dos demais modelos.

Prévia sem alterar o modelo salvo: `/?previewTheme=lumiere` ou `/?previewTheme=orbita` no subdomínio público da loja. As rotas de catálogo, produto e sobre preservam esse parâmetro. Para aplicar, selecione o modelo e salve a configuração da loja.

Cada modelo tem composição e estilo próprios, fotografia cobrindo todo o hero, versão panorâmica no desktop e retrato no celular, início, catálogo com busca/categorias/ordenação/favoritos, produto com galeria e variações, sobre com contatos reais e sacola adaptada ao visual. A sacola usa estoque, preços, persistência e modalidades de checkout já existentes, sem produtos fictícios nem migrações de banco.

Na prévia de um modelo, a campanha ilustrativa do próprio modelo mostra sua identidade. Ao aplicar o modelo, o banner, os slides e os textos cadastrados pela loja têm prioridade. Nenhuma configuração de um lojista é alterada automaticamente.

As imagens foram geradas com a ferramenta integrada de geração de imagens. Caminhos finais: `public/store-assets/lumiere-campaign-{wide,portrait}-v1.webp` e `public/store-assets/orbita-campaign-{wide,portrait}-v1.webp`. Pessoas e campanhas são ilustrativas; não representam produtos ou estoque da loja. Os prompts originais estão em `lojas/IMAGENS.md` e `lojas/IMAGENS-HERO-INTEIRO.md` no workspace.

Componentes em `src/views/Store/themes/optical`, adaptadores/estilos isolados em `themes/lumiere` e `themes/orbita`. Os componentes reaproveitam os hooks de comércio existentes, usados também na Adega; não alteram o comportamento da Adega.

Validação: `node scripts/verify-optical-themes.cjs` usa React e DOM simulado. Configure `JSDOM_MODULE` para uma instalação de jsdom ou instale em `lojas/qa`. Verifica campanhas, prioridade de banner, navegação, busca sem acentos, favoritos, categoria, variações, SKU sem saldo e checkout. Não substitui a revisão visual de responsividade em navegador real. O build de produção é executado na preparação do deploy; o limite de precache do PWA é de 6 MiB para acomodar o chunk compartilhado atual.
