---
name: deploy-desktop
description: Builda o app desktop (Electron/BoxSys PDV), publica o instalador na VPS (link fixo de download em Settings) e opcionalmente publica no GitHub Releases para o auto-update (electron-updater) funcionar. Use quando o usuário pedir para "gerar o instalador", "publicar o app desktop", "atualizar o .exe do PDV", "lançar uma nova versão do desktop", ou sempre que mudanças relevantes forem feitas em `desktop/`.
---

# Deploy do App Desktop (BoxSys PDV)

Desde a adição do auto-update (`electron-updater`), existem **duas distribuições
diferentes** do mesmo instalador, com propósitos distintos:

1. **Download manual fixo** (`public/downloads/BoxSysPDV-Setup.exe` na VPS) — o link
   "App Desktop PDV" em Configurações do sistema. Nome de arquivo sempre igual,
   independente da versão, para o link nunca quebrar.
2. **GitHub Release** (`BoxSysPDV-Setup-<versão>.exe` + `latest.yml`) — a fonte que o
   `electron-updater` consulta para decidir se há versão nova e baixar sozinho. Sem
   isso, instalações já existentes do app **nunca vão detectar atualização**.

Rodar sempre os dois passos ao lançar uma versão nova — só atualizar a VPS não
alimenta o auto-update, e só publicar no GitHub não atualiza o link de download direto
do site.

**Importante**: o instalador (~80-90MB) nunca é commitado no git principal
(`public/downloads/*` está no `.gitignore`, exceto `.gitkeep`) nem versionado como
binário solto — a distribuição é sempre via upload direto (VPS) ou GitHub Releases.

## Pré-requisitos

- Node 22 ativo via nvs: `& "$env:LOCALAPPDATA\nvs\nvs.ps1" use 22`
- Chave SSH já autorizada na VPS: `~/.ssh/id_ed25519_vps` → `root@72.62.8.195`
- Builds macOS/Linux não podem ser gerados localmente neste ambiente Windows — usam o
  workflow `.github/workflows/desktop-build.yml` via CI (parte 2 abaixo já cobre isso).

## Parte 1 — Atualizar o link fixo de download na VPS

1. **Bump de versão** (opcional, mas recomendado — `electron-updater` decide se há
   atualização comparando `version` do `desktop/package.json` contra o instalado):
   editar `desktop/package.json` → `"version"`.

2. **Build local**:
   ```powershell
   & "$env:LOCALAPPDATA\nvs\nvs.ps1" use 22 | Out-Null
   Set-Location "c:\Users\Eduardo\Desktop\store-stock\desktop"
   npm run dist:win
   ```
   Gera `desktop/release/BoxSysPDV-Setup-<versão>.exe` (nome versionado, definido por
   `build.win.artifactName` em `desktop/package.json`).

3. **Upload para a VPS renomeando para o nome fixo** (o link do site nunca muda de
   nome, então o arquivo remoto precisa ficar sempre como `BoxSysPDV-Setup.exe`):
   ```bash
   VERSION=$(grep '"version"' "c:/Users/Eduardo/Desktop/store-stock/desktop/package.json" | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
   scp -i ~/.ssh/id_ed25519_vps \
     "c:/Users/Eduardo/Desktop/store-stock/desktop/release/BoxSysPDV-Setup-${VERSION}.exe" \
     root@72.62.8.195:/var/www/store-boxsys/public/downloads/BoxSysPDV-Setup.exe
   ```

4. **Verificar integridade** (checksum local vs remoto devem bater):
   ```bash
   ssh -i ~/.ssh/id_ed25519_vps root@72.62.8.195 \
     "md5sum /var/www/store-boxsys/public/downloads/BoxSysPDV-Setup.exe"
   certutil -hashfile "c:/Users/Eduardo/Desktop/store-stock/desktop/release/BoxSysPDV-Setup-${VERSION}.exe" MD5
   ```

5. **Confirmar o link em produção**:
   ```bash
   curl -sI "https://store.boxsys.com.br/downloads/BoxSysPDV-Setup.exe" | head -5
   ```
   Deve retornar `HTTP/1.1 200 OK`.

## Parte 2 — Publicar no GitHub Releases (alimenta o auto-update)

O `electron-updater` está configurado com `publish: { provider: "github", owner:
"edueloi", repo: "store-stock" }` em `desktop/package.json`. Ele consulta o
**GitHub Release mais recente** do repositório em busca de `latest.yml` (Windows) —
sem uma release publicada com esse arquivo, nenhuma instalação existente detecta a
atualização, mesmo que o link da VPS já tenha sido trocado.

1. **Commitar e dar push** do bump de versão e quaisquer mudanças em `desktop/`
   (confirmar com o usuário antes do push, como sempre).

2. **Criar e enviar uma tag** no formato `desktop-v<versão>` (dispara o workflow):
   ```bash
   git tag desktop-v<versão>
   git push origin desktop-v<versão>
   ```
   **Confirmar com o usuário antes de criar/enviar a tag** — é uma ação visível
   publicamente (dispara CI, cria uma release pública no repositório).

3. O workflow `.github/workflows/desktop-build.yml` builda para Windows/macOS/Linux e
   publica automaticamente no GitHub Release (job `release`), incluindo os arquivos
   `latest.yml`/`latest-mac.yml` que o `electron-updater` precisa.

4. **Verificar a release publicada**:
   ```bash
   curl -s "https://api.github.com/repos/edueloi/store-stock/releases/latest" | grep -E '"tag_name"|"name":.*\.exe|"name":.*yml'
   ```
   Confirmar que `latest.yml` está listado nos assets — sem ele, `autoUpdater` não
   encontra a versão nova.

5. **Teste real de auto-update** (exige duas versões publicadas em sequência): instalar
   a versão anterior num Windows real, abrir o app, e confirmar que ele detecta e baixa
   a versão nova sozinho (menu **PDV → Verificar Atualizações...** força a checagem
   imediatamente, sem esperar o intervalo de 4h).

## Notas

- Parte 1 (VPS) não depende de rebuild do site nem de `npm run deploy` do projeto
  principal — é só um arquivo estático servido por
  `backend/routes/index.ts` → `app.use("/downloads", express.static(...))`.
- Parte 2 (GitHub Release) é **obrigatória** para o auto-update funcionar — pular essa
  parte deixa o link de download manual atualizado, mas instalações já existentes do
  app nunca vão se atualizar sozinhas.
- Sem bump de versão em `desktop/package.json`, o `electron-updater` não vê diferença
  entre a versão instalada e a nova — sempre incrementar antes de publicar.
