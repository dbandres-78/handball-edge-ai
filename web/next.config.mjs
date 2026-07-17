/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // El lib compartido vive fuera de /web (../src/ingestion). Permite transpilarlo.
  transpilePackages: [],
};

export default nextConfig;
