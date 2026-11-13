export function formatCurrency(value, locale = 'en-PK') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

export function formatDate(value, locale = 'en-GB') {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

export function formatNumber(value, locale = 'en-PK', options = {}) {
  return new Intl.NumberFormat(locale, options).format(Number(value) || 0);
}

export function formatRelativeDate(value, locale = 'en-GB') {
  if (!value) return '—';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return '—';
  const days = Math.round((timestamp - Date.now()) / 86400000);
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day');
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
