import { formatCurrency, formatDate, formatNumber, formatRelativeDate, pluralize } from './formatters';

test('formats currency consistently for Pakistani rupees', () => {
  expect(formatCurrency(12500)).toContain('12,500');
  expect(formatCurrency(12500)).toMatch(/PKR|Rs/);
});

test('formats valid dates and rejects invalid values', () => {
  expect(formatDate('2026-10-24')).toContain('24');
  expect(formatDate('not-a-date')).toBe('—');
});

test('pluralizes singular and plural counts', () => {
  expect(pluralize(1, 'course')).toBe('1 course');
  expect(pluralize(2, 'course')).toBe('2 courses');
});

test('formats locale-aware numbers and relative dates', () => {
  expect(formatNumber(1234, 'en-US')).toBe('1,234');
  expect(formatRelativeDate(new Date(Date.now() + 86400000), 'en-US')).toBe('tomorrow');
});
