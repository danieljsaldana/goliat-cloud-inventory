import test from 'node:test';
import assert from 'node:assert/strict';
import es from '../src/core/i18n/locales/es.js';
import en from '../src/core/i18n/locales/en.js';
import { LOCALE_KEY, readLocale } from '../src/core/i18n/config.js';
import { translate } from '../src/core/i18n/translate.js';
import { REPORT_GROUPS, REPORTS } from '../src/core/inventory/reports.js';
import { columnLabel, tableView } from '../src/core/table/index.js';
import inventory from '../server/modules/azure/seed/data/inventory.json' with { type: 'json' };

test('español e inglés tienen las mismas claves y parámetros de interpolación', () => {
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
  const parameters = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const key of Object.keys(es)) {
    assert.ok(es[key].trim(), key);
    assert.ok(en[key].trim(), key);
    assert.deepEqual(parameters(es[key]), parameters(en[key]), key);
  }
});

test('todos los informes y secciones usan claves traducidas y grupos válidos', () => {
  assert.equal(new Set(REPORTS.map((report) => report.id)).size, REPORTS.length);
  for (const { labelKey } of [...REPORT_GROUPS, ...REPORTS]) {
    assert.ok(Object.hasOwn(es, labelKey), labelKey);
    assert.ok(Object.hasOwn(en, labelKey), labelKey);
  }
  for (const report of REPORTS) assert.ok(REPORT_GROUPS.some((group) => group.id === report.group));
});

test('las cabeceras de todas las vistas tienen etiquetas legibles en ambos idiomas', () => {
  for (const locale of ['es', 'en']) {
    const catalog = locale === 'es' ? es : en;
    const t = (key, values) => translate(locale, key, values);
    for (const report of REPORTS) {
      for (const header of inventory[report.id].headers) {
        assert.ok(Object.hasOwn(catalog, `table.columns.${header}`), `${locale}: ${header}`);
        const label = columnLabel(header, t);
        assert.notEqual(label, header, `${locale}: ${header}`);
        assert.ok(!label.startsWith('table.'), `${locale}: ${header}`);
      }
    }
  }
});

test('las etiquetas personalizadas y agrupaciones conservan las claves y los valores originales', () => {
  const t = (key, values) => translate('es', key, values);
  assert.equal(columnLabel('tag_Centro_de_costes', t), 'Etiqueta: Centro_de_costes');
  assert.equal(columnLabel('campoPersonalizado', t), 'campoPersonalizado');
  assert.equal(columnLabel('__proto__', t), '__proto__');
  assert.equal(columnLabel('eventTime', t), 'Fecha del evento (UTC)');
  const file = { headers: ['subscriptionId', 'resources'], rows: [['demo', '3']] };
  const result = tableView(file, { groupBy: 'subscriptionId' });
  assert.deepEqual(
    result.headers.map((header) => columnLabel(header, t)),
    ['ID de la suscripción', 'Número de filas', 'Total de recursos'],
  );
  assert.deepEqual(result.headers, ['subscriptionId', 'filas', 'suma resources']);
  assert.deepEqual(result.rows, [['demo', '1', '3']]);
});

test('traduce claves y parámetros sin modificar IDs ni datos del inventario', () => {
  assert.equal(translate('en', 'table.page', { page: 2, pages: 3 }), 'Page 2 of 3');
  assert.equal(translate('es', 'table.columnCount', { count: 0 }), '0 columnas');
  const id = '/subscriptions/demo/providers/Microsoft.Network/virtualNetworks/prod';
  assert.equal(translate('en', id), id);
  assert.equal(translate('en', '__proto__'), '__proto__');
  assert.equal(translate('fr', 'common.home'), 'Inicio');
});

test('restaura un idioma válido y usa español si falta, es inválido o localStorage está bloqueado', () => {
  for (const locale of ['es', 'en'])
    assert.equal(readLocale({ getItem: (key) => (key === LOCALE_KEY ? locale : null) }), locale);
  for (const locale of [null, 'fr', '__proto__', ''])
    assert.equal(readLocale({ getItem: () => locale }), 'es');
  assert.equal(readLocale(undefined), 'es');
  assert.equal(
    readLocale({
      getItem() {
        throw new Error('SecurityError');
      },
    }),
    'es',
  );
});
