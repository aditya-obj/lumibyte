/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.leetcode.com',
        port: '',
        pathname: '/**',
      },
      // Add any other domains you need
    ],
    domains: ['assets.leetcode.com'], // Add this as a fallback
  },
};

export default nextConfig;
