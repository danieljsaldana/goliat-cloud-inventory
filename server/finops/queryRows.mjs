export function costQueryRows(properties, subscriptionId, period) {
  if (!Array.isArray(properties?.columns) || !Array.isArray(properties.rows))
    throw new Error('invalid_cost_response');
  const names = properties.columns.map((column) => column.name);
  const fields = ['PreTaxCost', 'UsageDate', 'ResourceId', 'ServiceName', 'Currency'];
  const indexes = fields.map((name) => names.indexOf(name));
  if (indexes.some((index) => index < 0)) throw new Error('invalid_cost_response');
  return properties.rows.map((row) => {
    if (!Array.isArray(row) || row.length !== names.length)
      throw new Error('invalid_cost_response');
    const [amount, rawDate, resourceId, serviceName, currency] = indexes.map((index) => row[index]);
    const digits = String(rawDate);
    const date = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    if (
      !Number.isFinite(amount) ||
      !/^\d{8}$/.test(digits) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date ||
      date < period.from.slice(0, 10) ||
      date > period.to.slice(0, 10) ||
      typeof resourceId !== 'string' ||
      typeof serviceName !== 'string' ||
      !/^[A-Z]{3}$/.test(currency)
    )
      throw new Error('invalid_cost_response');
    if (resourceId && !resourceId.toLowerCase().startsWith(`/subscriptions/${subscriptionId}/`))
      throw new Error('invalid_cost_scope');
    return { date, amount, resourceId, serviceName, currency, subscriptionId };
  });
}
