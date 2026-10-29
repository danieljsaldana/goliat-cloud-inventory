import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localTagConfig } from '../scripts/localTagConfig.mjs';

test('solo importa etiquetas del .env local y respeta valores vacíos y el entorno del terminal', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'goliat-local-tags-'));
  const path = join(directory, '.env');
  try {
    await writeFile(
      path,
      'INVENTORY_TAG_KEYS="Environment,Project,Tier"\nAZURE_CLIENT_SECRET=private\nDB_PASSWORD=private\n',
    );
    const env = {};
    await localTagConfig({ env, path });
    assert.deepEqual(env, { INVENTORY_TAG_KEYS: 'Environment,Project,Tier' });
    const automatic = { INVENTORY_TAG_KEYS: '' };
    await localTagConfig({ env: automatic, path });
    assert.deepEqual(automatic, { INVENTORY_TAG_KEYS: '' });
    const override = { INVENTORY_TAG_KEYS: 'Owner' };
    await localTagConfig({ env: override, path });
    assert.deepEqual(override, { INVENTORY_TAG_KEYS: 'Owner' });
    await localTagConfig({ env: {}, path: join(directory, 'missing') });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
