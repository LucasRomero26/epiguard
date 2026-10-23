/** @type {import('next').NextConfig} */
const nextConfig = {
  // Never ship browser source maps in production builds.
  productionBrowserSourceMaps: false,
  async rewrites() {
    // Serve the llms.txt standard file under the singular name as well.
    return [{ source: '/llm.txt', destination: '/llms.txt' }];
  },
};

export default nextConfig;
