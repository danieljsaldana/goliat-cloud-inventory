import test from 'node:test';
import assert from 'node:assert/strict';
import { inventorySyncState } from '../src/features/administration/utils/inventorySyncState.js';

test('la sincronización compara instantes y no declara coincidencia con fechas inválidas o ausentes', () => {
  assert.equal(
    inventorySyncState('2026-10-10T10:00:00Z', '2026-10-10T12:00:00+02:00'),
    'timestampsMatch',
  );
  assert.equal(inventorySyncState('2026-10-10T10:00:00Z', '2026-10-10T10:00:01Z'), 'storageNewer');
  assert.equal(inventorySyncState('2026-10-10T10:00:01Z', '2026-10-10T10:00:00Z'), 'webNewer');
  for (const [imported, published] of [
    [undefined, undefined],
    ['invalid', '2026-10-10T10:00:00Z'],
    ['2026-10-10T10:00:00Z', null],
  ]) {
    assert.equal(inventorySyncState(imported, published), 'unknown');
  }
});

test('el ETag confirma el archivo importado y detecta cambios incluso con fechas de generación iguales', () => {
  const time = '2026-10-10T10:00:00Z';
  assert.equal(
    inventorySyncState(time, time, { importedEtag: 'same', publishedEtag: 'same' }),
    'synced',
  );
  assert.equal(
    inventorySyncState(time, time, { importedEtag: 'old', publishedEtag: 'new' }),
    'changed',
  );
  assert.equal(
    inventorySyncState(null, null, { importedEtag: 'old', publishedEtag: 'new' }),
    'changed',
  );
  assert.equal(
    inventorySyncState(null, null, { importedEtag: 'same', publishedEtag: 'same' }),
    'synced',
  );
  assert.equal(
    inventorySyncState(time, time, { importedEtag: '', publishedEtag: '' }),
    'timestampsMatch',
  );
});
