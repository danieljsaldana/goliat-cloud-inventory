/** @param {import('../types.js').TableFile|undefined} file */
export function records(file) {
  if (!file) return [];
  return file.rows.map((row) =>
    Object.fromEntries(file.headers.map((key, index) => [key, row[index]])),
  );
}
