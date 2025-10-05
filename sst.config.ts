/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "docufy",
      home: "aws",
      providers: {
        aws: {},      // reads region/profile from your env/CLI
        vercel: {},   // uses VERCEL_API_TOKEN / VERCEL_TEAM_ID
      },
      removal: input?.stage === "prod" ? "retain" : "remove",
    }
  },

  async run() {
    const aws = await import("@pulumi/aws")
    const pulumi = await import("@pulumi/pulumi")
    const cloudinit = await import("@pulumi/cloudinit")

    // ------- Networking & Cluster -------
    const vpc = new sst.aws.Vpc("Vpc", { nat: "ec2" })
    const cluster = new sst.aws.Cluster("Cluster", { vpc })

    // ------- Secrets -------
    const BetterAuthSecret = new sst.Secret("BetterAuthSecret")
    const DatabaseUrl = new sst.Secret("DatabaseUrl")
    const ResendApiKey = new sst.Secret("ResendApiKey")
    const InngestSigningKey = new sst.Secret("InngestSigningKey")
    const InngestEventKey = new sst.Secret("InngestEventKey")
    const ElectricSourceId = new sst.Secret("ElectricSourceId")
    const ElectricSourceSecret = new sst.Secret("ElectricSourceSecret")
    const BlobReadWriteToken = new sst.Secret("BlobReadWriteToken")
    const VercelBlobStoreId = new sst.Secret("VercelBlobStoreId")
    const VercelBlobBaseUrl = new sst.Secret("VercelBlobBaseUrl")

    // NEW: Typesense Admin Key (set with: pnpm dlx sst secret set TypesenseAdminKey)
    const TypesenseAdminKey = new sst.Secret("TypesenseAdminKey")

    // ------- Web app on ECS/Fargate (existing) -------
    const web = new sst.aws.Service("Web", {
      cluster,
      image: {
        context: ".",
        dockerfile: "apps/web/Dockerfile",
      },
      cpu: "0.25 vCPU",
      memory: "0.5 GB",
      storage: "20 GB",
      environment: {
        NODE_ENV: "production",
        PORT: "3000",
        PUBLIC_URL: "https://app.trydocufy.com",

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
      health: {
        command: [
          "CMD-SHELL",
          'node -e "require(\'http\').get(\'http://localhost:3000/api/healthz\', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on(\'error\', () => process.exit(1))"',
        ],
        startPeriod: "10 seconds",
        timeout: "10 seconds",
        retries: 3,
        interval: "30 seconds",
      },
      scaling: { min: 2, max: 4, cpuUtilization: 60, memoryUtilization: 60 },
      loadBalancer: {
        domain: {
          name: "app.trydocufy.com",
          dns: sst.vercel.dns({ domain: "trydocufy.com" }),
        },
        rules: [{ listen: "80/http" }, { listen: "443/https", forward: "3000/http" }],
      },
      logging: { retention: "1 week" },
    })

    // =======================
    //   TYPESENSE on EC2
    // =======================

    // Mirror the SST secret into SSM Parameter Store so the instance can fetch it at boot
    const typesenseParam = new aws.ssm.Parameter("TypesenseAdminKeyParam", {
      type: "SecureString",
      name: `/docufy/${$app.stage}/typesense/admin-key`,
      value: TypesenseAdminKey.value,
    })

    // Security Group: expose 80/443 publicly; keep 8108 internal via Caddy
    const sg = new aws.ec2.SecurityGroup("TypesenseSg", {
      vpcId: vpc.id,
      description: "Allow HTTPS to Caddy; deny direct Typesense",
      ingress: [
        { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
        { protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: ["0.0.0.0/0"] },
      ],
      egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
    })

    // Instance Role: SSM + read our SSM parameter
    const role = new aws.iam.Role("TypesenseEc2Role", {
      assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "ec2.amazonaws.com" }),
    })
    new aws.iam.RolePolicyAttachment("TypesenseSsmCore", {
      role: role.name,
      policyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
    })
    new aws.iam.RolePolicy("TypesenseParamRead", {
      role: role.id,
      policy: typesenseParam.arn.apply((arn) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            { Effect: "Allow", Action: ["ssm:GetParameter"], Resource: arn },
            { Effect: "Allow", Action: ["kms:Decrypt"], Resource: "*" },
          ],
        }),
      ),
    })
    const profile = new aws.iam.InstanceProfile("TypesenseEc2Profile", { role: role.name })

    // AL2023 ARM64 AMI (latest)
    const ami = await aws.ec2.getAmi({
      owners: ["amazon"],
      mostRecent: true,
      filters: [
        { name: "name", values: ["al2023-ami-*-kernel-6.*-arm64"] },
        { name: "architecture", values: ["arm64"] },
        { name: "state", values: ["available"] },
      ],
    })

    // Domain per stage
    const domain =
      $app.stage === "prod" ? "search.trydocufy.com" : `search-${$app.stage}.trydocufy.com`

    // Cloud-init (userData) — installs Docker, Caddy, composes Typesense + Caddy
    const cloud = new cloudinit.Config("typesense-cloudinit", {
      gzip: false,
      base64Encode: false,
      parts: [
        {
          contentType: "text/cloud-config",
          content: `#cloud-config
package_update: true
packages:
  - jq
  - curl
  - awscli
runcmd:
  - set -euxo pipefail
  - curl -fsSL https://get.docker.com | sh
  - systemctl enable --now docker
  - mkdir -p /opt/typesense /opt/caddy /var/lib/typesense /var/log/typesense
  - REGION=$(curl -s http://169.254.169.254/latest/dynamic/instance-identity/document | jq -r .region)
  - ADMIN_KEY=$(aws ssm get-parameter --region $REGION --with-decryption --name "/docufy/${$app.stage}/typesense/admin-key" --query "Parameter.Value" --output text)
  # docker compose plugin (arm64/x86)
  - ARCH=$(uname -m)
  - |
      if [ "$ARCH" = "aarch64" ]; then
        COMP_URL="https://github.com/docker/compose/releases/download/v2.29.2/docker-compose-linux-aarch64";
      else
        COMP_URL="https://github.com/docker/compose/releases/download/v2.29.2/docker-compose-linux-x86_64";
      fi
  - mkdir -p /usr/libexec/docker/cli-plugins
  - curl -L "$COMP_URL" -o /usr/libexec/docker/cli-plugins/docker-compose
  - chmod +x /usr/libexec/docker/cli-plugins/docker-compose

  # docker-compose.yml
  - cat >/opt/typesense/docker-compose.yml <<'YML'
version: '3.8'
services:
  typesense:
    image: typesense/typesense:29.0
    restart: unless-stopped
    ulimits:
      nofile:
        soft: 65535
        hard: 65535
    command: >
      --data-dir=/data
      --api-address=0.0.0.0
      --api-port=8108
      --peering-address=127.0.0.1
      --enable-cors=false
      --api-key=${'${'}TYPESENSE_API_KEY}
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
    environment:
      DOMAIN: "${domain}"
    volumes:
      - /opt/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [typesense]
    networks: [web]
volumes: { caddy_data: {}, caddy_config: {} }
networks: { web: { name: typesense-net } }
YML

  # Caddyfile — TLS + dynamic CORS (reflect Origin; no creds)
  - cat >/opt/caddy/Caddyfile <<'CADDY'
${domain} {
  encode zstd gzip
  @preflight { method OPTIONS }
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
CADDY

  - export TYPESENSE_API_KEY="$ADMIN_KEY"
  - cd /opt/typesense && docker compose up -d
`,
        },
      ],
    })

    // Subnet: pick the first public subnet (handle Output<Output<string>[]> safely)
    const subnetId = pulumi
      .output(vpc.publicSubnets)
      .apply((ids: any[]) => pulumi.output(ids[0]))

    // EC2 Instance
    const instance = new aws.ec2.Instance("TypesenseInstance", {
      ami: ami.id,
      instanceType: "t4g.small",
      subnetId,
      vpcSecurityGroupIds: [sg.id],
      iamInstanceProfile: profile.name,
      userData: cloud.rendered,
      rootBlockDevice: {
        volumeType: "gp3",
        volumeSize: 20,
        deleteOnTermination: true,
      },
      tags: { Name: `typesense-${$app.stage}` },
    })

    // Elastic IP
    const eip = new aws.ec2.Eip("TypesenseEip", { instance: instance.id, domain: "vpc" })

    // Vercel DNS A record via SST's DNS adapter
    const dns = sst.vercel.dns({ domain: "trydocufy.com" })
    const hostLabel =
      $app.stage === "prod" ? "search" : `search-${$app.stage}`
    dns.createRecord("TypesenseARecord", {
      name: hostLabel,
      type: "A",
      value: eip.publicIp,
    }, {})

    return {
      WebURL: web.url,
      TypesenseURL: `https://${hostLabel}.trydocufy.com`,
      TypesenseIp: eip.publicIp,
    }
  },
})
