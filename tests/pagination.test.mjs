import test from 'node:test';
import assert from 'node:assert/strict';
import { gridRows, pageItems, pageWindow } from '../src/core/pagination/index.js';

test('recorre inventarios grandes sin omitir ni repetir registros con tamaños de lista y tabla', () => {
  const records = Array.from({ length: 50003 }, (_, index) => index);
  for (const size of [5, 8, 20, 100, 1000]) {
    const collected = [];
    const { pages } = pageWindow(records.length, 0, size);
    for (const page of Array.from({ length: pages }, (_, index) => index)) {
      const { offset, start, end } = pageWindow(records.length, page, size);
      const visible = records.slice(offset, end);
      assert.ok(visible.length <= size);
      assert.equal(visible[0], start - 1);
      assert.equal(visible.at(-1), end - 1);
      collected.push(...visible);
    }
    assert.deepEqual(collected, records);
  }
});

test('pagina servicios en filas completas para distintos anchos sin perder ni duplicar tarjetas', () => {
  const services = Array.from({ length: 35 }, (_, index) => `service-${index}`);
  for (const columns of [1, 2, 3, 4, 6, 7, 8]) {
    const rows = gridRows(services, columns);
    for (const rowsPerPage of [2, 4, 8]) {
      const collected = [];
      const { pages } = pageWindow(rows.length, 0, rowsPerPage);
      for (const page of Array.from({ length: pages }, (_, index) => index)) {
        const { offset, end } = pageWindow(rows.length, page, rowsPerPage);
        const cards = rows.slice(offset, end).flat();
        const range = pageWindow(services.length, page, rowsPerPage * columns);
        assert.equal(cards.length, range.end - range.offset);
        if (page < pages - 1) assert.equal(cards.length, rowsPerPage * columns);
        collected.push(...cards);
      }
      assert.deepEqual(collected, services);
    }
  }
  assert.equal(gridRows(services, 7).slice(0, 2).flat().length, 14);
  assert.equal(gridRows(services, 6).slice(0, 2).flat().length, 12);
});

test('una cuadrícula vacía no crea tarjetas y las columnas deben ser válidas', () => {
  assert.deepEqual(gridRows([], 7), []);
  for (const columns of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => gridRows(['service'], columns), RangeError);
  }
});

test('ajusta la página al reducir el inventario y representa vacíos sin rangos incorrectos', () => {
  const last = pageWindow(101, 1000, 20);
  assert.equal(last.currentPage, 5);
  assert.equal(last.start, 101);
  assert.equal(last.end, 101);
  const filtered = pageWindow(2, last.currentPage, 20);
  assert.equal(filtered.currentPage, 0);
  assert.equal(filtered.start, 1);
  assert.equal(filtered.end, 2);
  assert.deepEqual(pageWindow(0, 5, 20), { pages: 1, currentPage: 0, offset: 0, start: 0, end: 0 });
  assert.equal(pageWindow(20, -1, 5).currentPage, 0);
});

test('la paginación numerada muestra el principio, el contexto actual y el final', () => {
  const values = (pages, current) =>
    pageItems(pages, current).map((item) => (item.type === 'page' ? item.page + 1 : item.key));
  assert.deepEqual(values(0, 0), []);
  assert.deepEqual(values(1, 0), [1]);
  assert.deepEqual(values(6, 3), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(values(11, 0), [1, 2, 3, 'next-gap', 11]);
  assert.deepEqual(values(11, 5), [1, 'previous-gap', 5, 6, 7, 'next-gap', 11]);
  assert.deepEqual(values(11, 10), [1, 'previous-gap', 9, 10, 11]);
  assert.deepEqual(values(11, 3), [1, 2, 3, 4, 5, 'next-gap', 11]);
});

test('la paginación conserva enlaces únicos y limita los controles para inventarios grandes', () => {
  for (const pages of [1, 2, 7, 8, 11, 43, 50003, 1000000]) {
    for (const requested of [-1, 0, 1, 3, Math.floor(pages / 2), pages - 2, pages - 1, pages]) {
      const current = Math.max(0, Math.min(requested, pages - 1));
      const items = pageItems(pages, requested);
      const links = items.filter((item) => item.type === 'page');
      assert(items.length <= 7);
      assert.equal(new Set(items.map((item) => item.key)).size, items.length);
      assert.equal(links[0].page, 0);
      assert.equal(links.at(-1).page, pages - 1);
      assert(links.some((item) => item.page === current));
      assert(links.every((item) => item.page >= 0 && item.page < pages));
      assert.deepEqual(
        links.map((item) => item.page),
        links.map((item) => item.page).toSorted((a, b) => a - b),
      );
      for (const neighbor of [current - 1, current + 1]) {
        if (neighbor >= 0 && neighbor < pages) assert(links.some((item) => item.page === neighbor));
      }
      assert.equal(items[0].type, 'page');
      assert.equal(items.at(-1).type, 'page');
    }
  }
});
