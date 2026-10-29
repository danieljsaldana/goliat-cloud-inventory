import test from 'node:test';
import assert from 'node:assert/strict';
import { createLogging } from '../server/logging/logger.mjs';
import { loggingConfig } from '../server/logging/config.mjs';
import { loggedRoute } from '../server/logging/request.mjs';
import { loggedOperation } from '../server/logging/operation.mjs';
import { withLogContext } from '../server/logging/context.mjs';
import { requestId } from '../server/logging/utils/requestId.mjs';

function capture(env = {}) {
  const entries = [];
  const logging = createLogging({
    env,
    stream: { write: (line) => entries.push(JSON.parse(line)) },
  });
  return { logging, entries };
}

test('solo admite info, warn y error, valida las opciones y filtra antes de serializar', () => {
  assert.deepEqual(loggingConfig({}), { enabled: true, level: 'info', httpEnabled: true });
  for (const value of ['debug', 'trace', 'fatal', 'silent', 'invalid'])
    assert.throws(() => loggingConfig({ LOG_LEVEL: value }), /info, warn o error/);
  for (const name of ['LOG_ENABLED', 'LOG_HTTP_ENABLED'])
    assert.throws(() => loggingConfig({ [name]: 'yes' }), /true o false/);
  const { logging, entries } = capture({ LOG_LEVEL: 'warn' });
  const sensitive = {
    toJSON: () => {
      throw new Error('No se debe serializar el nivel omitido');
    },
  };
  logging.logger.info({ data: sensitive }, 'Mensaje informativo.');
  logging.logger.warn('Advertencia.');
  logging.logger.error('Error.');
  assert.deepEqual(
    entries.map(({ level, nivel }) => [level, nivel]),
    [
      [40, 'advertencia'],
      [50, 'error'],
    ],
  );
  const disabled = capture({ LOG_ENABLED: 'false' });
  disabled.logging.logger.error({ data: sensitive }, 'Mensaje desactivado.');
  assert.deepEqual(disabled.entries, []);
});

test('oculta credenciales y omite mensajes, causas y stack de errores externos', () => {
  const { logging, entries } = capture();
  const err = new Error('password=secreto');
  err.code = 'ECONNREFUSED';
  err.cause = { token: 'secreto' };
  logging.logger.error(
    {
      err,
      password: 'secreto',
      authorization: 'secreto',
      headers: { cookie: 'secreto' },
      body: 'secreto',
      env: { DB_PASSWORD: 'secreto' },
      provider: { clientSecret: 'secreto' },
    },
    'No se puede conectar con el proveedor.',
  );
  assert.equal(JSON.stringify(entries).includes('secreto'), false);
  assert.deepEqual(entries[0].err, { type: 'Error', code: 'ECONNREFUSED' });
  assert.equal(entries[0].mensaje, 'No se puede conectar con el proveedor.');
});

test('las peticiones concurrentes mantienen su identificador sin mezclar contextos ni registrar parámetros', async () => {
  const { logging, entries } = capture();
  const handler = loggedRoute(
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      logging.logger.info({ event: 'service.checked' }, 'Consulta completada.');
      return Response.json({ ok: true });
    },
    { route: '/api/inventory/azure/', logging },
  );
  const responses = await Promise.all(
    ['request-a', 'request-b'].map((id) =>
      handler(
        new Request('http://localhost/api/inventory/azure/?token=secreto', {
          headers: { 'x-request-id': id, authorization: 'secreto' },
        }),
      ),
    ),
  );
  assert.deepEqual(
    responses.map((response) => response.headers.get('x-request-id')),
    ['request-a', 'request-b'],
  );
  for (const id of ['request-a', 'request-b']) {
    const group = entries.filter(({ requestId: value }) => value === id);
    assert.equal(group.length, 2);
    assert.equal(group.at(-1).route, '/api/inventory/azure/');
    assert.ok(group.at(-1).durationMs >= 0);
  }
  assert.equal(JSON.stringify(entries).includes('secreto'), false);
  logging.logger.info('Fuera de una petición.');
  assert.equal(entries.at(-1).requestId, undefined);
});

test('el resumen HTTP clasifica estados, omite salud correcta y permite apagar solo HTTP', async () => {
  const { logging, entries } = capture();
  const request = new Request('http://localhost/api/ready/');
  for (const status of [200, 400, 503]) {
    const response = await loggedRoute(() => new Response(null, { status }), {
      logging,
      route: '/api/ready/',
      health: true,
    })(request);
    assert.equal(response.status, status);
  }
  assert.deepEqual(
    entries.map(({ level, statusCode }) => [level, statusCode]),
    [
      [40, 400],
      [50, 503],
    ],
  );
  const disabled = capture({ LOG_HTTP_ENABLED: 'false' });
  await loggedRoute(() => new Response(null, { status: 503 }), {
    logging: disabled.logging,
    route: '/api/ready/',
  })(request);
  assert.deepEqual(disabled.entries, []);
  disabled.logging.logger.error('Error interno.');
  assert.equal(disabled.entries.length, 1);
});

test('el wrapper conserva redirecciones, genera identificadores seguros y desactivar logs evita instrumentar', async () => {
  const { logging } = capture();
  const response = await loggedRoute(() => Response.redirect('http://localhost/login/', 303), {
    logging,
    route: '/login/',
  })(new Request('http://localhost/'));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), 'http://localhost/login/');
  assert.match(response.headers.get('x-request-id'), /^[\w-]+$/);
  for (const value of ['a\nb', 'x'.repeat(65), 'token?secret'])
    assert.notEqual(requestId(value), value);
  const disabled = capture({ LOG_ENABLED: 'false' });
  const original = new Response('sin cambios');
  assert.equal(
    await loggedRoute(() => original, { logging: disabled.logging })(
      new Request('http://localhost/'),
    ),
    original,
  );
  assert.deepEqual(disabled.entries, []);
});

test('los errores se propagan y conservan la correlación de operaciones y peticiones', async () => {
  const { logging, entries } = capture();
  const error = new Error('consulta con datos privados');
  await assert.rejects(
    loggedRoute(
      () => {
        throw error;
      },
      { logging, route: '/api/inventory/azure/' },
    )(new Request('http://localhost/', { headers: { 'x-request-id': 'failed-request' } })),
    (value) => value === error,
  );
  assert.equal(entries[0].requestId, 'failed-request');
  assert.equal(entries[0].level, 50);
  await withLogContext({ operationId: 'job-1' }, async () => {
    assert.equal(
      await loggedOperation({ operation: 'seed', label: 'semilla', logging }, async () => 42),
      42,
    );
    await assert.rejects(
      loggedOperation({ operation: 'ingest', label: 'ingesta', logging }, async () => {
        throw error;
      }),
      (value) => value === error,
    );
  });
  assert.deepEqual(
    entries.slice(1).map(({ operationId }) => operationId),
    ['job-1', 'job-1'],
  );
  assert.equal(JSON.stringify(entries).includes('datos privados'), false);
});
