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
