---
name: deploy-desktop
description: Builda o app desktop (Electron/BoxSys PDV) e publica o instalador Windows na VPS de produção, para o link de download em Settings ("App Desktop PDV") funcionar sempre com a versão mais recente. Use quando o usuário pedir para "gerar o instalador", "publicar o app desktop", "atualizar o .exe do PDV", ou sempre que mudanças relevantes forem feitas em `desktop/`.
---

# Deploy do App Desktop (BoxSys PDV)

Builda o instalador Windows via `electron-builder` e publica em
`public/downloads/BoxSysPDV-Setup.exe` na VPS de produção — o mesmo arquivo que o link
"App Desktop PDV" em Configurações do sistema oferece para download.

**Importante**: o instalador (~80-90MB) nunca é commitado no git
(`public/downloads/*` está no `.gitignore`, exceto `.gitkeep`). A distribuição é sempre
via upload direto (SCP) para a VPS.

## Pré-requisitos

- Node 22 ativo via nvs: `& "$env:LOCALAPPDATA\nvs\nvs.ps1" use 22`
- Chave SSH já autorizada na VPS: `~/.ssh/id_ed25519_vps` → `root@72.62.8.195`
- Rodar em ambiente Windows (o build local só gera o instalador `.exe`; builds
  macOS/Linux exigem o workflow `.github/workflows/desktop-build.yml` via CI, não este
  fluxo local)

## Passos

1. **Build do instalador** (regenera `desktop/release/BoxSysPDV-Setup.exe`):
   ```powershell
   & "$env:LOCALAPPDATA\nvs\nvs.ps1" use 22 | Out-Null
   Set-Location "c:\Users\Eduardo\Desktop\store-stock\desktop"
   npm run dist:win
   ```
   Isso recompila os módulos nativos (`@serialport/bindings-cpp`) para a versão do
   Electron em uso e empacota tudo (`printer.cjs`, `printer-config.html`, `setup.html`,
   etc. — já listados em `desktop/package.json` → `build.files`).

2. **Confirmar que o artefato foi gerado com o nome esperado**:
   ```bash
   ls -la "c:/Users/Eduardo/Desktop/store-stock/desktop/release/BoxSysPDV-Setup.exe"
   ```
   O nome do arquivo é fixado por `build.win.artifactName` em `desktop/package.json` —
   deve bater exatamente com o path linkado em
   `src/views/Dashboard/Settings.tsx` (`/downloads/BoxSysPDV-Setup.exe`). Se o link
   mudar de nome um dia, ajustar os dois lugares juntos.

3. **Upload para a VPS via SCP**:
   ```bash
   scp -i ~/.ssh/id_ed25519_vps \
     "c:/Users/Eduardo/Desktop/store-stock/desktop/release/BoxSysPDV-Setup.exe" \
     root@72.62.8.195:/var/www/store-boxsys/public/downloads/BoxSysPDV-Setup.exe
   ```

4. **Verificar integridade do upload** (compara checksum local vs remoto):
   ```bash
   ssh -i ~/.ssh/id_ed25519_vps root@72.62.8.195 \
     "md5sum /var/www/store-boxsys/public/downloads/BoxSysPDV-Setup.exe"
   certutil -hashfile "c:/Users/Eduardo/Desktop/store-stock/desktop/release/BoxSysPDV-Setup.exe" MD5
   ```
   Os dois hashes MD5 devem ser idênticos.

5. **Confirmar que o link responde em produção**:
   ```bash
   curl -sI "https://store.boxsys.com.br/downloads/BoxSysPDV-Setup.exe" | head -5
   ```
   Deve retornar `HTTP/1.1 200 OK` com `Content-Length` batendo o tamanho do arquivo.

## Notas

- Não precisa mexer no site (`npm run deploy` do projeto principal) para isso — o
  arquivo fica direto na pasta `public/downloads/` da VPS, servida estaticamente pelo
  Express (`backend/routes/index.ts` → `app.use("/downloads", express.static(...))`).
  Não depende de rebuild do frontend.
- Se o usuário pedir builds para macOS/Linux também, esses não podem ser gerados
  localmente neste ambiente Windows — usar o workflow do GitHub Actions
  (`.github/workflows/desktop-build.yml`), criando uma tag `desktop-v*`, e então repetir
  os passos 3-5 baixando o artefato do GitHub Release em vez do build local.
- A versão do app (`desktop/package.json` → `version`) não é incrementada
  automaticamente — se quiser que o instalador mostre uma versão nova (ex. para o
  usuário saber que atualizou), bump manual desse campo antes do build.
