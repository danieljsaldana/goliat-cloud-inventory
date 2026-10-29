export function inventoryTagKeys(files = {}) {
  const keys = new Map();
  const add = (key) => {
    if (typeof key === 'string' && key && !keys.has(key.toLowerCase()))
      keys.set(key.toLowerCase(), key);
  };
  for (const file of Object.values(files))
    for (const header of file.headers || []) if (header.startsWith('tag_')) add(header.slice(4));
  for (const id of ['resources', 'resource-groups']) {
    const file = files[id];
    const column = file?.headers.indexOf('tags_json') ?? -1;
    if (column < 0) continue;
    for (const row of file.rows) {
      try {
        const tags = JSON.parse(row[column]);
        if (tags && typeof tags === 'object' && !Array.isArray(tags))
          Object.keys(tags).forEach(add);
      } catch {
        // An incomplete inventory must not prevent editing known tag names.
      }
    }
  }
  return [...keys.values()].sort((a, b) => a.localeCompare(b));
}
