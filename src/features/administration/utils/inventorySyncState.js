export function inventorySyncState(importedAt, publishedAt, { importedEtag, publishedEtag } = {}) {
  const compareEtags =
    typeof importedEtag === 'string' &&
    importedEtag.length > 0 &&
    typeof publishedEtag === 'string' &&
    publishedEtag.length > 0;
  if (compareEtags && importedEtag === publishedEtag) return 'synced';
  const imported = typeof importedAt === 'string' ? Date.parse(importedAt) : NaN;
  const published = typeof publishedAt === 'string' ? Date.parse(publishedAt) : NaN;
  if (!Number.isFinite(imported) || !Number.isFinite(published))
    return compareEtags ? 'changed' : 'unknown';
  if (published > imported) return 'storageNewer';
  if (published < imported) return 'webNewer';
  return compareEtags ? 'changed' : 'timestampsMatch';
}
