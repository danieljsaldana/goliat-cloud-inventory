export function listSubscriptions(files) {
  const subscriptions = new Map();
  // El catálogo incluye también las suscripciones vacías y deshabilitadas.
  const sources = [files['subscriptions'], ...Object.values(files)];
  for (const file of sources) {
    if (!file) continue;
    const idColumn = file.headers.indexOf('subscriptionId');
    const nameColumn = file.headers.indexOf('subscriptionName');
    const stateColumn = file.headers.indexOf('state');
    for (const row of file.rows) {
      const id = row[idColumn];
      if (!id || id === 'ALL' || subscriptions.has(id)) continue;
      subscriptions.set(id, { id, name: row[nameColumn] || id, state: row[stateColumn] || '' });
    }
  }
  return [...subscriptions.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
