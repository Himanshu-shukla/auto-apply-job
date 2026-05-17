/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "pdf-parse", "mammoth"]
  }
};

export default nextConfig;
