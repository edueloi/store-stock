#!/bin/bash
# ─────────────────────────────────────────────────────────────────
#  BoxSys Store — Deploy Script
#  Uso: bash deploy.sh
# ─────────────────────────────────────────────────────────────────
set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║        BoxSys Store — Deploy VPS         ║"
echo "╚══════════════════════════════════════════╝"
echo ""

APP_DIR="/var/www/store-boxsys"
REPO="https://github.com/edueloi/store-stock.git"
PM2_NAME="store-boxsys"
PORT=3001
DB_NAME="store_boxsys"
DB_USER="root"
DB_PASS="Edu@06051992"

# ── 1. Node via NVM ──────────────────────────────────────────────
echo "▶ Verificando Node.js..."
export NVM_DIR="$HOME/.nvm"
if [ ! -f "$NVM_DIR/nvm.sh" ]; then
  echo "  Instalando NVM..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
source "$NVM_DIR/nvm.sh"
nvm install 22 --silent
nvm use 22 --silent
nvm alias default 22 > /dev/null
echo "  Node $(node -v) | NPM $(npm -v)"

# ── 2. PM2 global ───────────────────────────────────────────────
echo ""
echo "▶ Verificando PM2..."
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2 --silent
  echo "  PM2 instalado."
else
  echo "  PM2 já disponível."
fi

# ── 3. Banco de dados ────────────────────────────────────────────
echo ""
echo "▶ Criando banco '$DB_NAME' se não existir..."
mysql -u "$DB_USER" -p"$DB_PASS" -e \
  "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
echo "  Banco OK."

# ── 4. Clonar ou atualizar repositório ──────────────────────────
echo ""
if [ -d "$APP_DIR/.git" ]; then
  echo "▶ Atualizando código existente..."
  cd "$APP_DIR"
  git fetch origin main
  git reset --hard origin/main
else
  echo "▶ Clonando repositório..."
  mkdir -p /var/www
  git clone "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 5. Criar .env de produção (só se não existir) ───────────────
echo ""
if [ ! -f "$APP_DIR/.env" ]; then
  echo "▶ Criando .env de produção..."
  cat > "$APP_DIR/.env" << EOF
DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}"
JWT_SECRET="Edu@06051992"
PORT=${PORT}
NODE_ENV="production"

APP_BASE_URL="https://store.boxsys.com.br"
APP_DOMAIN="boxsys.com.br"
PRIMARY_SUBDOMAIN="store"
INVITE_EXPIRATION_DAYS=7

SUPER_ADMIN_USER="Admin"
SUPER_ADMIN_PASSWORD="Edu@06051992"

SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER="contato@boxsys.com.br"
SMTP_PASS="COLOQUE_AQUI_SENHA_DE_APP_GMAIL"

VITE_APP_DOMAIN="boxsys.com.br"
VITE_PRIMARY_SUBDOMAIN="store"
EOF
  echo "  .env criado. LEMBRE de editar SMTP_PASS!"
else
  echo "▶ .env já existe, mantendo configurações atuais."
fi

# ── 6. Instalar dependências ────────────────────────────────────
echo ""
echo "▶ Instalando dependências (npm install)..."
npm install --silent

# ── 7. Aplicar schema no banco (migrations seguras, sem perda de dados) ──
echo ""
echo "▶ Gerando Prisma client..."
npx prisma generate

echo "▶ Verificando histórico de migrations no banco..."
MIGRATIONS_TABLE=$(mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  -sse "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_name='_prisma_migrations';" 2>/dev/null || echo "0")

if [ "$MIGRATIONS_TABLE" = "0" ]; then
  echo "  Banco criado via db push (sem histórico). Fazendo baseline de todas as migrations anteriores..."
  # Marca todas as migrations EXCETO a última como já aplicadas (baseline)
  # A última migration (complete_schema_sync) vai rodar de verdade
  for migration_dir in prisma/migrations/*/; do
    migration_name=$(basename "$migration_dir")
    # Pula a migration de sync — ela vai rodar normalmente
    if [ "$migration_name" != "20260612100000_complete_schema_sync" ]; then
      npx prisma migrate resolve --applied "$migration_name" 2>/dev/null || true
    fi
  done
  echo "  Baseline concluído. Aplicando migration de sync..."
fi

npx prisma migrate deploy
echo "  Migrations aplicadas com sucesso."

# ── 8. Build ─────────────────────────────────────────────────────
echo ""
echo "▶ Buildando aplicação..."
npm run build
echo "  Build concluído."

# ── 9. PM2 — iniciar ou reiniciar ───────────────────────────────
echo ""
echo "▶ Subindo aplicação com PM2..."
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
  echo "  Processo '$PM2_NAME' reiniciado."
else
  pm2 start dist/server.cjs --name "$PM2_NAME"
  echo "  Processo '$PM2_NAME' iniciado."
fi
pm2 save

# ── 10. Nginx ────────────────────────────────────────────────────
echo ""
echo "▶ Configurando Nginx..."
NGINX_CONF="/etc/nginx/sites-available/store-boxsys"
if [ ! -f "$NGINX_CONF" ]; then
  cat > "$NGINX_CONF" << 'NGINXEOF'
server {
    listen 80;
    server_name store.boxsys.com.br *.boxsys.com.br;

    client_max_body_size 20M;

    location /uploads/ {
        alias /var/www/store-boxsys/public/uploads/;
    }

    location /system/ {
        alias /var/www/store-boxsys/public/system/;
    }

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXEOF

  if [ ! -f "/etc/nginx/sites-enabled/store-boxsys" ]; then
    ln -s "$NGINX_CONF" /etc/nginx/sites-enabled/store-boxsys
  fi

  nginx -t && systemctl reload nginx
  echo "  Nginx configurado e recarregado."
else
  nginx -t && systemctl reload nginx
  echo "  Nginx recarregado."
fi

# ── 11. SSL ──────────────────────────────────────────────────────
echo ""
echo "▶ Verificando SSL (Certbot)..."
if ! certbot certificates 2>/dev/null | grep -q "store.boxsys.com.br"; then
  if command -v certbot &> /dev/null; then
    certbot --nginx -d store.boxsys.com.br \
      --non-interactive --agree-tos \
      -m contato@boxsys.com.br \
      --redirect
    echo "  SSL configurado!"
  else
    echo "  Certbot não instalado. Instalando..."
    apt-get install -y certbot python3-certbot-nginx -q
    certbot --nginx -d store.boxsys.com.br \
      --non-interactive --agree-tos \
      -m contato@boxsys.com.br \
      --redirect
    echo "  SSL configurado!"
  fi
else
  echo "  SSL já configurado."
fi

# ── Resumo ───────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║              Deploy Concluído!           ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  App:     https://store.boxsys.com.br"
echo "  PM2:     pm2 status"
echo "  Logs:    pm2 logs store-boxsys"
echo ""
pm2 status
