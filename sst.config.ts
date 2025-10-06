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

    const typesenseIngressSsh = new aws.vpc.SecurityGroupIngressRule("typesense-ingress-ssh", {
      securityGroupId: typesenseSg.id,
      cidrIpv4: "0.0.0.0/0", // Change to your IP for better security: "YOUR_IP/32"
      fromPort: 22,
      toPort: 22,
      ipProtocol: "tcp",
      description: "Allow SSH access",
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
              values: ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-arm64-server-*"],
          },
          {
              name: "virtualization-type",
              values: ["hvm"],
          },
      ],
      owners: ["099720109477"],
    });

    const typesenseInstance = new aws.ec2.Instance("typesense-ec2", {
      ami: ubuntu.then(ubuntu => ubuntu.id),
      instanceType: aws.ec2.InstanceType.T4g_Small,
      associatePublicIpAddress: true,
      vpcSecurityGroupIds: [typesenseSg.id],
      subnetId: vpc.publicSubnets.apply(subnets => subnets[0]),
      keyName: "divyam-local",
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
      TypesensePublicIp: typesenseInstance.publicIp,
    };
  },
});
