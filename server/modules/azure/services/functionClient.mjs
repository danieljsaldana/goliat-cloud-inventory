import { ConfigurationError, required } from '../../../config.mjs';
import { azureCredential } from '../storage/credential.mjs';
import { functionRequest } from './functionRequest.mjs';

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const states = new Set(['queued', 'running', 'retrying', 'succeeded', 'failed']);
const credentials = new Map();

function dependencyError(message, code, error, timings) {
  const safe = (value) =>
    typeof value === 'string' && /^[\w.-]{1,80}$/.test(value) ? value : undefined;
  return Object.assign(new Error(message), {
    code,
    cause: error,
    dependency: {
      ...timings,
      transport: error?.transport,
      type: safe(error?.name),
      code: safe(error?.cause?.code || error?.code),
    },
  });
}

export function functionClient({ env = process.env, request = functionRequest, credential } = {}) {
  const base = new URL(required('AZURE_FUNCTION_BASE_URL', env));
  const scope = required('AZURE_FUNCTION_SCOPE', env);
  if (
    base.protocol !== 'https:' ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== '/' ||
    !/^api:\/\/[0-9a-f-]{36}\/\.default$/i.test(scope) ||
    !UUID.test(scope.slice(6, -9))
  )
    throw new ConfigurationError('Configura el origen HTTPS y el scope de la API de la Function.');
  if (!credential) {
    const key = JSON.stringify([
      env.AZURE_AUTH_MODE,
      env.AZURE_TENANT_ID,
      env.AZURE_CLIENT_ID,
      env.AZURE_CLIENT_SECRET,
    ]);
    if (!credentials.has(key)) credentials.set(key, azureCredential(env));
    credential = credentials.get(key);
  }
  async function call(path, signal, method = 'GET') {
    const started = Date.now();
    const bounded = AbortSignal.timeout(30000);
    const abortSignal = signal ? AbortSignal.any([signal, bounded]) : bounded;
    const token = await (async () => {
      try {
        return await credential.getToken(scope, { abortSignal });
      } catch (error) {
        throw dependencyError(
          'No se pudo obtener el token de la Function.',
          'FUNCTION_TOKEN_FAILED',
          error,
          { tokenMs: Date.now() - started },
        );
      }
    })();
    if (!token?.token)
      throw new Error('La identidad de la web no ha obtenido acceso a la Function.');
    const tokenMs = Date.now() - started;
    const requestStarted = Date.now();
    const response = await (async () => {
      try {
        return await request(new URL(path, base), {
          method,
          signal: abortSignal,
          redirect: 'error',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token.token}`,
            ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(method === 'POST' ? { body: '{}' } : {}),
        });
      } catch (error) {
        throw dependencyError(
          'No se pudo conectar con la Function.',
          'FUNCTION_REQUEST_FAILED',
          error,
          { tokenMs, requestMs: Date.now() - requestStarted },
        );
      }
    })();
    if (!response.ok)
      throw Object.assign(new Error('La Function ha rechazado la operación.'), {
        code: `FUNCTION_HTTP_${response.status}`,
      });
    const operation = await response.json();
    if (operation?.status === 'idle' && method === 'GET') return null;
    if (!UUID.test(operation?.operationId || '') || !states.has(operation.status))
      throw new Error('La Function ha devuelto un estado inválido.');
    return operation;
  }
  return {
    generate: (signal) => call('api/inventory/generate', signal, 'POST'),
    current: (signal) => call('api/inventory/operations/current', signal),
    operation: (id, signal) => {
      if (!UUID.test(id || '')) throw new Error('Identificador de operación inválido.');
      return (async () => {
        const operation = await call(`api/inventory/operations/${id}`, signal);
        if (operation?.operationId !== id)
          throw new Error('La Function ha devuelto otra operación.');
        return operation;
      })();
    },
  };
}
