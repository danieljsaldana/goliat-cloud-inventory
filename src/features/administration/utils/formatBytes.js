export function formatBytes(value, locale) {
  if (!Number.isFinite(value) || value < 0) return '—';
  const index = value ? Math.max(0, Math.min(Math.floor(Math.log(value) / Math.log(1024)), 4)) : 0;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    value / 1024 ** index,
  );
  return `${number} ${['B', 'KiB', 'MiB', 'GiB', 'TiB'][index]}`;
}
