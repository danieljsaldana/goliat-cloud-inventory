import test from 'node:test';
import assert from 'node:assert/strict';
import { administratorAllowed } from '../server/access/utils/administratorAllowed.mjs';
import { authConfiguration } from '../server/auth-config.mjs';
import { readSchedule, validateSchedule } from '../server/administration/schedule.mjs';
import { functionAdministration } from '../server/administration/functionAdministration.mjs';
import { handleAdministration } from '../server/administration/handleAdministration.mjs';

const tenant = '11111111-1111-4111-8111-111111111111';
const objectId = '22222222-2222-4222-8222-222222222222';
const env = {
  DASHBOARD_AUTH_ENABLED: 'true',
  DASHBOARD_AUTH_MODE: 'azure-ad',
  AUTH_SECRET: 'a-test-secret-with-at-least-32-bytes',
  AUTH_URL: 'https://web.example',
  AUTH_MICROSOFT_ENTRA_ID_ID: objectId,
  AUTH_MICROSOFT_ENTRA_ID_SECRET: 'test-secret',
  AUTH_MICROSOFT_ENTRA_ID_ISSUER: `https://login.microsoftonline.com/${tenant}/v2.0`,
  DASHBOARD_ADMIN_OBJECT_IDS: objectId,
  AZURE_FUNCTION_RESOURCE_ID: `/subscriptions/${tenant}/resourceGroups/rg-test/providers/Microsoft.Web/sites/func-test`,
};
const settings = { enabled: true, mode: 'azure-ad', tenantId: tenant };
const session = {
  user: { name: 'Daniel' },
  authMode: 'azure-ad',
  identity: { objectId, tenantId: tenant },
};
const properties = {
  INVENTORY_SCHEDULE: '0 0 2 * * *',
  'AzureWebJobs.inventoryTimer.Disabled': 'false',
  SECRET_SETTING: 'never-return-this-secret',
  KEEP_SETTING: 'untouched',
};
const credential = { getToken: async () => ({ token: 'test-arm-token' }) };
const lock = async (_key, work, { signal }) => work({ signal });
const operations = { current: async () => null };

test('el administrador requiere oid autorizado y tid; nombre, email y banderas cliente no conceden acceso', () => {
  assert.equal(administratorAllowed(session, settings, env), true);
  for (const input of [
    null,
    { ...session, authMode: 'demo' },
    { ...session, identity: undefined, administrator: true },
    { ...session, identity: { objectId, tenantId: objectId } },
    { ...session, identity: { objectId: tenant, tenantId: tenant } },
    { ...session, identity: { objectId, tenantId: 1 } },
  ])
    assert.equal(administratorAllowed(input, settings, env), false);
  assert.equal(administratorAllowed(session, { ...settings, enabled: false }, env), false);
  for (const list of ['', 'Daniel', `${objectId},invalid`])
    assert.equal(
      administratorAllowed(session, settings, { ...env, DASHBOARD_ADMIN_OBJECT_IDS: list }),
      false,
    );
  assert.equal(
    administratorAllowed(session, settings, {
      ...env,
      DASHBOARD_ADMIN_OBJECT_IDS: objectId.toUpperCase(),
    }),
    true,
  );
});

test('la sesión captura identidad solo al login Entra y la revocación se aplica al volver a consultar', async () => {
  const config = authConfiguration(env);
  const token = config.callbacks.jwt({
    token: {},
    account: { provider: 'microsoft-entra-id' },
    profile: { oid: objectId, tid: tenant },
  });
  const authenticated = await config.callbacks.session({ session: { user: {} }, token });
  assert.equal(authenticated.administrator, true);
  assert.deepEqual(authenticated.identity, { objectId, tenantId: tenant });
  const updated = config.callbacks.jwt({
    token,
    trigger: 'update',
    session: { identity: { objectId: tenant }, administrator: true },
  });
  assert.equal(updated.identity.objectId, objectId);
  env.DASHBOARD_ADMIN_OBJECT_IDS = '';
  assert.equal(
    (await config.callbacks.session({ session: { user: {} }, token })).administrator,
    false,
  );
  env.DASHBOARD_ADMIN_OBJECT_IDS = objectId;
  assert.equal(
    config.callbacks.jwt({ token: { ...token }, account: { provider: 'demo' } }).identity,
    undefined,
  );
});

test('la programación valida horarios UTC y no acepta cron arbitrario ni intervalos excesivos', () => {
  const schedule = readSchedule(properties);
  assert.equal(schedule.time, '02:00');
  assert.deepEqual(validateSchedule({ ...schedule, mode: 'daily', time: '23:59' }), {
    cron: '0 59 23 * * *',
    enabled: true,
  });
  assert.deepEqual(validateSchedule({ ...schedule, mode: 'hourly', hours: 6, enabled: false }), {
    cron: '0 0 */6 * * *',
    enabled: false,
  });
  for (const input of [
    null,
    { ...schedule, time: '24:00' },
    { ...schedule, time: '02:60' },
    { ...schedule, mode: 'hourly', hours: 0 },
    { ...schedule, mode: 'hourly', hours: 5 },
    { ...schedule, enabled: 'true' },
    { ...schedule, version: '' },
    { ...schedule, mode: 'cron', cron: '* * * * * *' },
  ])
    assert.throws(() => validateSchedule(input), /invalid_schedule/);
});

test('Azure Monitor respeta 24h, mantiene datos ausentes y la respuesta no expone app settings ni errores de operaciones', async () => {
  const calls = [];
  const client = functionAdministration({
    env,
    credential,
    operations: {
      current: async () => ({
        status: 'succeeded',
        operationId: tenant,
        error: properties.SECRET_SETTING,
      }),
    },
    now: () => new Date('2026-10-10T12:00:00Z'),
    publication: async () => ({ generatedAt: '2026-10-10T11:30:00Z', resources: 45 }),
    database: async () => {
      throw new Error(properties.SECRET_SETTING);
    },
    request: async (url, options) => {
      calls.push({ url, options });
      if (url.pathname.endsWith('/appsettings/list')) return Response.json({ properties });
      if (url.pathname.endsWith('/metrics')) {
        assert.equal(
          url.searchParams.get('timespan'),
          '2026-10-09T12:00:00.000Z/2026-10-10T12:00:00.000Z',
        );
        if (url.searchParams.get('metricnames') === 'CpuPercentage')
          return Response.json({}, { status: 403 });
        return Response.json({
          value: [
            {
              timeseries: [
                {
                  data: [
                    { timeStamp: '2026-10-10T10:00:00Z', total: 5, average: null },
                    { timeStamp: '2026-10-10T11:00:00Z', total: 0 },
                  ],
                },
              ],
            },
          ],
        });
      }
      return Response.json({
        name: 'func-test',
        location: 'westeurope',
        properties: { state: 'Running', defaultHostName: 'func-test.azurewebsites.net' },
      });
    },
  });
  const data = await client.read();
  assert.equal(data.metrics[0].value, 5);
  assert.equal(data.metrics[1].value, null);
  assert.equal(data.metrics[2].available, false);
  assert.equal(data.database, null);
  assert.equal(data.publication.resources, 45);
  assert.equal(JSON.stringify(data).includes(properties.SECRET_SETTING), false);
  assert.equal(
    calls.every(
      ({ url, options }) =>
        url.origin === 'https://management.azure.com' &&
        options.headers.Authorization === 'Bearer test-arm-token',
    ),
    true,
  );
  assert.throws(() =>
    functionAdministration({
      env: { ...env, AZURE_FUNCTION_RESOURCE_ID: 'https://evil.example' },
      credential,
    }),
  );
});

test('guardar conserva todos los otros ajustes, se verifica en Azure y rechaza formularios obsoletos', async () => {
  const state = { properties: { ...properties }, writes: 0 };
  const client = functionAdministration({
    env,
    credential,
    lock,
    operations,
    request: async (_url, options) => {
      if (options.method === 'PUT') {
        state.properties = JSON.parse(options.body).properties;
        state.writes++;
      }
      return Response.json({ properties: state.properties });
    },
  });
  const original = readSchedule(properties);
  const result = await client.updateSchedule({ ...original, time: '05:30', enabled: false });
  assert.equal(result.cron, '0 30 5 * * *');
  assert.equal(state.properties.SECRET_SETTING, properties.SECRET_SETTING);
  assert.equal(state.properties.KEEP_SETTING, properties.KEEP_SETTING);
  assert.equal(state.properties['AzureWebJobs.inventoryTimer.Disabled'], 'true');
  await assert.rejects(
    client.updateSchedule({ ...original, time: '06:30' }),
    (error) => error.status === 409,
  );
  assert.equal(state.writes, 1);
});

test('la API exige mismo origen, limita payloads y no revela detalles de Azure', async () => {
  const request = (body, headers = {}) =>
    new Request('https://web.example/api/admin/function/', {
      method: 'POST',
      headers: { Origin: 'https://web.example', 'Content-Type': 'application/json', ...headers },
      body,
    });
  const client = {
    updateSchedule: async (input) => validateSchedule(input),
    read: async () => {
      throw new TypeError('fetch failed');
    },
  };
  assert.equal(
    (await handleAdministration(request('{}', { Origin: 'https://evil.example' }), { env, client }))
      .status,
    403,
  );
  assert.equal(
    (await handleAdministration(request('x'.repeat(2050)), { env, client })).status,
    400,
  );
  assert.equal((await handleAdministration(request('{invalid'), { env, client })).status, 400);
  assert.equal(
    (await handleAdministration(request(JSON.stringify(readSchedule(properties))), { env, client }))
      .status,
    200,
  );
  const unavailable = await handleAdministration(
    new Request('https://web.example/api/admin/function/'),
    { env, client },
  );
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { error: 'administration_unavailable' });
});

test('no cambia app settings mientras hay una generación HTTP registrada en curso', async () => {
  const client = functionAdministration({
    env,
    credential,
    lock,
    operations: { current: async () => ({ status: 'running' }) },
    request: async () => {
      assert.fail('No debe acceder a la configuración durante una generación.');
    },
  });
  await assert.rejects(
    client.updateSchedule(readSchedule(properties)),
    (error) => error.status === 409 && error.message === 'generation_running',
  );
});
