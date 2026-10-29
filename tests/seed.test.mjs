import test from 'node:test';
import assert from 'node:assert/strict';
import { seedDatabase } from '../server/seed/seedDatabase.mjs';

test('la semilla rechaza producción antes de abrir conexiones o escribir datos', async () => {
  const calls = [];
  const pool = { connect: async () => calls.push('connect') };
  await assert.rejects(seedDatabase(pool, { NODE_ENV: 'production' }), { name: 'SeedError' });
  assert.deepEqual(calls, []);
});
