import test from 'node:test';
import assert from 'node:assert/strict';
import { readTags, validateTags } from '../server/administration/tags.mjs';
import { readSchedule } from '../server/administration/schedule.mjs';
import { functionAdministration } from '../server/administration/functionAdministration.mjs';
import { handleAdministration } from '../server/administration/handleAdministration.mjs';
import { inventoryTagKeys } from '../src/features/administration/utils/inventoryTagKeys.js';
import { buildDocument } from '../functions/src/inventory/build.mjs';
import { snapshot } from '../functions/tests/fixture.mjs';
import { normalizeAzureSnapshot } from '../server/modules/azure/normalization/normalizeSnapshot.mjs';

const env = {
  AUTH_URL: 'https://web.example',
  AZURE_FUNCTION_RESOURCE_ID:
    '/subscriptions/11111111-1111-4111-8111-111111111111/resourceGroups/rg-test/providers/Microsoft.Web/sites/func-test',
};
const original = {
  INVENTORY_TAG_KEYS: 'Environment,Project',
  INVENTORY_SCHEDULE: '0 0 2 * * *',
  SECRET_SETTING: 'private-setting',
};
const credential = { getToken: async () => ({ token: 'test-token' }) };
function fixture({ operation = null, confirm = true } = {}) {
  const state = { properties: { ...original }, writes: 0, locks: [] };
  const client = functionAdministration({
    env,
    credential,
    operations: { current: async () => operation },
    lock: async (key, work, { signal }) => {
      state.locks.push(key);
      return work({ signal });
    },
    request: async (_url, options) => {
      if (options.method === 'PUT') {
        if (confirm) state.properties = JSON.parse(options.body).properties;
        state.writes++;
      }
      return Response.json({ properties: state.properties });
    },
  });
  return { client, state };
}

test('valida las etiquetas y permite volver a la detección automática sin nombres duplicados ni inyección de listas', () => {
  const config = readTags(original);
  assert.deepEqual(config.keys, ['Environment', 'Project']);
  assert.deepEqual(validateTags({ ...config, keys: [] }), []);
  assert.deepEqual(validateTags({ ...config, keys: ['monCov:source', 'Cost Center'] }), [
    'monCov:source',
    'Cost Center',
  ]);
  for (const keys of [
    null,
    'Environment',
    [''],
    ['Environment', 'environment'],
    ['a,b'],
    ['a\nb'],
    ['a\0b'],
    [' a '],
    [1],
    ['x'.repeat(513)],
    Array.from({ length: 129 }, (_, i) => `tag${i}`),
    Array.from({ length: 10 }, (_, i) => `${i}${'a'.repeat(500)}`),
  ])
    assert.throws(() => validateTags({ ...config, keys }), /invalid_tags/);
  assert.throws(() => validateTags({ ...config, version: 'invalid' }), /invalid_tags/);
});

test('guardar etiquetas conserva secretos y timer, confirma Azure y comparte bloqueo con la programación', async () => {
  const { client, state } = fixture();
  const result = await client.updateTags({ ...readTags(original), keys: ['Environment', 'Tier'] });
  assert.deepEqual(result.keys, ['Environment', 'Tier']);
  assert.equal(state.properties.SECRET_SETTING, original.SECRET_SETTING);
  assert.equal(state.properties.INVENTORY_SCHEDULE, original.INVENTORY_SCHEDULE);
  assert.equal(JSON.stringify(result).includes(original.SECRET_SETTING), false);
  await client.updateSchedule({ ...readSchedule(state.properties), time: '04:30' });
  assert.equal(state.properties.INVENTORY_TAG_KEYS, 'Environment,Tier');
  assert.equal(state.locks[0], state.locks[1]);
  await assert.rejects(
    client.updateTags({ ...readTags(original), keys: ['Project'] }),
    (error) => error.status === 409 && error.message === 'tags_changed',
  );
  assert.equal(state.writes, 2);
  const automatic = await client.updateTags({ ...readTags(state.properties), keys: [] });
  assert.deepEqual(automatic.keys, []);
  assert.equal(state.properties.INVENTORY_TAG_KEYS, '');
});

test('no modifica etiquetas durante una generación ni acepta escrituras no confirmadas', async () => {
  for (const status of ['queued', 'running', 'retrying']) {
    const { client, state } = fixture({ operation: { status } });
    await assert.rejects(
      client.updateTags({ ...readTags(original), keys: [] }),
      (error) => error.status === 409 && error.message === 'generation_running',
    );
    assert.equal(state.writes, 0);
  }
  await assert.rejects(
    fixture({ confirm: false }).client.updateTags({ ...readTags(original), keys: [] }),
    /settings_not_confirmed/,
  );
});

test('la API de etiquetas exige mismo origen, valida payloads y distingue conflictos de programación', async () => {
  const { client } = fixture();
  const send = (input, origin = env.AUTH_URL) =>
    handleAdministration(
      new Request(`${env.AUTH_URL}/api/admin/function/`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tags', ...input }),
      }),
      { env, client },
    );
  assert.equal(
    (await send({ ...readTags(original), keys: ['Tier'] }, 'https://other.example')).status,
    403,
  );
  const invalid = await send({ ...readTags(original), keys: ['a,b'] });
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { error: 'invalid_tags' });
  const saved = await send({ ...readTags(original), keys: ['Tier'] });
  assert.equal(saved.status, 200);
  assert.deepEqual((await saved.json()).tags.keys, ['Tier']);
  const stale = await send({ ...readTags(original), keys: ['Project'] });
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), { error: 'tags_changed' });
});

test('la selección limita columnas y conserva todas las etiquetas para poder volver a elegirlas', () => {
  const document = buildDocument(snapshot(), ['environment']);
  const { files } = normalizeAzureSnapshot(document.snapshot, document.generatedAt);
  assert.ok(files.resources.headers.includes('tag_environment'));
  assert.ok(!files.resources.headers.includes('tag_shared'));
  const row = files.resources.rows[0];
  assert.equal(row[files.resources.headers.indexOf('tag_environment')], 'dev');
  assert.equal(JSON.parse(row[files.resources.headers.indexOf('tags_json')]).shared, 'false');
  const choices = inventoryTagKeys(files);
  assert.ok(choices.some((key) => key.toLowerCase() === 'environment'));
  assert.ok(choices.includes('shared'));
  const automatic = buildDocument(snapshot(), []);
  assert.ok(automatic.snapshot.tagKeys.includes('shared'));
  assert.deepEqual(
    inventoryTagKeys({
      resources: { headers: ['tags_json'], rows: [['broken'], ['null'], ['[]']] },
    }),
    [],
  );
});
