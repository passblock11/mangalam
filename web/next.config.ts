import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "behlrsqilhzhniglhgqh.supabase.co" },
    ],
  },
};

export default nextConfig;
