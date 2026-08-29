const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "2024-03" -> "March 2024". A bare year is left as it is. */
export function formatDate(date: string | undefined): string {
  if (!date) return '';
  const parts = String(date).split('-');
  const month = MONTHS[Number(parts[1]) - 1];
  return parts.length === 1 || !month ? parts[0] : `${month} ${parts[0]}`;
}

export function formatMoney(amount: number, currency = 'USD'): string {
  const symbol = currency === 'USD' ? '$' : '';
  const suffix = currency && currency !== 'USD' ? ` ${currency}` : '';
  return `${symbol}${amount.toLocaleString('en-US')}${suffix}`;
}
