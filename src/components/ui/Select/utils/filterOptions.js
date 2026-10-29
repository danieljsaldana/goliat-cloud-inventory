export function filterOptions(options, query) {
  const normalize = (value) =>
    String(value).normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
  const needle = normalize(query.trim());
  return options.filter((option) => normalize(`${option.label} ${option.value}`).includes(needle));
}
