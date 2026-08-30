import { LegalDoc, LEGAL_DOCS } from '../legal';
import { escapeHtml, inlineMarkup } from '../markdown';
import { page } from './layout';
import { assetUrl } from '../fingerprint';
import { siteImage } from '../share';

/** The other document, so each page offers the one a reader is not on. */
function crossLinks(doc: LegalDoc): string {
  const others = LEGAL_DOCS.filter((d) => d.path !== doc.path);
  if (!others.length) return '';
  return `<nav class="legalalso">${others
    .map((d) => `<a href="${d.path}">${escapeHtml(d.title)}</a>`)
    .join('')}</nav>`;
}

export function renderLegal(doc: LegalDoc): string {
  const sections = doc.sections
    .map(
      (s) => `<section>
        <h2>${escapeHtml(s.heading)}</h2>
        ${(s.body || []).map((p) => `<p>${inlineMarkup(p)}</p>`).join('\n        ')}
        ${
          s.list
            ? `<ul>${s.list.map((i) => `<li>${inlineMarkup(i)}</li>`).join('')}</ul>`
            : ''
        }
      </section>`
    )
    .join('\n      ');

  return page({
    title: `${doc.title} — Klaus Hofrichter`,
    description: doc.description,
    bodyClass: 'legalpage',
    path: doc.path,
    image: siteImage(assetUrl('palette.png')),
    body: `<main class="legalwrap">
  <a class="crumb" href="/#about">&larr; Back to the gallery</a>
  <h1>${escapeHtml(doc.title)}</h1>
  <p class="updated">Last updated ${escapeHtml(doc.updated)}</p>
  <div class="lead">
      ${doc.intro.map((p) => `<p>${inlineMarkup(p)}</p>`).join('\n      ')}
  </div>
      ${sections}
  ${crossLinks(doc)}
</main>`,
  });
}
