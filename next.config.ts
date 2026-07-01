import type { NextConfig } from "next";
import { version } from "./package.json";

// Origine Supabase (per consentire fetch/realtime dal browser nella CSP).
const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : "";
  } catch {
    return "";
  }
})();

// Content-Security-Policy: restrittiva ma compatibile con Next/React.
// 'unsafe-inline' su script/style è necessario per il bootstrap di Next e per lo
// script anti-flash del tema (vedi src/app/layout.tsx); il resto è bloccato.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${
    supabaseOrigin ? ` ${supabaseOrigin} ${supabaseOrigin.replace(/^https/, "wss")}` : ""
  }`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Versione mostrata in UI: fonte unica = package.json (niente numeri a mano).
  env: { NEXT_PUBLIC_APP_VERSION: version },
  // better-sqlite3 è un modulo nativo: va lasciato esterno al bundle server.
  // mqtt usa i moduli Node net/tls per parlare con le stampanti in LAN: fuori dal bundle.
  serverExternalPackages: ["better-sqlite3", "mqtt"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
