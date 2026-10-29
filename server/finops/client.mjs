import { setTimeout as pause } from 'node:timers/promises';
import { costQueryRows } from './queryRows.mjs';
import { COST_LIMITS } from './limits.mjs';

const ORIGIN = 'https://management.azure.com';

export function costClient(credential, { fetcher = fetch, sleep = pause } = {}) {
  async function readPage(url, body, signal) {
    for (const attempt of [0, 1]) {
      signal?.throwIfAborted();
      const token = await credential.getToken(`${ORIGIN}/.default`, { abortSignal: signal });
      const response = await fetcher(url, {
        method: 'POST',
        redirect: 'error',
        cache: 'no-store',
        signal,
        headers: { authorization: `Bearer ${token.token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.status === 204) return { columns: [], rows: [], empty: true };
      if (!response.ok) {
        const delay = Number(
          response.headers.get('retry-after') ||
            response.headers.get('x-ms-ratelimit-microsoft.costmanagement-qpu-retry-after') ||
            1,
        );
        await response.body?.cancel();
        if (
          attempt === 0 &&
          (response.status === 429 || response.status >= 500) &&
          delay > 0 &&
          delay <= 3
        ) {
          await sleep(delay * 1000, undefined, { signal });
          continue;
        }
        throw Object.assign(new Error('cost_query_failed'), { status: response.status });
      }
      const reader = response.body.getReader();
      const state = { bytes: 0, chunks: [] };
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          state.bytes += chunk.value.byteLength;
          if (state.bytes > 8 * 1024 * 1024) throw new Error('cost_page_too_large');
          state.chunks.push(Buffer.from(chunk.value));
        }
        return JSON.parse(Buffer.concat(state.chunks).toString('utf8')).properties;
      } finally {
        await reader.cancel();
      }
    }
  }
  return {
    async subscriptionName(subscriptionId, signal) {
      try {
        const token = await credential.getToken(`${ORIGIN}/.default`, { abortSignal: signal });
        const response = await fetcher(
          `${ORIGIN}/subscriptions/${subscriptionId}?api-version=2022-12-01`,
          {
            headers: { authorization: `Bearer ${token.token}` },
            signal,
            redirect: 'error',
            cache: 'no-store',
          },
        );
        if (!response.ok) {
          await response.body?.cancel();
          return subscriptionId;
        }
        const subscription = await response.json();
        return subscription.subscriptionId?.toLowerCase() === subscriptionId &&
          typeof subscription.displayName === 'string'
          ? subscription.displayName
          : subscriptionId;
      } catch {
        return subscriptionId;
      }
    },
    async query(subscriptionId, period, basis, signal) {
      const path = `/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query`;
      const body = {
        type: basis,
        timeframe: 'Custom',
        timePeriod: { from: period.from, to: period.to },
        dataset: {
          granularity: 'Daily',
          aggregation: { totalCost: { name: 'PreTaxCost', function: 'Sum' } },
          grouping: [
            { type: 'Dimension', name: 'ResourceId' },
            { type: 'Dimension', name: 'ServiceName' },
          ],
        },
      };
      const state = { next: `${ORIGIN}${path}?api-version=2025-03-01`, seen: new Set(), rows: [] };
      while (state.next) {
        const url = new URL(state.next, ORIGIN);
        if (
          url.origin !== ORIGIN ||
          url.username ||
          url.password ||
          url.hash ||
          url.pathname.toLowerCase() !== path.toLowerCase() ||
          state.seen.has(url.href) ||
          state.seen.size >= 64
        )
          throw new Error('invalid_cost_pagination');
        state.seen.add(url.href);
        const page = await readPage(url, body, signal);
        if (!page?.empty) state.rows.push(...costQueryRows(page, subscriptionId, period));
        if (state.rows.length > COST_LIMITS.rows) throw new Error('too_many_cost_rows');
        if (page?.nextLink && typeof page.nextLink !== 'string')
          throw new Error('invalid_cost_pagination');
        state.next = page?.nextLink || null;
      }
      return state.rows;
    },
  };
}
