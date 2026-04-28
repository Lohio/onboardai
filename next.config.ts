import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['google-auth-library', 'stripe', 'mercadopago'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // CSP gestionada por middleware (nonce por request) — ver src/middleware.ts
        ],
      },
    ]
  },
};

export default nextConfig;
