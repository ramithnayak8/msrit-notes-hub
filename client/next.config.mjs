/** Where the Express API runs. The browser never talks to it directly. */
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Put <title>, description and Open Graph tags in <head> for every client
  // instead of streaming them into <body>. Link-preview crawlers (WhatsApp,
  // Telegram, Slack) and SEO audits read only <head>, and the metadata here is
  // static, so blocking on it costs nothing.
  htmlLimitedBots: /.*/,

  // /api/* is forwarded to the Express server, so the browser only ever talks
  // to this origin: no CORS, and the httpOnly refresh cookie is first-party.
  // A fallback rewrite runs after all of this app's own routes, dynamic ones
  // included, so /api/catalog (the local past-papers library) and /api/demo/*
  // (the dashboard, e.g. /api/demo/notes/:id) are still served from here.
  async rewrites() {
    return { fallback: [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }] };
  },
};

export default nextConfig;
