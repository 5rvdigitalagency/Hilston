import type { NextConfig } from "next";

// Next.js hydration relies on inline scripts, so script-src keeps 'unsafe-inline' until nonces are added.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://vercel.live",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://vercel.live",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://vercel.live",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const noIndex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/manage/:path*", headers: noIndex },
      { source: "/staff-login", headers: noIndex },
      { source: "/tickets/:path*", headers: noIndex },
      { source: "/booking/:path*", headers: noIndex },
    ];
  },
};

export default nextConfig;
