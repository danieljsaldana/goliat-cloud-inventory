import { number, records } from '../../../core/table/index.js';

export function inventoryStats(files) {
  const totals = records(files['resource-totals']).filter((row) => row.subscriptionName !== 'ALL');
  const source = totals.length > 0 ? totals : records(files['resource-types']);
  return {
    resources: source.reduce((sum, row) => sum + number(row.resources), 0),
    subscriptions: new Set(source.map((row) => row.subscriptionId)).size,
    views: Object.keys(files).length,
  };
}
