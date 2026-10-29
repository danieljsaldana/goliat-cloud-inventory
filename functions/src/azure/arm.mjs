import { setTimeout as pause } from 'node:timers/promises';

const ORIGIN = 'https://management.azure.com';

export function armClient(credential, { fetcher = fetch, sleep = pause } = {}) {
  async function request(path, { body, signal } = {}) {
    const url = new URL(path, ORIGIN);
    if (url.origin !== ORIGIN || url.username || url.password)
      throw new Error('Endpoint ARM no permitido.');
    for (const attempt of [0, 1, 2, 3]) {
      signal?.throwIfAborted();
      const token = await credential.getToken(`${ORIGIN}/.default`, { abortSignal: signal });
      const response = await fetcher(url, {
        method: body ? 'POST' : 'GET',
        redirect: 'error',
        headers: { authorization: `Bearer ${token.token}`, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.any([AbortSignal.timeout(30000), ...[signal].filter(Boolean)]),
      });
      if (response.ok) return await response.json();
      const retryable = response.status === 429 || response.status >= 500;
      await response.body?.cancel();
      if (!retryable || attempt === 3) {
        const error = new Error(`Consulta ARM fallida (HTTP ${response.status}).`);
        error.status = response.status;
        throw error;
      }
      const retryAfter = Number(response.headers.get('retry-after'));
      await sleep(
        Math.min(30000, retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt),
        undefined,
        { signal },
      );
    }
  }

  async function list(path, signal) {
    const state = { next: path, rows: [], seen: new Set() };
    while (state.next) {
      if (state.seen.has(state.next) || state.seen.size >= 10000)
        throw new Error('Paginación ARM inválida.');
      state.seen.add(state.next);
      const result = await request(state.next, { signal });
      if (!Array.isArray(result.value)) throw new Error('Respuesta de listado ARM inválida.');
      state.rows.push(...result.value);
      state.next = result.nextLink;
    }
    return state.rows;
  }
  return { request, list };
}
