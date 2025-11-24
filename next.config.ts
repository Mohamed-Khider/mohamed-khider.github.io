import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
 allowedDevOrigins: ['http://192.168.70.75:3000'],
   eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
