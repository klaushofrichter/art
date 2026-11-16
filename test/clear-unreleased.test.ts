import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/* scripts/clear-unreleased.sh, which deploy-production.yml runs on main after
   each release: the lines the release published come out of [Unreleased],
   and nothing else in the file moves. */

const ROOT = join(__dirname, '..');
const SCRIPT = join(ROOT, 'scripts', 'clear-unreleased.sh');

const HEAD = `# Changelog

Intro paragraph.

<!-- The comment above the heading,
     several lines of it. -->
`;

function run(changelog: string, published: string) {
  const dir = mkdtempSync(join(tmpdir(), 'clear-unreleased-'));
  const file = join(dir, 'CHANGELOG.md');
  const notes = join(dir, 'published.md');
  writeFileSync(file, changelog);
  writeFileSync(notes, published);
  const out = execFileSync('bash', [SCRIPT, file, notes], { encoding: 'utf8' });
  return { text: readFileSync(file, 'utf8'), out };
}

/** What scripts/unreleased-notes.sh prints for a section: its lines, blanks dropped. */
const notesOf = (section: string) => section.split('\n').filter((l) => l.trim()).join('\n') + '\n';

describe('clearing the published notes out of [Unreleased]', () => {
  const section = [
    '- **One thing.** Over two',
    '  lines.',
    '',
    '- Another thing.',
  ].join('\n');

  it('takes notes in and leaves an empty section, with the rest of the file unchanged', () => {
    const { text, out } = run(`${HEAD}## [Unreleased]\n\n${section}\n`, notesOf(section));
    expect(text).toBe(`${HEAD}## [Unreleased]\n\n`);
    expect(out).toContain('took the published notes out');
  });

  it('leaves whatever follows the section exactly as it was', () => {
    const after = '## [Older]\n\n- Not touched.\n\n## [Oldest]\n\n- Nor this.\n';
    const { text } = run(`${HEAD}## [Unreleased]\n\n${section}\n\n${after}`, notesOf(section));
    expect(text).toBe(`${HEAD}## [Unreleased]\n\n${after}`);
  });

  it('keeps a note that was merged after the promotion and so was not published', () => {
    const late = '- Merged to main after the release was cut.';
    const { text } = run(`${HEAD}## [Unreleased]\n\n${section}\n\n${late}\n`, notesOf(section));
    expect(text).toBe(`${HEAD}## [Unreleased]\n\n${late}\n`);
  });

  it('does nothing to a section that is already empty', () => {
    const empty = `${HEAD}## [Unreleased]\n\n`;
    const { text, out } = run(empty, notesOf(section));
    expect(text).toBe(empty);
    expect(out).toContain('nothing to take out');
  });

  it('does nothing when the notes were already taken out by hand', () => {
    const late = `${HEAD}## [Unreleased]\n\n- Something new.\n`;
    const { text, out } = run(late, notesOf(section));
    expect(text).toBe(late);
    expect(out).toContain('nothing to take out');
  });

  it('empties this repository\'s own CHANGELOG.md, given what it would publish', () => {
    const real = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
    const published = execFileSync('bash', [join(ROOT, 'scripts', 'unreleased-notes.sh')], { encoding: 'utf8' });
    const { text } = run(real, published);
    const heading = real.indexOf('## [Unreleased]');
    // Everything up to and including the heading, the comment above it among
    // it, is byte for byte the same; under it, only the blank line.
    expect(text).toBe(real.slice(0, heading) + '## [Unreleased]\n\n');
  });
});
