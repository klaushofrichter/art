import { escapeHtml } from '../markdown';
import { page } from './layout';
import { assetUrl } from '../fingerprint';
import { siteImage } from '../share';
import { LEGAL_DOCS } from '../legal';

/** The site's own 404, in place of Express's bare "Cannot GET" (no lang, no
 *  styling, no way back). It is a document page like the terms and the
 *  privacy policy, in the same column and type, with a way back to the
 *  gallery. A purchase page for a picture that is not there uses it too, with
 *  its own words. Modelled on www-skylar-technology's src/views/notFound.ts. */
export function renderNotFound(
  heading = 'Nothing hangs here',
  text = 'There is no page at this address. The gallery is one page, and every room and picture in it has its own link from there.',
): string {
  return page({
    title: 'Page not found — Klaus Hofrichter',
    description: 'There is no page at this address.',
    bodyClass: 'legalpage',
    noindex: true,
    image: siteImage(assetUrl('palette.png')),
    body: `<main class="legalwrap">
  <a class="crumb" href="/">&larr; Back to the gallery</a>
  <h1>${escapeHtml(heading)}</h1>
  <p class="updated">Page not found</p>
  <div class="lead">
      <p>${escapeHtml(text)}</p>
  </div>
  <nav class="legalalso">${LEGAL_DOCS.map((d) => `<a href="${d.path}">${escapeHtml(d.title)}</a>`).join('')}</nav>
</main>`,
  });
}
