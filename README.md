<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a9f1227f-747b-4f59-b872-42c1c0d1e8dc

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Conteúdo da vitrine Vitra

Em **Minha Loja → Checkout, Entrega & Integrações → Textos e seções do modelo Vitra**, cada loja pode editar os textos do hero, apresentação, categorias, destaques, etapas do orçamento, galeria, chamada antes do rodapé e rodapé. Os campos mostram o conteúdo em uso; salvar um texto vazio o oculta. Desmarcar uma seção remove o bloco inteiro. As etapas e os botões de projeto continuam dependendo da opção **Orçamento online**.

A chamada final aceita foto própria, independente do banner principal. Apagar o endereço da imagem deixa apenas o fundo escuro. Nome, telefone e endereço continuam em **Identidade & Dados**. O rodapé usa o nome completo da loja e inclui **Desenvolvido por boxsys.com.br**. As configurações são salvas por loja em `policies.storefront.glass_content`, sem migração de banco.
