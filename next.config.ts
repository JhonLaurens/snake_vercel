import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  eslint: {
    // 构建时忽略ESLint错误
    ignoreDuringBuilds: true,
  },
  // Optimización para producción
  compress: true,
  poweredByHeader: false,
  // Configuración para Vercel
  output: 'standalone',
};

export default nextConfig;
