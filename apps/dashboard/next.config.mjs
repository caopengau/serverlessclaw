import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // OpenNext reads Next standalone artifacts from .next/standalone.
  output: 'standalone',
  transpilePackages: ['@serverlessclaw/core', '@serverlessclaw/ui', '@serverlessclaw/hooks'],
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Keep tracing root at the framework monorepo root so OpenNext can locate standalone artifacts.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  outputFileTracingExcludes: {
    '**': [
      'node_modules/@swifttype/opentelemetry-instrumentation-vitest',
      'node_modules/@swifttype/opentelemetry-instrumentation-playwright',
      'node_modules/vitest',
      'node_modules/playwright',
    ],
  },
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.md$/,
      use: 'raw-loader',
    });
    // Ensure @swc/helpers is resolvable for server-side builds (Lambda)
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@swc/helpers': require.resolve('@swc/helpers'),
      };
    }
    return config;
  },
};

export default nextConfig;
