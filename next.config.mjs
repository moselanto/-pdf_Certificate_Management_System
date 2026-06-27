/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-lib + qrcode run server-side in route handlers; nothing special needed.
  experimental: { serverComponentsExternalPackages: ["pdf-lib", "qrcode", "xlsx"] },
};
export default nextConfig;
