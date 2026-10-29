export const unique = (values) =>
  [...new Set(values.filter((value) => value !== null && value !== undefined))].sort();
