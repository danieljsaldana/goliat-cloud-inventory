import { requestJson } from '../../../services/requestJson.js';
import { loadInventory } from './loadInventory.js';
import { RequestError } from '../../../services/RequestError.js';

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const timer = setTimeout(done, ms);
    function done() {
      signal?.removeEventListener('abort', abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export async function refreshInventory({ baseUrl, signal, fetcher, wait = pause, pollMs = 2000 }) {
  const timeout = AbortSignal.timeout(4500000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const url = new URL('api/inventory/azure/refresh/', baseUrl);
  const operation = await requestJson(url, {
    method: 'POST',
    signal: combined,
    fetcher,
  });
  if (operation.operationId) {
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(operation.operationId))
      throw new Error('Identificador de actualización inválido.');
    url.searchParams.set('operationId', operation.operationId);
    const progress = { finished: false };
    while (!progress.finished) {
      await wait(pollMs, combined);
      const status = await requestJson(url, { signal: combined, fetcher });
      if (status.status === 'failed') throw new RequestError(502, 'refresh_generation_failed');
      if (!['queued', 'running', 'retrying', 'succeeded'].includes(status.status))
        throw new Error('Estado de actualización inválido.');
      if (status.status === 'succeeded' && !status.running) {
        try {
          const imported = await requestJson(url, { method: 'POST', signal: combined, fetcher });
          progress.finished = !imported.operationId;
        } catch (error) {
          if (error.code !== 'refresh_busy') throw error;
        }
      }
    }
  }
  return loadInventory({ baseUrl, signal: combined, fetcher });
}
