/** @type {import('next').NextConfig} */
const nextConfig = {
  // Put <title>, description and Open Graph tags in <head> for every client
  // instead of streaming them into <body>. Link-preview crawlers (WhatsApp,
  // Telegram, Slack) and SEO audits read only <head>, and the metadata here is
  // static, so blocking on it costs nothing.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
