/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.alicdn.com' },
      { protocol: 'https', hostname: '**.alibaba.com' },
      { protocol: 'https', hostname: '**.aliexpress.com' },
      { protocol: 'https', hostname: '**.mercadolibre.com' },
      { protocol: 'https', hostname: 'http2.mlstatic.com' },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
    outputFileTracingExcludes: {
      '*': ['puppeteer-core/**', 'chrome-aws-lambda/**'],
    },
  },
};

module.exports = nextConfig;
