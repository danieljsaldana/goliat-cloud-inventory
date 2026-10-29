export function legendPayload(segments) {
  return segments.map((segment) => ({
    dataKey: segment.category,
    value: segment.name,
    color: segment.fill,
    type: 'square',
    payload: segment,
  }));
}
