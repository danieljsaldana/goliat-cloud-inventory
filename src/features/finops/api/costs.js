import { requestJson } from '@/services/requestJson.js';
import { appBaseUrl } from '@/app/routing/navigation.js';

export async function loadCosts(month, basis, signal) {
  const url = new URL('api/finops/costs/', appBaseUrl());
  url.search = new URLSearchParams({ month, basis }).toString();
  const data = await requestJson(url, { signal });
  if (
    !['ready', 'partial', 'unavailable', 'not-configured'].includes(data.status) ||
    data.basis !== basis ||
    data.period?.month !== month ||
    !Number.isFinite(Date.parse(data.period.from)) ||
    !Number.isFinite(Date.parse(data.period.to)) ||
    !Array.isArray(data.rows) ||
    !Array.isArray(data.subscriptions) ||
    data.rows.some(
      (row) =>
        !Number.isFinite(row.amount) ||
        typeof row.date !== 'string' ||
        typeof row.resourceId !== 'string' ||
        typeof row.serviceName !== 'string' ||
        typeof row.subscriptionId !== 'string' ||
        !/^[A-Z]{3}$/.test(row.currency),
    )
  )
    throw new Error('invalid_cost_response');
  return data;
}
