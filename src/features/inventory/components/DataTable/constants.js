export const SUCCESS_STATES = new Set([
  'enabled',
  'running',
  'succeeded',
  'ready',
  'online',
  'ok',
  'published',
]);
export const TRANSITION_STATES = new Set([
  'creating',
  'updating',
  'deleting',
  'starting',
  'stopping',
  'pending',
]);
export const ERROR_STATES = new Set(['failed', 'error', 'canceled', 'cancelled']);
export const PILL_COLUMNS = new Set([
  'resourceProvider',
  'state',
  'powerState',
  'provisioningState',
]);
