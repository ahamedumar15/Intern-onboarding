import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Fail the build on a type or lint error rather than shipping a broken board.
  // (Both default to false in Next 15; stated explicitly so nobody "fixes" CI
  // by flipping them — see NFR-3.)
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};

export default nextConfig;
