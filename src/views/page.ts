import { pageShell } from './layout';

// Nine empty frames: enough to read as a gallery wall, with nothing in them
// yet. The real content is specified later.
const FRAME_COUNT = 9;

export function renderPage(): string {
  const frames = Array.from(
    { length: FRAME_COUNT },
    () => '<div class="frame">Untitled</div>'
  ).join('');

  const body = `
    <header class="hero">
      <h1>Gallery</h1>
      <p class="tagline">An art gallery by Klaus Hofrichter</p>
    </header>

    <section class="gallery">${frames}</section>

    <p class="note">The gallery is being hung. Come back soon.</p>`;

  return pageShell('Gallery &middot; art.klaushofrichter.net', body);
}
