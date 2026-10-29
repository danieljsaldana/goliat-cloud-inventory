import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, jwtVerify } from 'jose';
import { authorize } from '../src/http/authorize.mjs';
import { httpHandlers } from '../src/http/handlers.mjs';
import azureFunctions from '@azure/functions';
import { inventoryService } from '../src/services/inventory.mjs';
import { buildDocument } from '../src/inventory/build.mjs';
import {
  TENANT,
  AUDIENCE,
  CLIENT,
  USER,
  SUBSCRIPTION,
  OTHER,
  memoryStore,
  snapshot,
} from './fixture.mjs';

const { HttpResponse } = azureFunctions;
const config = { tenantId: TENANT, audience: AUDIENCE, allowedClients: [CLIENT] };
const { privateKey, publicKey } = await generateKeyPair('RS256');
const token = async (claims = {}, audience = AUDIENCE) =>
  await new SignJWT({
    tid: TENANT,
    oid: USER,
    azp: CLIENT,
    ver: '2.0',
    idtyp: 'app',
    roles: ['Inventory.Generate'],
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(`https://login.microsoftonline.com/${TENANT}/v2.0`)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
const req = (bearer) => ({
  headers: new Headers(bearer ? { authorization: `Bearer ${bearer}` } : {}),
});

test('el estado idle produce un cuerpo JSON real en el SDK de Functions', async () => {
  const handlers = httpHandlers({ getCurrentOperation: async () => null }, async () => ({}), 1024);
  const response = await handlers.status(
    { params: { operationId: 'current' } },
    { error: () => assert.fail('No debería fallar') },
  );
  assert.deepEqual(await new HttpResponse(response).json(), { status: 'idle' });
});

test('Entra verifica firma, tenant, audiencia, cliente, rol y scope delegado', async () => {
  const accessToken = await token();
  assert.equal(
    (await authorize(req(accessToken), config, 'Generate', jwtVerify, publicKey)).objectId,
    USER,
  );
  await assert.rejects(authorize(req(), config, 'Generate', jwtVerify, publicKey), { status: 401 });
  await assert.rejects(
    authorize(req(await token({}, CLIENT)), config, 'Generate', jwtVerify, publicKey),
  );
  for (const claims of [
    { tid: CLIENT },
    { azp: USER },
    { roles: [] },
    { scp: 'Inventory.Read' },
    { ver: '1.0' },
    { idtyp: 'user' },
  ]) {
    await assert.rejects(
      authorize(req(await token(claims)), config, 'Generate', jwtVerify, publicKey),
      { status: 403 },
    );
  }
  await authorize(
    req(await token({ scp: 'Inventory.Refresh', idtyp: 'user' })),
    config,
    'Generate',
    jwtVerify,
    publicKey,
  );
  await assert.rejects(authorize(req(accessToken), config, 'Publish', jwtVerify, publicKey), {
    status: 403,
  });
  await assert.rejects(
    authorize(req(accessToken), { ...config, audience: '' }, 'Generate', jwtVerify, publicKey),
    { status: 503 },
  );
});

test('HTTP autentica antes de leer el cuerpo y no acepta ámbitos del solicitante', async () => {
  const context = { error: () => {} };
  const forbidden = httpHandlers(
    {},
    async () => {
      throw Object.assign(new Error('No autorizado'), { status: 401 });
    },
    10000,
  );
  const request = new Request('https://function.invalid/api/inventory/generate', {
    method: 'POST',
    body: '{}',
  });
  assert.equal((await forbidden.generate(request, context)).status, 401);
  assert.equal(request.bodyUsed, false);
  const service = { requestGeneration: async () => '77777777-7777-4777-8777-777777777777' };
  const handlers = httpHandlers(service, async () => ({ objectId: USER }), 10000);
  const generated = await handlers.generate(
    new Request(request.url, { method: 'POST', body: '{}' }),
    context,
  );
  assert.equal(generated.status, 202);
  assert.ok(generated.headers.location.startsWith('/api/inventory/operations/'));
  assert.equal(
    (
      await handlers.generate(
        new Request(request.url, { method: 'POST', body: '{"subscriptions":["x"]}' }),
        context,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handlers.generate(
        new Request(request.url, { method: 'POST', body: 'x'.repeat(1025) }),
        context,
      )
    ).status,
    413,
  );
});

test('HTTP publica el JSON validado y conserva el blob ante conflictos o recuentos falsos', async () => {
  const store = memoryStore();
  const service = inventoryService(
    { subscriptionIds: [SUBSCRIPTION, OTHER], maxBytes: 64 * 1024 * 1024 },
    store,
  );
  const handlers = httpHandlers(service, async () => ({ objectId: USER }), 64 * 1024 * 1024);
  const context = { error: () => {} };
  const document = buildDocument(snapshot());
  const publish = async (body, headers) =>
    await handlers.publish(
      new Request('https://function.invalid/api/inventory/publish', {
        method: 'POST',
        body: JSON.stringify(body),
        headers,
      }),
      context,
    );
  assert.equal((await publish(document, { 'if-none-match': '*' })).status, 415);
  const headers = { 'content-type': 'application/json; charset=utf-8', 'if-none-match': '*' };
  const result = await publish(document, headers);
  assert.equal(result.status, 200);
  assert.equal(result.headers.etag, store.state.latest.etag);
  assert.equal((await publish(document, headers)).status, 412);
  const invalid = structuredClone(document);
  invalid.snapshot.totals[0].resources += 1;
  assert.equal(
    (
      await publish(invalid, {
        'content-type': 'application/json',
        'if-match': result.headers.etag,
      })
    ).status,
    400,
  );
  assert.equal(store.state.writes.length, 1);
});
