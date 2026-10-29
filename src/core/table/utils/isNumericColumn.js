export function isNumericColumn(rows, index) {
  return (
    rows.some((row) => row[index] !== '') &&
    rows.every((row) => row[index] === '' || Number.isFinite(Number(row[index])))
  );
}
