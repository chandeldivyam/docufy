/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'docufy',
      // We'll deploy to AWS. Use your default AWS profile/region, or set providers.aws.profile/region here.
      home: 'aws',
      providers: {
        aws: {}, // reads region/profile from your env/CLI
        vercel: {}, // uses VERCEL_API_TOKEN / VERCEL_TEAM_ID env vars
      },
      removal: input?.stage === 'prod' ? 'retain' : 'remove',
    };
  },

  async run() {
    // ------- Networking & Cluster -------
    const vpc = new sst.aws.Vpc('Vpc', { nat: 'ec2' });
    const cluster = new sst.aws.Cluster('Cluster', { vpc });

    // ------- Secrets we’ll inject into containers -------
    const BetterAuthSecret = new sst.Secret('BetterAuthSecret');
    const DatabaseUrl = new sst.Secret('DatabaseUrl');
    const ResendApiKey = new sst.Secret('ResendApiKey');
    const InngestSigningKey = new sst.Secret('InngestSigningKey');
    const InngestEventKey = new sst.Secret('InngestEventKey');
    const ElectricSourceId = new sst.Secret('ElectricSourceId');
    const ElectricSourceSecret = new sst.Secret('ElectricSourceSecret');
    const BlobReadWriteToken = new sst.Secret('BlobReadWriteToken');
    const VercelBlobStoreId = new sst.Secret('VercelBlobStoreId');
    const VercelBlobBaseUrl = new sst.Secret('VercelBlobBaseUrl');
    const TypesenseApiKey = new sst.Secret('TypesenseApiKey');

    const typesenseSg = new aws.ec2.SecurityGroup("typesense-sg", {
      name: `${$app.name}-${$app.stage}-typesense-sg`,
      description: "Security group for Typesense server",
      vpcId: vpc.id,
      tags: {
        Name: `${$app.name}-${$app.stage}-typesense-sg`,
        Environment: $app.stage,
      },
    });
    
    // Ingress: Allow HTTP (80) from Internet
    const typesenseIngressHttp = new aws.vpc.SecurityGroupIngressRule("typesense-ingress-http", {
      securityGroupId: typesenseSg.id,
      cidrIpv4: "0.0.0.0/0",
      fromPort: 80,
      toPort: 80,
      ipProtocol: "tcp",
      description: "Allow HTTP from Internet",
    });
    
    // Ingress: Allow HTTPS (443) from Internet
    const typesenseIngressHttps = new aws.vpc.SecurityGroupIngressRule("typesense-ingress-https", {
      securityGroupId: typesenseSg.id,
      cidrIpv4: "0.0.0.0/0",
      fromPort: 443,
      toPort: 443,
      ipProtocol: "tcp",
      description: "Allow HTTPS from Internet",
    });
    
    // Egress: Allow all outbound traffic
    const typesenseEgress = new aws.vpc.SecurityGroupEgressRule("typesense-egress-all", {
      securityGroupId: typesenseSg.id,
      cidrIpv4: "0.0.0.0/0",
      ipProtocol: "-1", // All protocols
      description: "Allow all outbound traffic",
    });

    const ubuntu = aws.ec2.getAmi({
      mostRecent: true,
      filters: [
          {
              name: "name",
              values: ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"],
          },
          {
              name: "virtualization-type",
              values: ["hvm"],
          },
      ],
      owners: ["099720109477"],
    });

    const typesenseUserData = $interpolate`#!/bin/bash
set -euxo pipefail

# Log everything to both console and file
exec > >(tee /var/log/user-data.log) 2>&1

echo "Starting Typesense setup..."

# Update and install dependencies
apt-get update -y
apt-get install -y docker.io docker-compose-plugin jq awscli curl

# Enable and start Docker
systemctl enable docker
systemctl start docker

# Get instance metadata
REGION=$(ec2-metadata --availability-zone | cut -d' ' -f2 | sed 's/[a-z]$//')
INSTANCE_ID=$(ec2-metadata --instance-id | cut -d' ' -f2)

# Wait for and attach EBS volume
echo "Waiting for EBS volume to attach..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if [ -e /dev/xvdf ] || [ -e /dev/nvme1n1 ]; then
    DEVICE=$([ -e /dev/xvdf ] && echo "/dev/xvdf" || echo "/dev/nvme1n1")
    echo "Volume found at $DEVICE"
    break
  fi
  sleep 2
  attempt=$((attempt + 1))
done

# Format volume if not already formatted
if ! blkid $DEVICE; then
  echo "Formatting new volume..."
  mkfs.ext4 -F $DEVICE
fi

# Mount the volume
mkdir -p /mnt/typesense-data
mount $DEVICE /mnt/typesense-data

# Add to fstab for automatic mounting on reboot
UUID=$(blkid -s UUID -o value $DEVICE)
if ! grep -q "$UUID" /etc/fstab; then
  echo "UUID=$UUID /mnt/typesense-data ext4 defaults,nofail 0 2" >> /etc/fstab
fi

# Create directory structure
mkdir -p /mnt/typesense-data/data
mkdir -p /mnt/typesense-data/logs
mkdir -p /opt/typesense
mkdir -p /opt/caddy
chown -R 1000:1000 /mnt/typesense-data

# Get Typesense API key from SSM Parameter Store
APP_NAME="docufy"
STAGE=$(aws ssm get-parameter --region "$REGION" --name "/sst/$APP_NAME/.stage" --query "Parameter.Value" --output text 2>/dev/null || echo "prod")
SSM_PATH="/sst/$APP_NAME/$STAGE/Secret/TypesenseApiKey/value"

echo "Fetching secret from: $SSM_PATH"
TYPESENSE_API_KEY=$(aws ssm get-parameter \
  --region "$REGION" \
  --name "$SSM_PATH" \
  --with-decryption \
  --query "Parameter.Value" \
  --output text)

if [ -z "$TYPESENSE_API_KEY" ]; then
  echo "ERROR: Failed to retrieve Typesense API key from SSM"
  exit 1
fi

# Create docker-compose.yml
cat > /opt/typesense/docker-compose.yml <<'COMPOSE_EOF'
services:
  typesense:
    image: typesense/typesense:29.0
    container_name: typesense
    restart: unless-stopped
    command: >
      --data-dir=/data
      --api-address=0.0.0.0
      --api-port=8108
      --enable-cors=true
    environment:
      - TYPESENSE_API_KEY=\${TYPESENSE_API_KEY}
      - TYPESENSE_LOG_DIR=/logs
    volumes:
      - /mnt/typesense-data/data:/data
      - /mnt/typesense-data/logs:/logs
    networks:
      - web
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8108/health"]
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
      - /opt/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      typesense:
        condition: service_healthy
    networks:
      - web

volumes:
  caddy_data:
  caddy_config:

networks:
  web:
    name: typesense-net
COMPOSE_EOF

# Create Caddyfile with proper CORS
cat > /opt/caddy/Caddyfile <<'CADDY_EOF'
search.trydocufy.com {
    encode zstd gzip

    # CORS headers for all responses
    header {
        Access-Control-Allow-Origin "*"
        Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
        Access-Control-Allow-Headers "Content-Type, X-TYPESENSE-API-KEY, Authorization"
        Access-Control-Max-Age "86400"
    }

    # Handle preflight requests
    @options {
        method OPTIONS
    }
    handle @options {
        respond 204
    }

    # Proxy to Typesense
    reverse_proxy typesense:8108 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
    }

    # Health check endpoint
    handle /health {
        respond "OK" 200
    }
}
CADDY_EOF

# Create .env file
cat > /opt/typesense/.env <<ENV_EOF
TYPESENSE_API_KEY=$TYPESENSE_API_KEY
ENV_EOF

# Start services
cd /opt/typesense
docker compose up -d

# Create systemd service for auto-restart on reboot
cat > /etc/systemd/system/typesense.service <<'SERVICE_EOF'
[Unit]
Description=Typesense Docker Compose
After=docker.service network-online.target
Requires=docker.service
PartOf=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/typesense
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
SERVICE_EOF

systemctl daemon-reload
systemctl enable typesense.service

# Wait for Typesense to be healthy
echo "Waiting for Typesense to be healthy..."
max_wait=60
elapsed=0
while [ $elapsed -lt $max_wait ]; do
  if curl -s http://localhost:8108/health > /dev/null 2>&1; then
    echo "Typesense is healthy!"
    break
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done

echo "Typesense setup complete!"
echo "View logs: docker logs typesense"
echo "Access: https://search.trydocufy.com"
`;

    const typesenseInstance = new aws.ec2.Instance("typesense-ec2", {
      ami: ubuntu.then(ubuntu => ubuntu.id),
      instanceType: aws.ec2.InstanceType.T4g_Small,
      associatePublicIpAddress: true,
      vpcSecurityGroupIds: [typesenseSg.id],
      subnetId: vpc.publicSubnets.apply(subnets => subnets[0]),
      userData: typesenseUserData,
      ebsBlockDevices: [
        {
          deviceName: "/dev/sdf",
          volumeSize: 50,
          volumeType: "gp3",
          iops: 3000,
          throughput: 125,
          encrypted: true,
          deleteOnTermination: true,
        },
      ],
      tags: {
        Name: `${$app.name}-${$app.stage}-typesense-ec2`,
        Environment: $app.stage,
      },
    })

    const typesenseDns = new vercel.DnsRecord("typesense-dns", {
      domain: 'trydocufy.com',
      type: 'A',
      name: 'search',
      value: typesenseInstance.publicIp,
      ttl: 3600,
    })
      

    // ------- Web app on ECS/Fargate w/ ALB + domain -------
    const web = new sst.aws.Service('Web', {
      cluster,
      image: {
        context: '.',
        dockerfile: 'apps/web/Dockerfile',
      },
      // modest defaults; tune as you learn traffic patterns
      cpu: '0.25 vCPU',
      memory: '0.5 GB',
      storage: '20 GB',
      environment: {
        NODE_ENV: 'production',
        PORT: '3000',
        PUBLIC_URL: 'https://app.trydocufy.com',

        // Supabase
        DATABASE_URL: DatabaseUrl.value,

        // Electric Cloud (server-side)
        ELECTRIC_SOURCE_ID: ElectricSourceId.value,
        ELECTRIC_SOURCE_SECRET: ElectricSourceSecret.value,

        // Inngest Cloud
        INNGEST_SIGNING_KEY: InngestSigningKey.value,
        INNGEST_EVENT_KEY: InngestEventKey.value,

        // Auth & email
        BETTER_AUTH_SECRET: BetterAuthSecret.value,
        RESEND_API_KEY: ResendApiKey.value,

        // Vercel Blob
        BLOB_READ_WRITE_TOKEN: BlobReadWriteToken.value,
        VITE_PUBLIC_VERCEL_BLOB_STORE_ID: VercelBlobStoreId.value,
        VITE_PUBLIC_VERCEL_BLOB_BASE_URL: VercelBlobBaseUrl.value,
      },
      // Health: keep it simple; ALB will hit / (200). If you added /api/healthz, you can set health.path.
      health: {
        command: ['CMD-SHELL', 'node -e "require(\'http\').get(\'http://localhost:3000/api/healthz\', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on(\'error\', () => process.exit(1))"'],
        startPeriod: '10 seconds',
        timeout: '10 seconds',
        retries: 3,
        interval: '30 seconds',
      },
      scaling: { min: 2, max: 4, cpuUtilization: 60, memoryUtilization: 60 },
      loadBalancer: {
        domain: {
          name: 'app.trydocufy.com',
          dns: sst.vercel.dns({ domain: 'trydocufy.com' }),
        },
        rules: [{ listen: '80/http' }, { listen: '443/https', forward: '3000/http' }],
      },
      logging: { retention: '1 week' },
    });

    return {
      WebURL: web.url,
    };
  },
});
