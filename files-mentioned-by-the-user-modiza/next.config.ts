import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "oehmfsxsirfuwvfnvuwx.supabase.co",
        pathname: "/storage/v1/object/public/space-images/**",
      },
      {
        protocol: "https",
        hostname: "oehmfsxsirfuwvfnvuwx.supabase.co",
        pathname: "/storage/v1/object/public/community-images/**",
      },
      {
        protocol: "https",
        hostname: "oehmfsxsirfuwvfnvuwx.supabase.co",
        pathname: "/storage/v1/object/public/profile-images/**",
      },
    ],
  },
};
export default nextConfig;
