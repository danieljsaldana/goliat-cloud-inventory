export function costPeriod(month, now = new Date()) {
  const current = now.toISOString().slice(0, 7);
  const selected = month || current;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(selected)) throw new TypeError('invalid_cost_period');
  const [year, number] = selected.split('-').map(Number);
  const offset = (now.getUTCFullYear() - year) * 12 + now.getUTCMonth() + 1 - number;
  if (offset < 0 || offset > 11) throw new TypeError('invalid_cost_period');
  const from = new Date(Date.UTC(year, number - 1, 1));
  const end = new Date(Date.UTC(year, number, 1) - 1);
  const to = end < now ? end : now;
  return { month: selected, from: from.toISOString(), to: to.toISOString() };
}
