import type { NextConfig } from "next";
import { documentCsp } from "./src/lib/document-csp";

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
    const views: Record<string,string>={graph:'graph',timeline:'timeline',tests:'tests',decisions:'history',models:'models',gallery:'gallery',study:'study',memory:'memory',iterations:'iterations',handoff:'handoff',inbox:'inbox',integrations:'sources'};
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
      ...['workspace-timeline-media.js','workspace-handoff.js','workspace-handoff-model.js','workspace-handoff-copy.js','workspace-handoff.css',"workspace-command.js","workspace-offline-account.js","workspace-outbox-backup.js","offline-account.css","workspace-report-model.js","workspace-report-composer.css","workspace-inbox-model.js","workspace-inbox.css",'workspace-media-upload.js','workspace-iterations.js','workspace-iterations-copy.js','workspace-iterations-model.js','workspace-iterations.css','workspace-core.js','workspace-core.css','language-switcher.js','language-switcher.css','theme-bootstrap.js','theme-toggle.js','theme-system.css','theme-public.css','theme-workspace.css','theme-account.css'].map(name=>({source:`/${name}`,destination:`/_presentation/${name}`})),
      ...['astra-dots.js','astra-dots.css','astra-navigation.js','astra-navigation.css','astra-effects.js','astra-effects.css','workspace-sidebar.js','workspace-sidebar.css'].map(name=>({source:`/${name}`,destination:`/_presentation/${name}`})),
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
    return [{ source: "/(.*)", headers: securityHeaders },
      ...['/', '/features', '/about', '/faq', '/research', '/contact', '/privacy-policy', '/materials', '/demo', '/workspace', '/demo/workspace', '/offline-capture.html', '/_presentation/:path*'].map(source=>({source,
        headers:[{key:'Content-Security-Policy',value:documentCsp({development:isDev})}]}))];
  },
};

export default nextConfig;
