export function compareMigrations(migrations, rows) {
  const applied = new Map(rows.map((row) => [row.name, row]));
  const names = new Set(migrations.map(({ name }) => name));
  const pending = migrations.filter(({ name }) => !applied.has(name)).map(({ name }) => name);
  const drift = migrations
    .filter(({ name, checksum }) => applied.has(name) && applied.get(name).checksum !== checksum)
    .map(({ name }) => name);
  const missingFiles = rows.filter(({ name }) => !names.has(name)).map(({ name }) => name);
  const highestApplied = migrations.reduce(
    (maximum, migration) =>
      applied.has(migration.name) ? Math.max(maximum, migration.version) : maximum,
    0,
  );
  const outOfOrder = migrations
    .filter(({ name, version }) => !applied.has(name) && version < highestApplied)
    .map(({ name }) => name);
  return {
    ready: migrations.length > 0 && !pending.length && !drift.length && !outOfOrder.length,
    applied: rows.map(({ name, applied_at }) => ({ name, appliedAt: applied_at })),
    pending,
    drift,
    missingFiles,
    outOfOrder,
  };
}
