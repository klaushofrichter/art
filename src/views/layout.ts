import { appVersion } from '../version';

export function pageShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="An art gallery by Klaus Hofrichter." />
  <style>
    :root {
      --bg: #0b0b10;
      --bg-tile: #14141d;
      --text: #f5f5f7;
      --text-muted: #9a9aad;
      --accent: #d4a15e;
      --border: #232333;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
    }
    main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 5rem 1.5rem 3rem;
    }
    header.hero {
      text-align: center;
      margin-bottom: 3.5rem;
    }
    h1 {
      font-size: 2.4rem;
      font-weight: 300;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      margin: 0 0 0.75rem;
    }
    .tagline {
      color: var(--text-muted);
      margin: 0;
    }
    .gallery {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
    }
    /* Placeholder frames: the gallery itself is not built yet, so these stand
       in for the artworks rather than pretending to be them. */
    .frame {
      aspect-ratio: 4 / 5;
      background: var(--bg-tile);
      border: 1px solid var(--border);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--border);
      font-size: 0.75rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }
    .frame:nth-child(3n+2) { aspect-ratio: 1 / 1; }
    .frame:nth-child(4n+3) { aspect-ratio: 5 / 4; }
    .note {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9rem;
      margin: 3rem 0 0;
    }
    footer {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.78rem;
      padding: 0 1.5rem 2.5rem;
    }
    @media (max-width: 700px) {
      .gallery { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 420px) {
      .gallery { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    ${bodyHtml}
  </main>
  <footer>
    art.klaushofrichter.net &middot; <span id="app-version">v${appVersion()}</span>
  </footer>
</body>
</html>
`;
}
