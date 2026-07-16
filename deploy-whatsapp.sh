#!/bin/bash
# ─────────────────────────────────────────────────────────────────
#  BoxSys Store — Deploy do serviço WhatsApp (Baileys)
#  Uso: bash deploy-whatsapp.sh
#  Rodar DEPOIS de deploy.sh (assume que o repo já está clonado/atualizado
#  em $APP_DIR pelo deploy.sh principal). Script separado de propósito:
#  um bug aqui nunca deve travar ou derrubar o deploy do backend principal.
# ─────────────────────────────────────────────────────────────────
set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   BoxSys Store — Deploy WhatsApp (VPS)   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

APP_DIR="/var/www/store-boxsys"
SERVICE_DIR="$APP_DIR/whatsapp-service"
SESSIONS_DIR="/var/www/store-boxsys-baileys-sessions"
PM2_NAME="store-boxsys-whatsapp"
PORT=3002

if [ ! -d "$SERVICE_DIR" ]; then
  echo "✖ Diretório $SERVICE_DIR não encontrado. Rode deploy.sh primeiro (ele já atualiza este diretório via git)."
  exit 1
fi

# ── 1. Diretório de sessões (fora da árvore git) ────────────────
echo "▶ Garantindo diretório de sessões fora do repositório..."
mkdir -p "$SESSIONS_DIR"
echo "  $SESSIONS_DIR OK (nunca tocado pelo git reset --hard)."

# ── 2. .env do serviço (só cria se não existir, preserva token) ─
echo ""
if [ ! -f "$SERVICE_DIR/.env" ]; then
  echo "▶ Criando .env do serviço WhatsApp..."
  INTERNAL_TOKEN=$(openssl rand -hex 24)
  cat > "$SERVICE_DIR/.env" << EOF
PORT=${PORT}
BAILEYS_INTERNAL_TOKEN="${INTERNAL_TOKEN}"
BAILEYS_SESSIONS_DIR="${SESSIONS_DIR}"
APP_BASE_URL="https://store.boxsys.com.br"
LOG_LEVEL="warn"
EOF
  echo "  .env criado com token interno novo."
  echo ""
  echo "  ⚠ IMPORTANTE: adicione estas duas linhas no .env do backend principal"
  echo "    ($APP_DIR/.env), se ainda não estiverem lá:"
  echo ""
  echo "    BAILEYS_SERVICE_URL=\"http://127.0.0.1:${PORT}\""
  echo "    BAILEYS_INTERNAL_TOKEN=\"${INTERNAL_TOKEN}\""
  echo ""
else
  echo "▶ .env do serviço já existe, mantendo token atual."
fi

# ── 3. Instalar dependências e buildar ──────────────────────────
echo ""
echo "▶ Instalando dependências do serviço WhatsApp..."
cd "$SERVICE_DIR"
npm install --silent

echo "▶ Buildando serviço WhatsApp..."
npm run build
echo "  Build concluído."

# ── 4. PM2 — iniciar ou reiniciar ────────────────────────────────
echo ""
echo "▶ Subindo serviço WhatsApp com PM2..."
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
  echo "  Processo '$PM2_NAME' reiniciado."
else
  pm2 start dist/server.cjs --name "$PM2_NAME" --cwd "$SERVICE_DIR"
  echo "  Processo '$PM2_NAME' iniciado."
fi
pm2 save

# ── Resumo ────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       Deploy WhatsApp Concluído!         ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Serviço:  http://127.0.0.1:${PORT} (interno, sem exposição via Nginx)"
echo "  Sessões:  $SESSIONS_DIR"
echo "  Logs:     pm2 logs $PM2_NAME"
echo ""
echo "  Lembre de confirmar que BAILEYS_SERVICE_URL e BAILEYS_INTERNAL_TOKEN"
echo "  estão no .env do backend principal e reiniciar 'store-boxsys' se precisou editar."
echo ""
pm2 status
