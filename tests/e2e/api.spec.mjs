import { REPORTS } from '../../src/core/inventory/reports.js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './support/fixtures.mjs';
import { E2E_ORIGIN } from './support/constants.mjs';
import { testPool } from './support/database.mjs';

test('salud y readiness son públicas y las lecturas autenticadas no escriben datos', async ({
  signedInPage: page,
  request,
}) => {
  expect(await (await request.get('/api/health/')).json()).toEqual({ status: 'ok' });
  const ready = await request.get('/api/ready/');
  expect(ready.status()).toBe(200);
  expect(await ready.json()).toEqual({ status: 'ready' });
  expect(ready.headers()['cache-control']).toContain('no-store');
  const pool = testPool();
  try {
    const sql = 'SELECT count(*)::integer AS snapshots FROM inventory_runs';
    const before = (await pool.query(sql)).rows;
    const response = await page.request.get('/api/inventory/azure/');
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('private, no-store');
    expect(Object.keys((await response.json()).files)).toHaveLength(REPORTS.length);
    for (const path of ['/api/inventory/azure/resources/?limit=17']) {
      expect((await page.request.get(path)).status(), path).toBe(200);
    }
    expect((await page.request.get('/api/inventory/azure/refresh/')).status()).toBe(503);
    expect((await pool.query(sql)).rows).toEqual(before);
  } finally {
    await pool.end();
  }
});

test('la API Azure pagina un snapshot estable, respeta el ámbito y rechaza cursores inválidos', async ({
  signedInPage: page,
}) => {
  const path = '/api/inventory/azure/resources/';
  const first = await (await page.request.get(`${path}?limit=17`)).json();
  expect(first.file.rows).toHaveLength(17);
  expect(first.nextCursor).not.toBeNull();
  const second = await (
    await page.request.get(`${path}?limit=17&runId=${first.runId}&after=${first.nextCursor}`)
  ).json();
  expect(second.runId).toBe(first.runId);
  const ids = [...first.file.rows, ...second.file.rows].map((row) => row.at(-1));
  expect(new Set(ids).size).toBe(34);
  const scope = '22222222-2222-4222-8222-222222222222';
  const scoped = await (await page.request.get(`${path}?limit=500&scope=${scope}`)).json();
  expect(scoped.file.rows).toHaveLength(63);
  const column = scoped.file.headers.indexOf('subscriptionId');
  expect(scoped.file.rows.every((row) => row[column] === scope)).toBe(true);
  for (const query of ['after=-1', 'runId=invalido', 'limit=501', 'scope=' + 'x'.repeat(129)]) {
    const response = await page.request.get(`${path}?${query}`);
    expect(response.status(), query).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_filters' });
  }
  expect((await page.request.get(`${path}?runId=${randomUUID()}`)).status()).toBe(404);
  expect((await page.request.get('/api/inventory/azure/desconocido/')).status()).toBe(400);
});

test('la API rechaza peticiones de actualización de otro origen', async ({
  signedInPage: page,
}) => {
  for (const path of ['/api/inventory/azure/refresh/']) {
    for (const headers of [
      {},
      { Origin: 'https://otro.example' },
      { Origin: E2E_ORIGIN, 'Sec-Fetch-Site': 'cross-site' },
    ]) {
      const response = await page.request.post(path, { headers });
      expect(response.status(), path).toBe(403);
      expect(await response.json()).toEqual({ error: 'invalid_origin' });
    }
    const unavailable = await page.request.post(path, { headers: { Origin: E2E_ORIGIN } });
    expect(unavailable.status()).toBe(503);
    expect(await unavailable.json()).toEqual({ error: 'refresh_unconfigured' });
    expect(await (await page.request.get(path)).json()).toEqual({ error: 'refresh_unconfigured' });
  }
});
