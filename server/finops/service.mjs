import { azureCredential } from '../modules/azure/storage/credential.mjs';
import { getInventory } from '../modules/azure/services/inventory.mjs';
import { listSubscriptions } from '../../src/core/inventory/subscriptions.js';
import { costPeriod } from '../../src/core/finops/period.js';
import { costSettings } from './settings.mjs';
import { costClient } from './client.mjs';
import { COST_LIMITS } from './limits.mjs';

const cache = new Map();
const credentials = new Map();
const capacity = { active: 0 };
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export async function getCosts({
  month,
  basis = 'ActualCost',
  env = process.env,
  inventory = getInventory,
  client,
  now = new Date(),
  cached = true,
} = {}) {
  if (!['ActualCost', 'AmortizedCost'].includes(basis)) throw new TypeError('invalid_cost_basis');
  const period = costPeriod(month, now);
  const settings = costSettings(env);
  const catalog = settings.ids.length
    ? settings.ids.map((id) => ({ id, name: id }))
    : listSubscriptions((await inventory()).files).filter(({ id }) => UUID.test(id));
  if (catalog.length > 20) throw new TypeError('invalid_cost_configuration');
  const base = { basis, period, checkedAt: now.toISOString(), rows: [], subscriptions: [] };
  if (!catalog.length) return { ...base, status: 'not-configured' };
  // Includes the identity configuration: a role/credential change cannot reuse another identity's cache.
  const identityKey = JSON.stringify([
    settings.mode,
    env.AZURE_TENANT_ID,
    env.AZURE_CLIENT_ID,
    env.AZURE_CLIENT_SECRET,
  ]);
  const key = JSON.stringify([identityKey, catalog, period.month, basis]);
  const previous = cache.get(key);
  if (cached && previous && previous.expires > now.getTime()) return previous.promise;
  if (capacity.active >= COST_LIMITS.concurrentQueries)
    throw Object.assign(new Error('cost_queries_busy'), { status: 429 });
  const load = async () => {
    if (!client) {
      if (!credentials.has(identityKey))
        credentials.set(identityKey, azureCredential({ ...env, AZURE_AUTH_MODE: settings.mode }));
      client = costClient(credentials.get(identityKey));
    }
    const signal = AbortSignal.timeout(60000);
    const state = { cursor: 0, subscriptions: Array(catalog.length), rows: [], bytes: 0 };
    const worker = async () => {
      while (state.cursor < catalog.length) {
        const index = state.cursor++;
        const subscription = catalog[index];
        try {
          const rows = await client.query(subscription.id, period, basis, signal);
          const bytes = Buffer.byteLength(JSON.stringify(rows));
          if (
            state.rows.length + rows.length > COST_LIMITS.rows ||
            state.bytes + bytes > COST_LIMITS.resultBytes
          )
            throw new Error('cost_result_too_large');
          const name =
            subscription.name === subscription.id && client.subscriptionName
              ? await client.subscriptionName(subscription.id, signal)
              : subscription.name;
          state.rows.push(...rows);
          state.bytes += bytes;
          state.subscriptions[index] = { ...subscription, name, status: 'ready' };
        } catch (error) {
          const statuses = {
            401: 'forbidden',
            403: 'forbidden',
            400: 'unsupported',
            404: 'unsupported',
            429: 'rate-limited',
          };
          state.subscriptions[index] = {
            ...subscription,
            status: statuses[error.status] || 'unavailable',
          };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, catalog.length) }, worker));
    const available = state.subscriptions.filter(({ status }) => status === 'ready').length;
    const status = available === catalog.length ? 'ready' : 'partial';
    return {
      ...base,
      checkedAt: new Date().toISOString(),
      status: available ? status : 'unavailable',
      rows: state.rows,
      subscriptions: state.subscriptions,
    };
  };
  const execute = async () => {
    capacity.active += 1;
    try {
      return await load();
    } finally {
      capacity.active -= 1;
    }
  };
  const promise = execute();
  if (cached) {
    if (cache.size >= 32) cache.delete(cache.keys().next().value);
    cache.set(key, { promise, expires: now.getTime() + 600000, bytes: 0 });
    try {
      const result = await promise;
      // A superseded query must not replace a newer cache entry.
      if (cache.get(key)?.promise === promise) {
        cache.set(key, {
          promise,
          expires: now.getTime() + (result.status === 'ready' ? 600000 : 30000),
          bytes: Buffer.byteLength(JSON.stringify(result)),
        });
        while (
          [...cache.values()].reduce((total, entry) => total + entry.bytes, 0) >
          COST_LIMITS.cacheBytes
        )
          cache.delete(cache.keys().next().value);
      }
      return result;
    } catch (error) {
      if (cache.get(key)?.promise === promise) cache.delete(key);
      throw error;
    }
  }
  return promise;
}
