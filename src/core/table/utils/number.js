export function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}
