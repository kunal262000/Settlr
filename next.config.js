/** @type {import('next').NextConfig} */
const securityHeaders = [
  // Prevents the app from being embedded in an iframe on another site
  // (clickjacking protection).
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stops browsers from MIME-sniffing a response away from its declared
  // Content-Type (mitigates some content-injection attacks on uploads).
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Limits how much referrer information leaks to other origins when
  // navigating away from the app.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disables browser APIs this app has no reason to use.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Legacy XSS filter header, superseded by CSP but harmless to keep for
  // older browsers that still honor it.
  { key: 'X-XSS-Protection', value: '1; mode=block' },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
