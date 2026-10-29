import { RequestError } from './RequestError.js';

export async function requestJson(url, { signal, fetcher = fetch, method = 'GET' } = {}) {
  const response = await fetcher(url, {
    signal,
    method,
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    const error = { code: undefined };
    try {
      const body = await response.json();
      if (typeof body.error === 'string' && /^[a-z_]{1,80}$/.test(body.error))
        error.code = body.error;
    } catch {
      // Las respuestas no JSON conservan el estado HTTP sin exponer su contenido.
    }
    signal?.throwIfAborted();
    throw new RequestError(response.status, error.code);
  }
  const data = await response.json();
  signal?.throwIfAborted();
  return data;
}
