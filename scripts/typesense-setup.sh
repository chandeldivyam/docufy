#!/bin/bash
set -euxo pipefail

# This script is downloaded and executed by EC2 userData
# Expected env vars: STAGE, SSM_PARAM_NAME, DOMAIN

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Create directories
mkdir -p /opt/typesense /opt/caddy /var/lib/typesense /var/log/typesense

# Get admin key from SSM
REGION=$(curl -s http://169.254.169.254/latest/dynamic/instance-identity/document | jq -r .region)
ADMIN_KEY=$(aws ssm get-parameter --region "$REGION" --with-decryption --name "$SSM_PARAM_NAME" --query "Parameter.Value" --output text)

# Install Docker Compose
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ]; then
  COMP_URL="https://github.com/docker/compose/releases/download/v2.29.2/docker-compose-linux-aarch64"
else
  COMP_URL="https://github.com/docker/compose/releases/download/v2.29.2/docker-compose-linux-x86_64"
fi
mkdir -p /usr/libexec/docker/cli-plugins
curl -L "$COMP_URL" -o /usr/libexec/docker/cli-plugins/docker-compose
chmod +x /usr/libexec/docker/cli-plugins/docker-compose

# Create docker-compose.yml
cat >/opt/typesense/docker-compose.yml <<'EOF'
services:
  typesense:
    image: typesense/typesense:29.0
    restart: unless-stopped
    command: --data-dir=/data --api-address=0.0.0.0 --api-port=8108 --enable-cors=false --api-key=${TYPESENSE_API_KEY}
    environment:
      - TYPESENSE_LOG_DIR=/var/log/typesense
    volumes:
      - /var/lib/typesense:/data
      - /var/log/typesense:/var/log/typesense
    networks: [web]
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports: ['80:80', '443:443']
    volumes:
      - /opt/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [typesense]
    networks: [web]
volumes:
  caddy_data:
  caddy_config:
networks:
  web:
    name: typesense-net
EOF

# Create Caddyfile
cat >/opt/caddy/Caddyfile <<EOF
${DOMAIN} {
  encode zstd gzip
  @preflight method OPTIONS
  header {
    Access-Control-Allow-Origin "{http.request.header.Origin}"
    Access-Control-Allow-Methods "GET, POST, OPTIONS"
    Access-Control-Allow-Headers "Content-Type, X-TYPESENSE-API-KEY"
    Access-Control-Max-Age "86400"
    Vary "Origin"
  }
  respond @preflight 204
  reverse_proxy 127.0.0.1:8108
}
EOF

# Start services
export TYPESENSE_API_KEY="$ADMIN_KEY"
cd /opt/typesense && docker compose up -d

echo "Typesense setup complete!"