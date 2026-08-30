import { appVersion } from '../version';
import { escapeHtml } from '../markdown';
import { assetUrl } from '../fingerprint';
import { ShareImage, absolute } from '../share';
import { SITE_URL } from '../site';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,600' +
  '&family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap';

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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
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
