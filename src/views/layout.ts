import { appVersion } from '../version';
import { escapeHtml } from '../markdown';
import { assetUrl } from '../fingerprint';
import { ShareImage, absolute } from '../share';
import { SITE_URL } from '../site';

/* The faces used above the fold on every page. They are declared in app.css,
   which the browser only parses after fetching it — preloading starts them in
   parallel instead. The 500-weight mono is used on the legal pages only and is
   left to load on demand. */
const PRELOAD_FONTS = [
  '/fonts/bodoni-moda-v28-latin.woff2',
  '/fonts/archivo-v25-latin.woff2',
  '/fonts/ibm-plex-mono-v20-latin-400.woff2',
];

export interface PageOptions {
  title: string;
  description: string;
  body: string;
  /** Extra markup for <head> — the gallery uses it for its manifest. */
  head?: string;
  /** Public paths under public/, fingerprinted automatically. */
  scripts?: string[];
  bodyClass?: string;
  /** Path on this site, made absolute for og:url. A shared link should name
   *  the page it came from, not whatever the crawler was redirected to. */
  path?: string;
  /** The picture a link preview should show. */
  image?: ShareImage | null;
}

/** og:image and the Twitter equivalents. Twitter falls back to the Open Graph
 *  tags for everything but the card type, so only that is repeated. */
function shareTags(image: ShareImage | null | undefined): string {
  if (!image) return '<meta name="twitter:card" content="summary">';
  const lines = [
    `<meta property="og:image" content="${escapeHtml(image.url)}">`,
    `<meta property="og:image:alt" content="${escapeHtml(image.alt)}">`,
  ];
  // Optional, but they let a crawler lay the card out before fetching.
  if (image.width && image.height) {
    lines.push(`<meta property="og:image:width" content="${image.width}">`);
    lines.push(`<meta property="og:image:height" content="${image.height}">`);
  }
  lines.push(`<meta name="twitter:card" content="${image.card}">`);
  return lines.join('\n');
}

export function page(o: PageOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${escapeHtml(o.title)}</title>
<meta name="description" content="${escapeHtml(o.description)}">
<meta name="generator" content="art v${appVersion()}">
<meta property="og:title" content="${escapeHtml(o.title)}">
<meta property="og:description" content="${escapeHtml(o.description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Klaus Hofrichter">
<meta property="og:locale" content="en_US">
${o.path ? `<meta property="og:url" content="${escapeHtml(absolute(o.path))}">
<link rel="canonical" href="${escapeHtml(absolute(o.path))}">` : `<meta property="og:url" content="${SITE_URL}">`}
${shareTags(o.image)}
<link rel="icon" type="image/png" href="${assetUrl('palette.png')}">
${PRELOAD_FONTS.map((f) => `<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`).join('\n')}
<link rel="stylesheet" href="${assetUrl('app.css')}">
${o.head || ''}
</head>
<body${o.bodyClass ? ` class="${o.bodyClass}"` : ''}>
${o.body}
${(o.scripts || []).map((s) => `<script src="${assetUrl(s)}" defer></script>`).join('\n')}
<!-- v${appVersion()} -->
</body>
</html>
`;
}
