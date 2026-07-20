import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export breaks /api/parse — GPT and voice need a server. Remove for hackathon demo.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
