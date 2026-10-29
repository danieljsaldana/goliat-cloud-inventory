import { REPORTS } from '../../inventory/reports.js';
import { CATEGORY_SUMMARIES } from '../../inventory/categories.js';

export const PAGE_ROUTES = [
  [],
  ['inventario'],
  ['finops'],
  ['architecture'],
  ['admin'],
  ['members'],
  ['profile'],
  ...REPORTS.map(({ id }) => ['inventario', id]),
  ...CATEGORY_SUMMARIES.map(({ id }) => ['inventario', id]),
];
