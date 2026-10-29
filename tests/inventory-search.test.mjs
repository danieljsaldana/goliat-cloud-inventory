import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchIndex, searchInventory } from '../src/core/inventory/search.js';
import { translate } from '../src/core/i18n/translate.js';
import files from '../server/modules/azure/seed/data/inventory.json' with { type: 'json' };

const index = createSearchIndex(files);
const search = (query, locale = 'es') =>
  searchInventory(index, files, query, (key) => translate(locale, key));
const resources = (query) => search(query).groups.find(({ kind }) => kind === 'resources').items;

test('deduplica recursos y abre una vista de detalle disponible con su ID y suscripción', () => {
  const result = resources('apim-demo-prod');
  assert.equal(result.length, 1);
  assert.equal(result[0].reportId, 'api-management');
  assert.equal(result[0].subscriptionId, '11111111-1111-4111-8111-111111111111');
  assert.equal(resources(result[0].id)[0].id, result[0].id);
  assert.equal(
    new Set(index.filter(({ kind }) => kind === 'resources').map(({ key }) => key)).size,
    index.filter(({ kind }) => kind === 'resources').length,
  );
});

test('busca etiquetas, claves personalizadas y términos combinados sin distinguir acentos ni mayúsculas', () => {
  assert.ok(resources('TESORERIA').some(({ name }) => name === 'apim-demo-prod'));
  assert.ok(resources('cost_center 00120').some(({ name }) => name === 'apim-demo-prod'));
  assert.ok(resources('apim PRODUCCION').some(({ name }) => name === 'apim-demo-prod'));
  assert.equal(resources('apim no-existe').length, 0);
});

test('incluye suscripciones vacías y busca vistas en ambos idiomas', () => {
  assert.ok(
    search('vacia')
      .groups.find(({ kind }) => kind === 'subscriptions')
      .items.some(({ name }) => name === 'Demo - Vacía'),
  );
  for (const [query, locale] of [
    ['máquinas virtuales', 'es'],
    ['virtual machines', 'en'],
  ]) {
    assert.ok(
      search(query, locale)
        .groups.find(({ kind }) => kind === 'reports')
        .items.some(({ id }) => id === 'virtual-machines'),
    );
  }
});

test('limita resultados, informa del total y no lista recursos antes de escribir', () => {
  const result = search('demo');
  assert.equal(result.groups[0].items.length, 20);
  assert.ok(result.total > result.shown);
  assert.equal(resources('   ').length, 0);
  assert.deepEqual(
    searchInventory([], {}, 'demo', (key) => key).groups.flatMap(({ items }) => items),
    [],
  );
});

test('un informe ausente no impide buscar y el inventario genérico sirve como destino alternativo', () => {
  const partial = { resources: files.resources };
  const result = searchInventory(
    createSearchIndex(partial),
    partial,
    'apim-demo-prod',
    (key) => key,
  );
  assert.equal(result.groups[0].items[0].reportId, 'resources');
  const detailOnly = { 'virtual-machines': files['virtual-machines'] };
  assert.ok(createSearchIndex(detailOnly).some(({ name }) => name === 'vm-demo-001'));
});
