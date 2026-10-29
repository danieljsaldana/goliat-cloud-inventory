import { REPORTS } from '../../core/inventory/reports.js';

export const EMPTY_FILES = {};
export const NETWORK_ERRORS = REPORTS.map(({ id }) => ({ id, code: 'network' }));
