/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_AUTH_DISABLED: process.env.AUTH_DISABLED,
  },
};

export default nextConfig;
