import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel デプロイ時のビルド最適化
  output: 'standalone',
};

export default nextConfig;

