/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the build resilient: lint/type errors are surfaced via `npm run lint` /
  // `npm run typecheck` rather than failing production builds during early phases.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
