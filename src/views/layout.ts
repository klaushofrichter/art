import { appVersion } from '../version';
import { escapeHtml } from '../markdown';
import { assetUrl } from '../fingerprint';

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
