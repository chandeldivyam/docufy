import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@docufy/ui', '@docufy/mdx-components'],
};

export default nextConfig;
