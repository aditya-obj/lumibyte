/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.leetcode.com',
        port: '',
        pathname: '/uploads/**', // More specific pathname
      },
    ],
    domains: ['assets.leetcode.com'],
  },
};

export default nextConfig;
