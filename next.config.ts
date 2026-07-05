/** @type {import('next').NextConfig} */
const nextConfig: import('next').NextConfig = {
     allowedDevOrigins: ['192.168.1.134'],
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

