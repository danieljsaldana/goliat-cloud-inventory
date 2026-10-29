export function chartSegments(slices, total, colors, fallbackName) {
  return slices.map(([name, value], index) => ({
    category: `slice-${index}`,
    name: name || fallbackName,
    value,
    share: value / total,
    fill: colors[index % colors.length],
  }));
}
