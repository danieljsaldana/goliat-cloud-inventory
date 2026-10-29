export default {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/docs/architecture.html': ['./docs/architecture.html'],
    '/docs/azure-deployment.html': ['./docs/azure-deployment.html'],
    '/api/ready': ['./server/migrations/*.sql', './server/schema/*.sql'],
  },
  trailingSlash: true,
  poweredByHeader: false,
  // Evita reutilizar resoluciones de binarios de otro SO al alternar Windows y Docker.
  experimental: { turbopackFileSystemCacheForDev: false },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
    ];
  },
};
