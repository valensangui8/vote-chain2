import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Fix for modules that shouldn't be bundled (test files from dependencies)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Ignore test files in node_modules that cause build issues
    config.module.rules.push({
      test: /node_modules[\\/](thread-stream|pino)[\\/].*\.(test|spec)\.(js|ts)$/,
      use: "null-loader",
    });

    return config;
  },
  // External packages that shouldn't be bundled on server
  serverExternalPackages: ["pino", "thread-stream"],
};

export default nextConfig;
