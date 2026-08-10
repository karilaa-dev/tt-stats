import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,
  turbopack: {
    root: process.cwd(),
  },
  cacheLife: {
    stats: {
      stale: 300,
      revalidate: 300,
      expire: 3600,
    },
  },
}

export default nextConfig
