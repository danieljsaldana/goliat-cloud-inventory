import { REPORTS } from '../../../src/core/inventory/reports.js';

export const DOCUMENT_SCHEMA_VERSION = 2;
export const STORAGE_TIMEOUT_MS = 120000;
export const DERIVED_REPORTS = new Set([
  'subscriptions',
  'resource-totals',
  'tags-by-subscription',
  'tags',
]);
export const RAW_REPORT_IDS = REPORTS.filter(({ id }) => !DERIVED_REPORTS.has(id)).map(
  ({ id }) => id,
);
