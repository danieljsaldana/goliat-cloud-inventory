export function chartRows(entries, formatLabel, fallbackName) {
  return entries.map(([name, resources]) => ({
    id: name,
    name: (formatLabel ? formatLabel(name) : name) || fallbackName,
    resources,
  }));
}
