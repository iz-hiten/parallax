/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // the packed market file is read by server code only
  serverExternalPackages: ["firebase-admin"],
};
export default nextConfig;
