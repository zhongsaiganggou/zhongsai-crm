#!/usr/bin/env bash
set -euo pipefail

umask 077

if [[ -f .env ]]; then
  echo "检测到 .env，已停止，避免覆盖现有生产密钥。"
  exit 1
fi

read -r -p "管理员手机号：" admin_mobile
read -r -s -p "管理员初始密码（至少 12 位）：" admin_password
echo

if [[ ${#admin_password} -lt 12 ]]; then
  echo "密码长度不足 12 位，未创建 .env。"
  exit 1
fi

postgres_password="$(openssl rand -hex 32)"
jwt_access_secret="$(openssl rand -hex 48)"
jwt_refresh_secret="$(openssl rand -hex 48)"
meta_verify_token="$(openssl rand -hex 32)"

cat > .env <<EOF
NODE_ENV=production
PORT=3000
CRM_DOMAIN=crm.zhongsai-steelstructure.com
POSTGRES_USER=zhongsai
POSTGRES_PASSWORD=${postgres_password}
POSTGRES_DB=zhongsai_crm
JWT_ACCESS_SECRET=${jwt_access_secret}
JWT_REFRESH_SECRET=${jwt_refresh_secret}
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL_DAYS=30
CORS_ORIGINS=https://crm.zhongsai-steelstructure.com
META_VERIFY_TOKEN=${meta_verify_token}
META_APP_SECRET=
META_PAGE_ACCESS_TOKEN=
META_GRAPH_API_VERSION=v25.0
META_GRAPH_BASE_URL=https://graph.facebook.com
WECHAT_WEBHOOK_URL=
GOOGLE_SHEETS_WEBHOOK_URL=
CRM_PUBLIC_URL=https://crm.zhongsai-steelstructure.com
SEED_ADMIN_MOBILE=${admin_mobile}
SEED_ADMIN_PASSWORD=${admin_password}
EOF

chmod 600 .env
echo "生产环境文件已创建。请勿上传、截图或发送 .env 内容。"
echo "Meta接入时可在服务器本地查看 META_VERIFY_TOKEN。"
