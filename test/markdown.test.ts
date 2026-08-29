import { describe, it, expect } from 'vitest';
import { inlineMarkup, escapeHtml, plainText } from '../src/markdown';

describe('inlineMarkup', () => {
  it('renders bold and italic', () => {
    expect(inlineMarkup('a **b** c *d*')).toBe('a <strong>b</strong> c <em>d</em>');
  });

  it('prefers bold over italic when they collide', () => {
    expect(inlineMarkup('**both**')).toBe('<strong>both</strong>');
  });

  it('escapes markup before it can become markup', () => {
    expect(inlineMarkup('<script>alert(1)</script>'))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes an attribute break-out attempt', () => {
    expect(inlineMarkup('" onload="x')).toBe('&quot; onload=&quot;x');
  });

  it('leaves an unmatched asterisk alone', () => {
    expect(inlineMarkup('2 * 3 = 6')).toBe('2 * 3 = 6');
  });

  it('handles empty input', () => {
    expect(inlineMarkup(undefined)).toBe('');
    expect(inlineMarkup('')).toBe('');
  });
});

describe('escapeHtml', () => {
  it('escapes the four characters that matter', () => {
    expect(escapeHtml('<>&"')).toBe('&lt;&gt;&amp;&quot;');
  });
  it('escapes ampersands first, so entities are not double-built', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});

describe('plainText', () => {
  it('strips the markup without leaving tags', () => {
    expect(plainText('a **b** and *c*')).toBe('a b and c');
  });
});
