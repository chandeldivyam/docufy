#!/bin/bash
set -e

# Update package index
sudo apt update

# Install required packages
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Set up the Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add your user to docker group (to run docker without sudo)
sudo usermod -aG docker $USER

# Apply the group change (or logout and login again)
newgrp docker

# Verify installation
docker --version
docker compose version

# Create project directory
mkdir -p ~/typesense
cd ~/typesense

# Create data directory for Typesense persistence
mkdir -p ./typesense-data

# Create Caddy data directories for SSL certificates
mkdir -p ./caddy-data
mkdir -p ./caddy-config

# Use existing TYPESENSE_API_KEY if set, otherwise generate a new one
if [ -z "$TYPESENSE_API_KEY" ]; then
  echo "No TYPESENSE_API_KEY found, generating a new one..."
  export TYPESENSE_API_KEY=$(openssl rand -hex 32)
  echo "Generated new API key. Please save it securely!"
else
  echo "Using existing TYPESENSE_API_KEY from environment"
fi

# Save it to a file for later reference
echo "TYPESENSE_API_KEY=$TYPESENSE_API_KEY" > .env

cat > docker-compose.yml <<'EOF'
version: '3.8'

services:
  typesense:
    image: typesense/typesense:29.0
    container_name: typesense
    restart: unless-stopped
    ports:
      - "8108:8108"
    volumes:
      - ./typesense-data:/data
    environment:
      - TYPESENSE_DATA_DIR=/data
      - TYPESENSE_API_KEY=${TYPESENSE_API_KEY}
      - TYPESENSE_ENABLE_CORS=true
    command: '--data-dir /data --api-key=${TYPESENSE_API_KEY} --enable-cors'
    networks:
      - typesense-network
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
      - ./Caddyfile:/etc/caddy/Caddyfile
      - ./caddy-data:/data
      - ./caddy-config:/config
    networks:
      - typesense-network
    depends_on:
      - typesense

networks:
  typesense-network:
    driver: bridge
EOF

cat > Caddyfile <<'EOF'
search.trydocufy.com {
    reverse_proxy typesense:8108 {
        # Add health check
        health_uri /health
        health_interval 30s
        health_timeout 10s
    }

    # Add security headers
    header {
        # Enable HSTS
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        # Prevent MIME type sniffing
        X-Content-Type-Options "nosniff"
        # Prevent clickjacking
        X-Frame-Options "SAMEORIGIN"
        # XSS Protection
        X-XSS-Protection "1; mode=block"
    }

    # Enable gzip compression
    encode gzip

    # Access logging
    log {
        output file /var/log/caddy/access.log
        format json
    }
}
EOF

# Start the services
docker compose up -d

# Check if containers are running
docker compose ps

# Wait a moment for services to start
sleep 5

# Check health endpoint (from inside the EC2)
echo "Checking health endpoint..."
curl http://localhost:8108/health

# Check with API key
echo "Checking collections endpoint with API key..."
curl -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}" \
  http://localhost:8108/collections

echo ""
echo "Setup complete! Once DNS is configured, test from outside:"
echo "curl https://search.trydocufy.com/health"