// The only markup allowed in an index.json description or About paragraph:
// *italic* and **bold**. Everything is escaped first, so a stray "<" in the
// text stays text — the JSON files can never inject markup into the page.
export function inlineMarkup(source: string | undefined): string {
  if (!source) return '';
  return escapeHtml(source)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

export function escapeHtml(source: string): string {
  return source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// The same subset with the tags removed, for <title>, meta descriptions and
// anywhere else that takes text rather than HTML.
export function plainText(source: string | undefined): string {
  if (!source) return '';
  return source.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
}
