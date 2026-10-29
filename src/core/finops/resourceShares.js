export function resourceShares(resources, limit = 5) {
  const grouped = new Map();
  for (const resource of resources) {
    const key = JSON.stringify([resource.subscriptionId, resource.resourceId.toLowerCase()]);
    const entry = grouped.get(key) || { ...resource, key, amount: 0, services: new Set() };
    entry.amount += resource.amount;
    if (resource.serviceName) entry.services.add(resource.serviceName);
    grouped.set(key, entry);
  }
  const totals = [...grouped.values()].sort((a, b) => b.amount - a.amount);
  const positiveTotal = totals.reduce((sum, { amount }) => sum + Math.max(0, amount), 0);
  const entries = totals.map((entry) => ({
    ...entry,
    services: [...entry.services].sort(),
    share: entry.amount > 0 ? entry.amount / positiveTotal : null,
  }));
  const positive = entries.filter(({ amount }) => amount > 0);
  const rest = positive.slice(limit);
  const otherAmount = rest.reduce((sum, { amount }) => sum + amount, 0);
  const slices = positive.slice(0, limit);
  if (rest.length) {
    slices.push({
      key: 'other-resources',
      other: true,
      count: rest.length,
      amount: otherAmount,
      share: otherAmount / positiveTotal,
    });
  }
  return {
    entries,
    slices,
    positiveTotal,
    credits: totals.reduce((sum, { amount }) => sum + Math.min(0, amount), 0),
  };
}
