import test from 'node:test';
import assert from 'node:assert/strict';
import { memberDirectory } from '../server/members/directory.mjs';
import { handleMemberPhoto } from '../server/members/handleMemberPhoto.mjs';

const tenantId = '11111111-1111-4111-8111-111111111111';
const objectId = '22222222-2222-4222-8222-222222222222';
const env = {
  DASHBOARD_AUTH_ENABLED: 'true',
  DASHBOARD_AUTH_MODE: 'azure-ad',
  AUTH_SECRET: 'goliat-test-secret-at-least-32-bytes',
  AUTH_URL: 'https://web.example',
  AUTH_MICROSOFT_ENTRA_ID_ID: objectId,
  AUTH_MICROSOFT_ENTRA_ID_SECRET: 'test-only',
  AUTH_MICROSOFT_ENTRA_ID_ISSUER: `https://login.microsoftonline.com/${tenantId}/v2.0`,
  DASHBOARD_MEMBERS_ENABLED: 'true',
};
const credential = { getToken: async () => ({ token: 'private-graph-token' }) };
const image = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const request = new Request(`https://web.example/api/admin/members/${objectId}/photo/`);

test('la foto se consulta por ID en Graph con token de servidor y se devuelve como imagen privada', async () => {
  const directory = memberDirectory({
    credential,
    request: async (url, options) => {
      assert.equal(
        url.href,
        `https://graph.microsoft.com/v1.0/users/${objectId}/photos/48x48/$value`,
      );
      assert.equal(options.headers.Authorization, 'Bearer private-graph-token');
      assert.equal(options.redirect, 'error');
      assert.equal(options.cache, 'no-store');
      assert.ok(options.signal instanceof AbortSignal);
      return new Response(image, { headers: { 'Content-Type': 'image/jpeg' } });
    },
  });
  const response = await handleMemberPhoto(request, objectId, { env, directory });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('Cross-Origin-Resource-Policy'), 'same-origin');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), image);
  assert.equal(JSON.stringify([...response.headers]).includes('private-graph-token'), false);
});

test('un usuario sin foto devuelve 404 sin cuerpo para que la interfaz conserve el icono', async () => {
  const directory = memberDirectory({
    credential,
    request: async () => Response.json({ error: 'no-photo' }, { status: 404 }),
  });
  const response = await handleMemberPhoto(request, objectId, { env, directory });
  assert.equal(response.status, 404);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
});

test('IDs inválidos y Miembros deshabilitado no llegan a consultar fotos del directorio', async () => {
  const directory = { photo: async () => assert.fail('No debe consultar Graph.') };
  for (const invalid of ['https://evil.example', '../me', `${objectId}?$select=id`, undefined]) {
    assert.equal((await handleMemberPhoto(request, invalid, { env, directory })).status, 400);
    await assert.rejects(memberDirectory({ credential }).photo(invalid), /invalid_member/);
  }
  assert.equal(
    (
      await handleMemberPhoto(request, objectId, {
        env: { ...env, DASHBOARD_MEMBERS_ENABLED: 'false' },
        directory,
      })
    ).status,
    503,
  );
});

test('errores de Graph y cancelaciones conservan el fallback sin revelar datos ni tokens', async () => {
  for (const status of [401, 403, 429, 500]) {
    const directory = memberDirectory({
      credential,
      request: async () => Response.json({ token: 'private' }, { status }),
    });
    const response = await handleMemberPhoto(request, objectId, { env, directory });
    assert.equal(response.status, 503);
    assert.equal(await response.text(), '');
  }
  const controller = new AbortController();
  controller.abort();
  const directory = memberDirectory({
    credential,
    request: async (_url, options) => options.signal.throwIfAborted(),
  });
  const aborted = new Request(request.url, { signal: controller.signal });
  assert.equal((await handleMemberPhoto(aborted, objectId, { env, directory })).status, 503);
});

test('no se sirven SVG, HTML, fotos vacías ni imágenes de más de 256 KiB', async () => {
  for (const response of [
    new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }),
    new Response('<html/>', { headers: { 'Content-Type': 'text/html' } }),
    new Response(null, { headers: { 'Content-Type': 'image/jpeg' } }),
    new Response(new Uint8Array(256 * 1024 + 1), { headers: { 'Content-Type': 'image/png' } }),
    new Response(image, {
      headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(256 * 1024 + 1) },
    }),
  ]) {
    const directory = memberDirectory({ credential, request: async () => response });
    const result = await handleMemberPhoto(request, objectId, { env, directory });
    assert.equal(result.status, 503);
    assert.equal(await result.text(), '');
  }
});
