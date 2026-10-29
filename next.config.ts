import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: { "/api/workspace/report": ["./assets/report-fonts/**/*", "./public/brand/iznera-logo.png"] },
  async redirects() {
    const views: Record<string,string>={graph:'graph',timeline:'timeline',tests:'tests',decisions:'history',models:'models',gallery:'gallery',study:'study'};
    return [
      ...Object.entries(views).map(([route,view])=>({source:`/app/${route}`,destination:`/workspace?view=${view}`,permanent:false})),
      {source:'/app/capture',destination:'/workspace?capture=1',permanent:false},
      {source:'/app',destination:'/workspace',permanent:false},
      {source:'/app/:path*',destination:'/workspace',permanent:false},
      {source:'/pricing',destination:'/about',permanent:false},
    ];
  },
  async rewrites() {
    const pages = ["features", "about", "faq", "research", "contact", "privacy-policy", "materials", "demo", "workspace"];
    const assets = ["assets", "materials"];
    const files = ["astra.css", "astra.js", "astra-copy.js", "tracelab.css", "tracelab.js", "workspace.css", "workspace.js", "workspace-store.js", "workspace-views.css", "workspace-views.js", "workspace-shell.css", "workspace-canvas.css", "workspace-canvas.js", "workspace-astra.css", "workspace-server.js", "workspace-product-controls.js", "workspace-i18n.js", "product-entry.js", "workspace-measurements-template.csv"];
    return { beforeFiles: [
      ...['astra-dots.js','astra-dots.css','astra-navigation.js','astra-navigation.css','astra-effects.js','astra-effects.css','workspace-navigation.js','workspace-navigation.css'].map(name=>({source:`/${name}`,destination:`/_presentation/${name}`})),
      ...['workspace-team.js','workspace-team-copy.js','workspace-inbox.js','workspace-inbox-copy.js','workspace-chat.js','workspace-chat-copy.js','workspace-chat-model.js','workspace-chat-call.js','workspace-chat.css'].map(name=>({source:`/${name}`,destination:`/_presentation/${name}`})),
      {source:'/workspace-record-history.js',destination:'/_presentation/workspace-record-history.js'},
      ...["workspace-filters.js","workspace-sources.js","workspace-sources-copy.js"].map(name=>({source:`/${name}`,destination:`/_presentation/${name}`})),
      ...["workspace-media.js","workspace-media-copy.js","workspace-media-editor.js","workspace-media.css"].map(name=>({source:`/${name}`,destination:`/_presentation/${name}`})),
      ...["workspace-outbox.js","workspace-report.js","workspace-shell-i18n.js","offline-capture.html","offline-capture.js","offline-capture.css"].map(name=>({source:`/${name}`,destination:`/_presentation/${name}`})),
      { source: "/", destination: "/_presentation/index.html" },
      ...pages.map(name => ({ source: `/${name}`, destination: `/_presentation/${name}/index.html` })),
      { source: "/demo/workspace", destination: "/_presentation/workspace/index.html" },
      ...files.map(name => ({ source: `/${name}`, destination: `/_presentation/${name}` })),
      ...assets.map(name => ({ source: `/${name}/:path*`, destination: `/_presentation/${name}/:path*` })),
    ], afterFiles: [], fallback: [] };
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
