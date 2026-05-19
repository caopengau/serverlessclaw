import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Manually load .env.local to guarantee environment variables are available during early config evaluation
try {
  const envLocalPath = path.resolve(__dirname, '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const lines = fs.readFileSync(envLocalPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.trim().match(/^([\w.-]+)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (err) {
  console.warn('[NextConfig] Failed to manually load .env.local:', err);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // OpenNext reads Next standalone artifacts from .next/standalone.
  output: 'standalone',
  transpilePackages: [
    '@serverlessclaw/core',
    '@serverlessclaw/ui',
    '@serverlessclaw/hooks',
    ...(process.env.NEXT_PUBLIC_ACTIVE_EXTENSIONS
      ? [process.env.NEXT_PUBLIC_ACTIVE_EXTENSIONS.split('/')[0]]
      : []),
  ].filter((pkg) => {
    try {
      require.resolve(pkg + '/package.json');
      return true;
    } catch {
      return false;
    }
  }),
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

    // Resolve extension bridge dynamically based on the active local workspace extension
    const extensionPath = process.env.NEXT_PUBLIC_ACTIVE_EXTENSIONS
      ? path.resolve(__dirname, '../../../' + process.env.NEXT_PUBLIC_ACTIVE_EXTENSIONS)
      : path.resolve(__dirname, './src/extensions/index.ts');

    const extensionDir = process.env.NEXT_PUBLIC_ACTIVE_EXTENSIONS
      ? path.resolve(__dirname, '../../../', process.env.NEXT_PUBLIC_ACTIVE_EXTENSIONS, '../..')
      : null;

    const messagesEnPath =
      extensionDir && fs.existsSync(path.join(extensionDir, 'messages/en.json'))
        ? path.join(extensionDir, 'messages/en.json')
        : path.resolve(__dirname, './src/extensions/messages/en.json');

    const messagesCnPath =
      extensionDir && fs.existsSync(path.join(extensionDir, 'messages/cn.json'))
        ? path.join(extensionDir, 'messages/cn.json')
        : path.resolve(__dirname, './src/extensions/messages/cn.json');

    console.log('[NextConfig] resolved extensionPath:', extensionPath);

    // Ensure cross-package resolution works for workspace packages
    config.resolve.alias = {
      ...config.resolve.alias,
      'virtual-extensions': extensionPath,
      'virtual-messages-en': messagesEnPath,
      'virtual-messages-cn': messagesCnPath,
    };

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
