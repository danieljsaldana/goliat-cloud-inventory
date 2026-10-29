import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationAdministrator } from '../server/access/applicationAdministrator.mjs';
import { memberDirectory } from '../server/members/directory.mjs';
import { membersService } from '../server/members/service.mjs';
import { handleMembers } from '../server/members/handleMembers.mjs';
import { membersSettings } from '../server/members/settings.mjs';
import { getPageMetadata } from '../src/core/sharing/metadata.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const initialId = '22222222-2222-4222-8222-222222222222';
const memberId = '33333333-3333-4333-8333-333333333333';
const env = {
  DASHBOARD_AUTH_ENABLED: 'true',
  DASHBOARD_AUTH_MODE: 'azure-ad',
  AUTH_SECRET: 'goliat-test-secret-at-least-32-bytes',
  AUTH_URL: 'https://web.example',
  AUTH_MICROSOFT_ENTRA_ID_ID: initialId,
  AUTH_MICROSOFT_ENTRA_ID_SECRET: 'test-only',
  AUTH_MICROSOFT_ENTRA_ID_ISSUER: `https://login.microsoftonline.com/${tenantId}/v2.0`,
  DASHBOARD_ADMIN_OBJECT_IDS: initialId,
  DASHBOARD_MEMBERS_ENABLED: 'true',
  LOG_ENABLED: 'false',
};
const settings = membersSettings(env);
const session = {
  user: { name: 'Admin' },
  authMode: 'azure-ad',
  identity: { tenantId, objectId: initialId },
};
const memberSession = { ...session, identity: { tenantId, objectId: memberId } };
const credential = {
  getToken: async (scope) => {
    assert.equal(scope, 'https://graph.microsoft.com/.default');
    return { token: 'test-token' };
  },
};
const graphUser = (id = memberId, extra = {}) => ({
  id,
  displayName: 'Member',
  mail: 'member@example.test',
  userPrincipalName: 'member@example.test',
  userType: 'Member',
  accountEnabled: true,
  ...extra,
});
const users = [initialId, memberId].map((objectId) => ({
  objectId,
  name: 'Test',
  email: '',
  principalName: '',
  type: 'member',
  enabled: true,
}));
const directory = {
  list: async () => users,
  user: async (objectId) => users.find((user) => user.objectId === objectId),
};

test('los administradores persistidos se consultan por tenant y oid; una sesión anterior pierde permiso tras la revocación', async () => {
  const state = { authorized: true, calls: 0 };
  const pool = {
    query: async (_sql, values) => {
      state.calls++;
      assert.deepEqual(values, [tenantId, memberId]);
      return { rows: state.authorized ? [{}] : [] };
    },
  };
  assert.equal(await applicationAdministrator(session, settings, env, pool), true);
  assert.equal(state.calls, 0, 'El administrador inicial no depende de PostgreSQL.');
  assert.equal(await applicationAdministrator(memberSession, settings, env, pool), true);
  state.authorized = false;
  assert.equal(
    await applicationAdministrator({ ...memberSession, administrator: true }, settings, env, pool),
    false,
  );
  const calls = state.calls;
  for (const input of [
    null,
    { ...memberSession, authMode: 'demo' },
    { ...memberSession, identity: { tenantId: memberId, objectId: memberId } },
    { ...memberSession, identity: undefined, administrator: true },
  ])
    assert.equal(await applicationAdministrator(input, settings, env, pool), false);
  assert.equal(state.calls, calls, 'Identidades inválidas no consultan ni conceden permisos.');
  assert.equal(
    await applicationAdministrator(memberSession, settings, env, {
      query: async () => {
        throw new Error('private-password');
      },
    }),
    false,
  );
});

test('Miembros requiere configuración explícita y modo Entra; demo y login desactivado no conceden acceso', () => {
  for (const values of [
    { ...env, DASHBOARD_MEMBERS_ENABLED: 'false' },
    { ...env, DASHBOARD_AUTH_ENABLED: 'false' },
    {
      ...env,
      DASHBOARD_AUTH_MODE: 'demo',
      DASHBOARD_USERNAME: 'demo',
      DASHBOARD_PASSWORD: 'test-only',
    },
  ])
    assert.throws(() => membersSettings(values), /members_unconfigured/);
});

test('el directorio sigue todas las páginas, elimina duplicados y conserva las cuentas deshabilitadas sin exponer propiedades extra', async () => {
  const calls = [];
  const client = memberDirectory({
    credential,
    request: async (url, options) => {
      calls.push(url.href);
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      assert.equal(options.redirect, 'error');
      if (url.searchParams.has('$skiptoken'))
        return Response.json({
          value: [
            graphUser(),
            graphUser(initialId, {
              displayName: 'Admin',
              accountEnabled: false,
              userType: 'Guest',
              password: 'private',
            }),
          ],
        });
      return Response.json({
        value: [graphUser()],
        '@odata.nextLink': 'https://graph.microsoft.com/v1.0/users?$skiptoken=next',
      });
    },
  });
  const result = await client.list();
  assert.equal(calls.length, 2);
  assert.equal(result.length, 2);
  assert.equal(result[0].enabled, false);
  assert.equal(result[0].type, 'guest');
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.deepEqual(
    Object.keys(result[0]).sort(),
    ['objectId', 'name', 'email', 'principalName', 'type', 'enabled'].sort(),
  );
});

test('Graph no reenvía tokens a enlaces externos, redirecciones ni paginación cíclica', async () => {
  for (const next of [
    'https://evil.example/v1.0/users',
    'http://graph.microsoft.com/v1.0/users',
    'https://graph.microsoft.com/v1.0/applications',
    '/v1.0/users?$select=id',
  ]) {
    const state = { calls: 0 };
    const client = memberDirectory({
      credential,
      request: async () => {
        state.calls++;
        return Response.json({ value: [], '@odata.nextLink': next });
      },
    });
    await assert.rejects(client.list(), /directory_unavailable/);
    assert.ok(state.calls <= 2);
  }
});

test('un directorio sin permiso o con cuentas incompletas falla sin devolver datos parciales', async () => {
  const forbidden = memberDirectory({
    credential,
    request: async () => Response.json({ secret: 'private' }, { status: 403 }),
  });
  await assert.rejects(forbidden.list(), /directory_forbidden/);
  const incomplete = memberDirectory({
    credential,
    request: async () => Response.json({ value: [{ id: memberId }] }),
  });
  await assert.rejects(incomplete.list(), /directory_unavailable/);
});

test('la vista combina roles persistidos y administradores iniciales y no confunde nombres con permisos', async () => {
  const client = membersService({
    env,
    directory,
    repository: { administrators: async () => [memberId] },
  });
  const data = await client.read(session);
  assert.equal(data.accessMode, 'tenant');
  assert.equal(data.members[0].protectedAdministrator, true);
  assert.equal(data.members[1].protectedAdministrator, false);
  assert.equal(data.members[1].role, 'administrator');
  assert.equal(data.currentObjectId, initialId);
});

test('los cambios validan JSON, rol y cuenta real del directorio; rechazan concesiones a cuentas deshabilitadas', async () => {
  const writes = [];
  const client = membersService({
    env,
    directory,
    repository: {
      update: async (input) => {
        writes.push(input);
        return { role: input.role };
      },
    },
  });
  for (const input of [
    null,
    [],
    { objectId: [memberId], role: 'administrator', expectedRole: 'member' },
    { objectId: 'invalid' },
    { objectId: memberId, role: 'owner', expectedRole: 'member' },
    { objectId: memberId, role: 'administrator', expectedRole: 'member', tenantId },
  ])
    await assert.rejects(client.update(session, input), /invalid_member/);
  assert.equal(writes.length, 0);
  const input = { objectId: memberId, role: 'administrator', expectedRole: 'member' };
  await client.update(session, input);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].settings.tenantId, tenantId);
  const disabled = membersService({
    env,
    directory: {
      user: async (objectId) => ({
        ...users.find((user) => user.objectId === objectId),
        enabled: objectId !== memberId,
      }),
    },
    repository: { update: async () => assert.fail('No debe escribir permisos.') },
  });
  await assert.rejects(disabled.update(session, input), /member_disabled/);
  const disabledActor = membersService({
    env,
    directory: {
      user: async (objectId) => ({
        ...users.find((user) => user.objectId === objectId),
        enabled: objectId !== initialId,
      }),
    },
    repository: {},
  });
  await assert.rejects(disabledActor.update(session, input), /administrator_required/);
});

test('el POST exige origen propio y JSON limitado; los errores privados no se envían al cliente', async () => {
  const calls = [];
  const client = {
    update: async (_session, input) => {
      calls.push(input);
      return { changed: true };
    },
    read: async () => ({ members: [] }),
  };
  const post = (body, headers = {}) =>
    new Request('https://web.example/api/admin/members/', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://web.example', ...headers },
      body,
    });
  const success = await handleMembers(post(JSON.stringify({ objectId: memberId })), {
    env,
    client,
  });
  assert.equal(success.status, 200);
  assert.equal(success.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(
    (await handleMembers(post('{}', { origin: 'https://evil.example' }), { env, client })).status,
    403,
  );
  assert.equal(
    (await handleMembers(post('{}', { 'sec-fetch-site': 'cross-site' }), { env, client })).status,
    403,
  );
  assert.equal((await handleMembers(post('invalid'), { env, client })).status, 400);
  assert.equal((await handleMembers(post(' '.repeat(2049)), { env, client })).status, 400);
  assert.equal(
    (await handleMembers(post('{}', { 'content-type': 'text/plain' }), { env, client })).status,
    400,
  );
  assert.equal(calls.length, 1);
  const failure = await handleMembers(post('{}'), {
    env,
    client: {
      update: async () => {
        throw Object.assign(new Error('private-token'), { status: 403 });
      },
    },
  });
  assert.equal((await failure.json()).error, 'members_unavailable');
});

test('los metadatos de Miembros son genéricos y no contienen cuentas ni permisos del directorio', () => {
  for (const locale of ['es', 'en']) {
    const page = getPageMetadata(['members'], locale, 'https://web.example/');
    assert.match(page.title, /Miembros|Members/);
    assert.equal(JSON.stringify(page).includes(initialId), false);
    assert.equal(JSON.stringify(page).includes('member@example.test'), false);
  }
});
