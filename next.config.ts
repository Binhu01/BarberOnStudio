import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents disabled — incompatible with redirect() in server components
  // that also use Supabase (which calls Date.now() internally). Re-enable when
  // all dashboard routes are migrated to use cache/private patterns.
  // cacheComponents: true,
  // partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;