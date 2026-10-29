import test from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnPath } from '../server/access.mjs';
import { signInReturnPath } from '../src/features/auth/utils/signInReturnPath.js';

const origin = 'https://dashboard.example';

test('el aviso de acceso conserva la vista, los filtros repetidos y el fragmento', () => {
  const target = '/en/inventario/virtual-machines/?tag=equipo%20cloud&tag=producción#resources';
  const destination = new URL(signInReturnPath(safeReturnPath(target), origin), origin);
  assert.equal(destination.pathname, '/en/inventario/virtual-machines/');
  assert.deepEqual(destination.searchParams.getAll('tag'), ['equipo cloud', 'producción']);
  assert.equal(destination.hash, '#resources');
  assert.equal(destination.searchParams.get('signedIn'), '1');
});

test('un marcador anterior se reemplaza sin añadir avisos duplicados', () => {
  const destination = new URL(signInReturnPath('/es/?signedIn=0&signedIn=1', origin), origin);
  assert.deepEqual(destination.searchParams.getAll('signedIn'), ['1']);
});

test('el aviso mantiene el destino local al recibir un retorno rechazado', () => {
  for (const target of ['https://evil.example/', '//evil.example/', '/\\evil.example/']) {
    const destination = new URL(signInReturnPath(safeReturnPath(target, '/en/'), origin), origin);
    assert.equal(destination.origin, origin);
    assert.equal(destination.pathname, '/en/');
  }
});
