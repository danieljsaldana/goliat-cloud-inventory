import test from 'node:test';
import assert from 'node:assert/strict';
import { filterOptions } from '../src/components/ui/Select/utils/filterOptions.js';
import { pageWindow } from '../src/core/pagination/index.js';

test('busca opciones fuera de la primera página por etiqueta o ID, sin distinguir acentos', () => {
  const options = Array.from({ length: 1003 }, (_, index) => ({
    value: `sub-${index}`,
    label: `Suscripción ${index}`,
  }));
  const original = structuredClone(options);
  assert.deepEqual(filterOptions(options, '  suscripcion 1002  '), [options[1002]]);
  assert.deepEqual(filterOptions(options, 'sub-999'), [options[999]]);
  assert.equal(filterOptions(options, '').length, 1003);
  assert.deepEqual(filterOptions(options, 'inexistente'), []);
  assert.deepEqual(options, original);
});

test('el selector pagina todas las coincidencias sin omitir opciones ni perder valores vacíos o deshabilitados', () => {
  const options = [
    { value: '', label: 'Todas' },
    ...Array.from({ length: 1003 }, (_, index) => ({
      value: index,
      label: `Opción ${index}`,
      disabled: index === 500,
    })),
  ];
  const matches = filterOptions(options, '');
  const collected = [];
  for (const page of Array.from(
    { length: pageWindow(matches.length, 0, 20).pages },
    (_, index) => index,
  )) {
    const { offset, end } = pageWindow(matches.length, page, 20);
    const items = matches.slice(offset, end);
    assert(items.length <= 20);
    collected.push(...items);
  }
  assert.deepEqual(collected, options);
  assert.deepEqual(filterOptions(options, 'opcion 500'), [options[501]]);
});
