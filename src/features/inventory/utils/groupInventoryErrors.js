export function groupInventoryErrors(errors) {
  const groups = new Map();
  for (const { id, code, status } of errors) {
    const key = JSON.stringify([code, status ?? null]);
    if (!groups.has(key)) groups.set(key, { key, code, status, reports: [] });
    groups.get(key).reports.push(id);
  }
  return [...groups.values()];
}
