import { randomUUID } from 'node:crypto';

export function requestId(value) {
  if (typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)) return value;
  return randomUUID();
}
