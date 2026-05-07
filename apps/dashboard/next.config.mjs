import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Keep tracing scoped to the framework workspace so standalone layout is
  // .next/standalone/apps/dashboard (compatible with OpenNext monorepo resolver).
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@serverlessclaw/core', '@serverlessclaw/ui', '@serverlessclaw/hooks'],
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.md$/,
      use: 'raw-loader',
    });
    return config;
  },
};

export default nextConfig;
