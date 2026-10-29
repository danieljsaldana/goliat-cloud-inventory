export function resourceTypeLabel(value) {
  const type = String(value);
  const separator = type.lastIndexOf('/');
  const name = separator < 0 ? type : type.slice(separator + 1);
  return name || type;
}
