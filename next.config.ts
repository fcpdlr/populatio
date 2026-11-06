import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/mundo", destination: "/", permanent: true },
      { source: "/como-se-calcula", destination: "/how-it-works", permanent: true },
      { source: "/acerca-de", destination: "/about", permanent: true },
      { source: "/privacidad", destination: "/privacy", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/data/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/world/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/rejilla.bin",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/rejilla_meta.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ];
  },
};

export default nextConfig;
