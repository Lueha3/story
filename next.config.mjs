/** @type {import('next').NextConfig} */
const nextConfig = {
  // The visitor page and the admin page are plain HTML files in /public.
  async rewrites() {
    return [
      { source: "/", destination: "/index.html" },
      { source: "/admin", destination: "/admin.html" },
    ];
  },
  async headers() {
    return [
      { source: "/admin", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
      { source: "/admin.html", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
};

export default nextConfig;
