import test from 'node:test';
import assert from 'node:assert/strict';
import { azureAdProvider } from '../server/auth/providers/azureAd.mjs';
import { readAzureUserPhoto } from '../server/auth/utils/readAzureUserPhoto.mjs';
import { AZURE_USER_PHOTO_URL } from '../server/auth/constants.mjs';

test('consulta la miniatura de Graph con el token del servidor y un tiempo de espera limitado', async () => {
  const image = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const result = await readAzureUserPhoto('test-access-token', async (url, options) => {
    assert.equal(url, AZURE_USER_PHOTO_URL);
    assert.equal(options.headers.Authorization, 'Bearer test-access-token');
    assert(options.signal instanceof AbortSignal);
    assert.equal(options.signal.aborted, false);
    return new Response(image, { headers: { 'Content-Type': 'image/jpeg' } });
  });
  assert.equal(result, `data:image/jpeg;base64,${image.toString('base64')}`);
});

test('sin token no consulta Graph y una foto ausente, denegada o vacía usa el avatar predeterminado', async () => {
  assert.equal(
    await readAzureUserPhoto(null, async () => {
      assert.fail('No debe consultar Graph sin token');
    }),
    null,
  );
  for (const status of [401, 403, 404, 429, 500]) {
    assert.equal(
      await readAzureUserPhoto('test-token', async () => new Response(null, { status })),
      null,
    );
  }
  assert.equal(await readAzureUserPhoto('test-token', async () => new Response()), null);
});

test('los errores de red y de lectura de la foto no impiden iniciar sesión', async () => {
  for (const request of [
    async () => {
      throw new DOMException('Tiempo de espera agotado', 'TimeoutError');
    },
    async () => ({
      ok: true,
      async arrayBuffer() {
        throw new Error('No se pudo leer la foto');
      },
    }),
  ]) {
    assert.equal(await readAzureUserPhoto('test-token', request), null);
  }
});

test('Azure AD solicita User.Read y conserva la foto y los nombres alternativos del perfil', async (context) => {
  const image = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  context.mock.method(globalThis, 'fetch', async () => new Response(image));
  const provider = azureAdProvider({
    clientId: 'test-client',
    clientSecret: 'test-client-secret',
    issuer: 'https://login.microsoftonline.com/test-tenant/v2.0',
  });
  assert(provider.options.authorization.params.scope.split(' ').includes('User.Read'));
  const profile = await provider.options.profile(
    { sub: 'test-user', preferred_username: 'user@example.test' },
    { access_token: 'test-token' },
  );
  assert.deepEqual(profile, {
    id: 'test-user',
    name: 'user@example.test',
    email: 'user@example.test',
    image: `data:image/jpeg;base64,${image.toString('base64')}`,
  });
  assert(!JSON.stringify(profile).includes('test-token'));
});
