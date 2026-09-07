---
name: deploy-desktop
description: Builda e publica uma nova versão do app desktop (Electron/BoxSys PDV) inteiramente via GitHub Releases — nada é buildado ou copiado manualmente para a VPS. Use quando o usuário pedir para "gerar o instalador", "publicar o app desktop", "atualizar o .exe do PDV", "lançar uma nova versão do desktop", ou sempre que mudanças relevantes forem feitas em `desktop/`.
---

# Deploy do App Desktop (BoxSys PDV)

Uma única fonte de verdade: **GitHub Releases**, publicado automaticamente pelo
workflow `.github/workflows/desktop-build.yml` quando uma tag `desktop-v<versão>` é
enviada. Ele builda Windows/macOS/Linux via `electron-builder` e publica os três
instaladores + `latest.yml`/`latest-mac.yml` (consultados pelo `electron-updater` para
o auto-update) na mesma release.

O link "App Desktop PDV" em Configurações do sistema (`src/views/Dashboard/Settings.tsx`)
aponta direto para `https://github.com/edueloi/store-stock/releases/latest/download/<arquivo>`
— não precisa de nenhum passo manual de upload para a VPS. Isso só funciona porque
`build.win/mac/linux.artifactName` em `desktop/package.json` usa nomes **fixos, sem a
versão** (`BoxSysPDV-Setup.exe`, `BoxSysPDV.dmg`, `BoxSysPDV.AppImage`) — o endpoint
`releases/latest/download/<nome>` do GitHub exige o nome exato do asset, então se o
nome mudasse a cada versão o link do site quebraria a cada release.

**Importante**: nunca reintroduzir `${version}` no `artifactName`, e nunca voltar a
gerar/copiar o instalador manualmente para `public/downloads/` na VPS — esse fluxo foi
descontinuado de propósito (rebuild manual + scp era retrabalho desnecessário agora que
o CI já publica tudo).

## Pré-requisitos

- Builds macOS/Linux não podem ser gerados localmente neste ambiente Windows — sempre
  via CI, nunca `npm run dist:mac`/`dist:linux` manual.
- Build Windows local (`npm run dist:win`) só é útil pra testar antes de publicar —
  não é necessário pro deploy em si.

## Passo a passo — lançar uma versão nova

1. **Bump de versão** em `desktop/package.json` (`electron-updater` decide se há
   atualização comparando esse valor contra o instalado — sem bump, ele não vê
   diferença nenhuma e nenhuma instalação existente vai se atualizar).

2. **Commitar e dar push** do bump e de quaisquer mudanças em `desktop/` (confirmar
   com o usuário antes do push, como sempre).

3. **Criar e enviar a tag** no formato `desktop-v<versão>` (dispara o workflow):
   ```bash
   git tag -a desktop-v<versão> -m "BoxSys PDV v<versão> — <resumo>"
   git push origin desktop-v<versão>
   ```
   **Confirmar com o usuário antes de criar/enviar a tag** — é uma ação pública
   (dispara CI, cria uma release pública no repositório).

4. **Acompanhar o build**:
   ```bash
   curl -s "https://api.github.com/repos/edueloi/store-stock/actions/runs?event=push&per_page=1" \
     | grep -E '"status"|"conclusion"|"html_url"' | head -3
   ```
   Ou abrir a `html_url` retornada direto no navegador. O build dos três SOs roda em
   paralelo e leva alguns minutos.

5. **Verificar a release publicada**:
   ```bash
   curl -s "https://api.github.com/repos/edueloi/store-stock/releases/latest" \
     | grep -E '"tag_name"|"name": *"BoxSysPDV|"name": *"latest'
   ```
   Confirmar que aparecem `BoxSysPDV-Setup.exe`, `BoxSysPDV.dmg`, `BoxSysPDV.AppImage`
   e `latest.yml`/`latest-mac.yml` — sem `latest.yml`, o `autoUpdater` não detecta a
   versão nova em instalações já existentes.

6. **Confirmar o link do site** (mesmo link fixo, deve sempre resolver pra release mais
   recente sem precisar editar nada no código a cada versão):
   ```bash
   curl -sI "https://github.com/edueloi/store-stock/releases/latest/download/BoxSysPDV-Setup.exe" | head -5
   ```
   Deve retornar um redirect (`302`) para o asset da release mais recente.

7. **Teste real de auto-update** (exige duas versões publicadas em sequência): instalar
   a versão anterior num Windows real, abrir o app, e confirmar que ele detecta e baixa
   a versão nova sozinho (menu **PDV → Verificar Atualizações...** força a checagem
   imediatamente, sem esperar o intervalo de 4h).

## Notas

- `backend/routes/index.ts` ainda serve `/downloads` estático e `public/downloads/`
  ainda existe na VPS — é código legado, não usado mais pelo link de Configurações;
  não precisa ser removido, mas não deve receber novos uploads manuais.
- Sem bump de versão em `desktop/package.json`, o `electron-updater` não vê diferença
  entre a versão instalada e a nova — sempre incrementar antes de publicar.
