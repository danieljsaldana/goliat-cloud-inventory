import { REPORT_GROUPS, REPORTS } from '../../../../../core/inventory/reports.js';
import { REPORT_ICONS } from '../../reportIcons.js';

export const INITIAL_COLUMNS = 4;
export const DEFAULT_ROWS_PER_PAGE = 2;
export const ROW_PAGE_SIZES = [2, 4, 8];

const detailOnly = new Set(['virtual-machine-summary', 'aks-node-pools', 'network-security-rules']);
export const SERVICES = REPORT_GROUPS.filter(
  ({ id }) => !['inventory', 'tags'].includes(id),
).flatMap((group) =>
  REPORTS.filter((report) => report.group === group.id && !detailOnly.has(report.id)).map(
    (report) => [report.labelKey, report.id, REPORT_ICONS[report.icon]],
  ),
);
