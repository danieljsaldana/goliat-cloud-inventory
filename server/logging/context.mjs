import { AsyncLocalStorage } from 'node:async_hooks';

const key = Symbol.for('cloud-inventory.log-context');
export const logContext = (globalThis[key] ??= new AsyncLocalStorage());

export function withLogContext(fields, work) {
  return logContext.run({ ...logContext.getStore(), ...fields }, work);
}
