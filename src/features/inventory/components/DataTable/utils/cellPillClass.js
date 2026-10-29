import { SUCCESS_STATES, TRANSITION_STATES, ERROR_STATES } from '../constants.js';

export function cellPillClass(header, value) {
  if (header === 'resourceProvider') return 'provider-pill';
  const state = value
    .trim()
    .toLowerCase()
    .replace(/^powerstate\//, '');
  if (SUCCESS_STATES.has(state)) return 'success-pill';
  if (TRANSITION_STATES.has(state)) return 'warning-pill';
  if (ERROR_STATES.has(state)) return 'error-pill';
  return 'muted-pill';
}
