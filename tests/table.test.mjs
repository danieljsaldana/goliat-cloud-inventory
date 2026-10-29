import test from 'node:test';
import assert from 'node:assert/strict';
import { isNumericColumn, tableView } from '../src/core/table/index.js';

const file = {
  headers: ['subscriptionId', 'resourceProvider', 'resources', 'name'],
  rows: [
    ['1', 'microsoft.compute', '10', 'VM España'],
    ['1', 'microsoft.compute', '2', 'vm dev'],
    ['2', 'microsoft.storage', '4', 'Cuenta'],
  ],
};

test('combina búsqueda y filtros sin perder el formato de las celdas', () => {
  const result = tableView(file, { search: 'ESPAÑA', filters: { 1: 'COMPUTE' } });
  assert.deepEqual(result.rows, [file.rows[0]]);
  assert.equal(tableView(file, { search: 'inexistente' }).rows.length, 0);
});

test('ordena por valor numérico en ambas direcciones', () => {
  assert.deepEqual(
    tableView(file, { sort: { key: 'resources', direction: 1 } }).rows.map((row) => row[2]),
    ['2', '4', '10'],
  );
  assert.deepEqual(
    tableView(file, { sort: { key: 'resources', direction: -1 } }).rows.map((row) => row[2]),
    ['10', '4', '2'],
  );
  assert.deepEqual(
    file.rows.map((row) => row[2]),
    ['10', '2', '4'],
  );
});

test('identifica cantidades con decimales, negativos y huecos sin modificar los valores', () => {
  const rows = [
    ['001', '-2.5', '10'],
    ['002', '', 'unknown'],
    ['003', '0', '4'],
  ];
  const original = structuredClone(rows);
  assert.equal(isNumericColumn(rows, 1), true);
  assert.equal(isNumericColumn(rows, 2), false);
  assert.equal(isNumericColumn([[''], ['']], 0), false);
  assert.equal(isNumericColumn([], 0), false);
  assert.equal(isNumericColumn([['Infinity']], 0), false);
  assert.deepEqual(rows, original);
});

test('agrupa las filas filtradas y suma resources', () => {
  const result = tableView(file, { filters: { 0: '1' }, groupBy: 'resourceProvider' });
  assert.deepEqual(result.headers, ['resourceProvider', 'filas', 'suma resources']);
  assert.deepEqual(result.rows, [['microsoft.compute', '2', '12']]);
  const details = {
    headers: ['subscriptionId', 'name'],
    rows: [
      ['1', 'vm'],
      ['1', 'vm2'],
    ],
  };
  assert.deepEqual(tableView(details, { groupBy: 'subscriptionId' }).rows, [['1', '2']]);
});
