#!/bin/bash
set -euxo pipefail

# --- Inputs ---
: "${TYPESENSE_VOL_ID:?Set TYPESENSE_VOL_ID to the EBS volume id (eg vol0a8d4d1d2085973bb)}"
: "${TYPESENSE_API_KEY:=$(openssl rand -hex 32)}"

# --- Install deps (Docker, nvme-cli) ---
apt-get update
apt-get install -y ca-certificates curl gnupg lsb-release nvme-cli

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# --- Find the NVMe device that matches the EBS volume id ---
# Nitro exposes EBS as NVMe; the device SERIAL equals the EBS volume id (no dash).
DEV="$(lsblk -dn -o NAME,SERIAL | awk -v v="$TYPESENSE_VOL_ID" '$2==v{print "/dev/"$1}')"
if [ -z "${DEV}" ]; then
  # Fallback: inspect with nvme id-ctrl
  for d in /dev/nvme*n1; do
    if nvme id-ctrl -v "$d" 2>/dev/null | grep -q "$TYPESENSE_VOL_ID"; then DEV="$d"; break; fi
  done
fi
[ -n "${DEV}" ] || { echo "Could not find NVMe device for $TYPESENSE_VOL_ID"; exit 1; }

# --- Format (first time) and mount at /mnt/typesense, persist via UUID in /etc/fstab ---
if ! blkid "${DEV}" >/dev/null 2>&1; then
  mkfs.ext4 -F "${DEV}"
fi

mkdir -p /mnt/typesense
UUID="$(blkid -s UUID -o value "${DEV}")"
grep -q "${UUID}" /etc/fstab || echo "UUID=${UUID} /mnt/typesense ext4 defaults,nofail 0 2" >> /etc/fstab
mount -a

# --- Compose files ---
mkdir -p /var/lib/caddy-data /var/lib/caddy-config

cat >/root/Caddyfile <<'CADDY'
search.trydocufy.com {
  reverse_proxy typesense:8108 {
    health_uri /health
    health_interval 30s
    health_timeout 10s
  }
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "SAMEORIGIN"
    X-XSS-Protection "1; mode=block"
  }
  encode gzip
  log {
    output file /var/log/caddy/access.log
    format json
  }
}
CADDY

cat >/root/docker-compose.yml <<'EOF'
version: '3.8'
services:
  typesense:
    image: typesense/typesense:29.0
    container_name: typesense
    restart: unless-stopped
    ports:
      - "8108:8108"
    volumes:
      - /mnt/typesense:/data
    environment:
      - TYPESENSE_DATA_DIR=/data
      - TYPESENSE_API_KEY=${TYPESENSE_API_KEY}
      - TYPESENSE_ENABLE_CORS=true
    command: '--data-dir /data --api-key=${TYPESENSE_API_KEY} --enable-cors'
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8108/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  caddy:
    image: caddy:2-alpine
    container_name: caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /root/Caddyfile:/etc/caddy/Caddyfile
      - /var/lib/caddy-data:/data
      - /var/lib/caddy-config:/config
    depends_on:
      - typesense
EOF

# --- Run stack ---
docker compose -f /root/docker-compose.yml up -d
docker compose -f /root/docker-compose.yml ps

# --- Health checks ---
sleep 5
curl -fsS http://localhost:8108/health
curl -fsS -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}" http://localhost:8108/collections || true

echo "Done. Data dir is persisted at /mnt/typesense (UUID=${UUID})."
