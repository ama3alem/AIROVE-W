/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@airove/shared'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src'),
    };
    return config;
  },
};

export default nextConfig;
