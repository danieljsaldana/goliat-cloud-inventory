export function summarizeCosts(
  data,
  { subscription = '', currency = '', group = 'serviceName' } = {},
) {
  const scoped = data.rows.filter((row) => !subscription || row.subscriptionId === subscription);
  const currencies = [...new Set(scoped.map((row) => row.currency))].sort();
  const selectedCurrency = currencies.includes(currency) ? currency : currencies[0] || '';
  const rows = scoped.filter((row) => row.currency === selectedCurrency);
  const names = new Map(data.subscriptions.map(({ id, name }) => [id, name]));
  const daily = new Map();
  const groups = new Map();
  const resources = new Map();
  for (const row of rows) {
    const match = row.resourceId.match(/\/resourceGroups\/([^/]+)/i);
    const resourceGroup = match ? match[1] : '';
    const label = group === 'resourceGroup' ? resourceGroup : row[group];
    const groupKey =
      group === 'resourceGroup' || group === 'resourceId'
        ? JSON.stringify([row.subscriptionId, label.toLowerCase()])
        : label;
    const groupName = group === 'subscriptionId' ? names.get(label) || label : label;
    const entry = groups.get(groupKey) || {
      key: groupKey,
      name: group === 'resourceId' ? row.resourceId.split('/').at(-1) || '' : groupName,
      resourceId: group === 'resourceId' ? row.resourceId : '',
      subscriptionName: names.get(row.subscriptionId) || row.subscriptionId,
      amount: 0,
    };
    entry.amount += row.amount;
    groups.set(groupKey, entry);
    daily.set(row.date, (daily.get(row.date) || 0) + row.amount);
    const key = JSON.stringify([row.subscriptionId, row.resourceId.toLowerCase(), row.serviceName]);
    const resource = resources.get(key) || {
      key,
      resourceId: row.resourceId,
      name: row.resourceId.split('/').at(-1) || '',
      subscriptionId: row.subscriptionId,
      subscriptionName: names.get(row.subscriptionId) || row.subscriptionId,
      resourceGroup,
      serviceName: row.serviceName,
      amount: 0,
    };
    resource.amount += row.amount;
    resources.set(key, resource);
  }
  const dates = [];
  const start = Date.parse(data.period.from.slice(0, 10));
  const end = Date.parse(data.period.to.slice(0, 10));
  for (const time of Array.from(
    { length: Math.floor((end - start) / 86400000) + 1 },
    (_, index) => start + index * 86400000,
  )) {
    const date = new Date(time).toISOString().slice(0, 10);
    dates.push({ date, amount: daily.has(date) ? daily.get(date) : null });
  }
  const subscriptions = data.subscriptions.filter(({ id }) => !subscription || id === subscription);
  return {
    currencies,
    currency: selectedCurrency,
    rows,
    daily: dates,
    groups: [...groups.values()].sort((a, b) => b.amount - a.amount),
    resources: [...resources.values()].sort((a, b) => b.amount - a.amount),
    total: rows.reduce((sum, row) => sum + row.amount, 0),
    services: new Set(rows.map((row) => row.serviceName)).size,
    chargedResources: new Set(
      rows
        .filter(({ resourceId }) => resourceId)
        .map(({ subscriptionId, resourceId }) =>
          JSON.stringify([subscriptionId, resourceId.toLowerCase()]),
        ),
    ).size,
    subscriptions,
    partial: subscriptions.some(({ status }) => status !== 'ready'),
  };
}
