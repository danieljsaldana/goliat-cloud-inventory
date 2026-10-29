import { UUID } from '../config.mjs';

async function readJson(request, limit) {
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks = [];
  const size = { bytes: 0 };
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size.bytes += result.value.byteLength;
      if (size.bytes > limit)
        throw Object.assign(new Error('Cuerpo demasiado grande.'), { status: 413 });
      chunks.push(Buffer.from(result.value));
    }
    if (!size.bytes) return {};
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw Object.assign(new Error('JSON inválido.'), { status: 400 });
    }
  } finally {
    await reader.cancel();
  }
}

export function httpHandlers(service, auth, maxBytes) {
  const wrap = (handler) => async (request, context) => {
    try {
      return await handler(request);
    } catch (error) {
      const status =
        error.status ||
        error.statusCode ||
        (error.code?.startsWith('ERR_JW') || error.code === 'ERR_JOSE_ALG_NOT_ALLOWED' ? 401 : 500);
      if (status >= 500) context.error('inventory.http.failed', { status });
      return {
        status,
        headers: {
          'cache-control': 'no-store',
          ...(status === 401 ? { 'www-authenticate': 'Bearer' } : {}),
        },
        jsonBody: {
          error:
            status < 500
              ? error.message
              : 'La operación no está disponible. Revisa la configuración y los logs.',
        },
      };
    }
  };
  return {
    generate: wrap(async (request) => {
      const identity = await auth(request, 'Generate');
      const body = await readJson(request, 1024);
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length)
        throw Object.assign(
          new Error('La generación solo acepta un objeto vacío; el ámbito lo fija el servidor.'),
          { status: 400 },
        );
      const operationId = await service.requestGeneration(identity.objectId);
      const path = `/api/inventory/operations/${operationId}`;
      return {
        status: 202,
        headers: { location: path, 'cache-control': 'no-store' },
        jsonBody: { operationId, status: 'queued', statusPath: path },
      };
    }),
    status: wrap(async (request) => {
      await auth(request, 'Generate');
      const id = request.params.operationId;
      const operation = await (async () => {
        if (id === 'current') return service.getCurrentOperation();
        if (UUID.test(id || '')) return service.getOperation(id);
        return null;
      })();
      if (id === 'current' && !operation)
        return {
          status: 200,
          headers: { 'cache-control': 'no-store' },
          jsonBody: { status: 'idle' },
        };
      if (!operation) throw Object.assign(new Error('Operación no encontrada.'), { status: 404 });
      const publicState = Object.fromEntries(
        Object.entries(operation).filter(([key]) => key !== 'requestedBy'),
      );
      return { status: 200, headers: { 'cache-control': 'no-store' }, jsonBody: publicState };
    }),
    publish: wrap(async (request) => {
      await auth(request, 'Publish');
      if (
        request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !==
        'application/json'
      )
        throw Object.assign(new Error('Se requiere Content-Type: application/json.'), {
          status: 415,
        });
      const document = await readJson(request, Math.min(maxBytes, 8 * 1024 * 1024));
      const result = await service.publishDocument(document, {
        ifMatch: request.headers.get('if-match'),
        ifNoneMatch: request.headers.get('if-none-match'),
      });
      return {
        status: 200,
        headers: { etag: result.etag, 'cache-control': 'no-store' },
        jsonBody: result,
      };
    }),
  };
}
