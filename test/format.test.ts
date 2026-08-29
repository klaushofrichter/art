import { describe, it, expect } from 'vitest';
import { formatDate, formatMoney } from '../src/format';

describe('formatDate', () => {
  it('turns an ISO month into a readable one', () => {
    expect(formatDate('2024-03')).toBe('March 2024');
    expect(formatDate('2025-01-14')).toBe('January 2025');
  });
  it('leaves a bare year alone', () => {
    expect(formatDate('2024')).toBe('2024');
  });
  it('survives nonsense rather than printing "undefined"', () => {
    expect(formatDate('2024-99')).toBe('2024');
    expect(formatDate(undefined)).toBe('');
  });
});

describe('formatMoney', () => {
  it('formats dollars with a symbol and thousands separators', () => {
    expect(formatMoney(340, 'USD')).toBe('$340');
    expect(formatMoney(1250, 'USD')).toBe('$1,250');
  });
  it('names any other currency instead of guessing a symbol', () => {
    expect(formatMoney(340, 'EUR')).toBe('340 EUR');
  });
});
