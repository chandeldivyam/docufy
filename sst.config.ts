/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "docufy",
      home: "aws",
      providers: {
        aws: {},
        vercel: {},
      },
      removal: input?.stage === "prod" ? "retain" : "remove",
    }
  },

  async run() {
    const aws = await import("@pulumi/aws")
    const pulumi = await import("@pulumi/pulumi")

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
    const TypesenseAdminKey = new sst.Secret("TypesenseAdminKey")

    // ------- Web app on ECS/Fargate -------
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
        DATABASE_URL: DatabaseUrl.value,
        ELECTRIC_SOURCE_ID: ElectricSourceId.value,
        ELECTRIC_SOURCE_SECRET: ElectricSourceSecret.value,
        INNGEST_SIGNING_KEY: InngestSigningKey.value,
        INNGEST_EVENT_KEY: InngestEventKey.value,
        BETTER_AUTH_SECRET: BetterAuthSecret.value,
        RESEND_API_KEY: ResendApiKey.value,
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

const domain = $app.stage === "prod" ? "search.trydocufy.com" : `search-${$app.stage}.trydocufy.com`

// SSM Parameter for admin key
const typesenseParam = new aws.ssm.Parameter("TypesenseAdminKeyParam", {
  type: "SecureString",
  name: `/docufy/${$app.stage}/typesense/admin-key`,
  value: TypesenseAdminKey.value,
})

// Security Group
const sg = new aws.ec2.SecurityGroup("TypesenseSg", {
  vpcId: vpc.id,
  description: "Allow HTTPS to Caddy",
  ingress: [
    { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: [] },
    { protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: [] },
  ],
  egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: [] }],
})

// Instance Role
const role = new aws.iam.Role("TypesenseEc2Role", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [{
      Effect: "Allow",
      Principal: { Service: "ec2.amazonaws.com" },
      Action: "sts:AssumeRole"
    }]
  }),
})

new aws.iam.RolePolicyAttachment("TypesenseSsmCore", {
  role: role.name,
  policyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
})

new aws.iam.RolePolicy("TypesenseParamRead", {
  role: role.name,
  policy: pulumi.all([typesenseParam.arn]).apply(([arn]) =>
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        { Effect: "Allow", Action: ["ssm:GetParameter"], Resource: arn },
        { Effect: "Allow", Action: ["kms:Decrypt"], Resource: "*" },
      ],
    })
  ),
})

const profile = new aws.iam.InstanceProfile("TypesenseEc2Profile", { role: role.name })

// AL2023 ARM64 AMI
const ami = await aws.ec2.getAmi({
  owners: ["amazon"],
  mostRecent: true,
  filters: [
    { name: "name", values: ["al2023-ami-*-kernel-6.*-arm64"] },
    { name: "architecture", values: ["arm64"] },
    { name: "state", values: ["available"] },
  ],
})

// Get current git branch and commit SHA
const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "main"
const scriptRef = branch // or use commit SHA for immutability

// Minimal userData that downloads and executes the setup script
const userDataScript = pulumi.interpolate`#!/bin/bash
set -euxo pipefail

# Download setup script from your public repo (using branch: ${scriptRef})
curl -fsSL https://raw.githubusercontent.com/chandeldivyam/docufy/${scriptRef}/scripts/typesense-setup.sh -o /tmp/setup.sh
chmod +x /tmp/setup.sh

# Execute with environment variables
STAGE="${$app.stage}" \
SSM_PARAM_NAME="${typesenseParam.name}" \
DOMAIN="${domain}" \
/tmp/setup.sh
`

// Get first public subnet
const subnetId = vpc.publicSubnets.apply(subnets => subnets[0])

// EC2 Instance
const instance = new aws.ec2.Instance("TypesenseInstance", {
  ami: ami.id,
  instanceType: "t4g.small",
  subnetId: subnetId,
  vpcSecurityGroupIds: [sg.id],
  iamInstanceProfile: profile.name,
  userData: userDataScript,
  rootBlockDevice: {
    volumeType: "gp3",
    volumeSize: 30,
    deleteOnTermination: true,
  },
  tags: { Name: `typesense-${$app.stage}` },
})

// Elastic IP
const eip = new aws.ec2.Eip("TypesenseEip", { 
  instance: instance.id, 
  domain: "vpc" 
})

// DNS Record
const dns = sst.vercel.dns({ domain: "trydocufy.com" })
const hostLabel = $app.stage === "prod" ? "search" : `search-${$app.stage}`

dns.createRecord("TypesenseARecord", {
  name: hostLabel,
  type: "A",
  value: eip.publicIp,
}, { parent: eip })

    return {
      WebURL: web.url,
      TypesenseURL: `https://${domain}`,
      TypesenseIp: eip.publicIp,
    }
  },
})