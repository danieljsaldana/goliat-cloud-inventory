import { REPORTS } from '../src/core/inventory/reports.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import pg from 'pg';
import { databaseConfig } from '../server/config.mjs';
import { initializeDatabase } from '../server/database/initialize.mjs';
import { seedDatabase } from '../server/seed/seedDatabase.mjs';
import { createSeed } from '../server/seed/createSeed.mjs';
import { writeSeed } from '../server/seed/writeSeed.mjs';
import { getInventory } from '../server/modules/azure/services/inventory.mjs';
import { saveStorageInventory } from '../server/modules/azure/repositories/storageInventory.mjs';

test(
  'PostgreSQL: CLI, semilla atómica y repetible, protección de datos e ingesta Azure por ETag',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.match(process.env.DB_NAME, /_test$/);
    const schema = `seed_${randomUUID().replaceAll('-', '')}`;
    const admin = new pg.Pool(databaseConfig());
    const pool = new pg.Pool({ ...databaseConfig(), options: `-c search_path=${schema}` });
    const development = { NODE_ENV: 'development' };
    const count = async (table) => {
      assert.ok(['inventory_runs', 'inventory_heads'].includes(table));
      return Number((await pool.query(`SELECT COUNT(*) AS count FROM ${table}`)).rows[0].count);
    };
    const clear = async () => pool.query('TRUNCATE inventory_heads, inventory_runs CASCADE');
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await initializeDatabase(pool);
      const results = await Promise.all([
        seedDatabase(pool, development),
        seedDatabase(pool, development),
      ]);
      assert.equal(results[0].azure.runId, results[1].azure.runId);
      assert.equal(results.filter((result) => !result.azure.skipped).length, 1);
      assert.equal(await count('inventory_runs'), 1);
      const inventory = await getInventory(pool);
      assert.equal(Object.keys(inventory.files).length, REPORTS.length);
      assert.equal(inventory.files['resources'].rows.length, 214);

      const { stdout } = await promisify(execFile)(process.execPath, ['server/cli.mjs', 'seed'], {
        env: { ...process.env, NODE_ENV: 'development', PGOPTIONS: `-c search_path=${schema}` },
        timeout: 60000,
      });
      assert.equal(JSON.parse(stdout).azure.skipped, true);
      assert.equal(await count('inventory_runs'), 1);

      await pool.query(
        `UPDATE inventory_runs SET metadata = jsonb_set(metadata, '{source}', '"real-data"')`,
      );
      await assert.rejects(seedDatabase(pool, development), { name: 'SeedError' });
      assert.equal((await getInventory(pool)).metadata.source, 'real-data');
      await clear();
      const seed = createSeed();
      await assert.rejects(
        writeSeed(
          {
            ...seed,
            files: {
              ...seed.files,
              resources: { headers: ['subscriptionId'], rows: [['x'.repeat(129)]] },
            },
          },
          pool,
        ),
      );
      assert.equal(await count('inventory_runs'), 0);
      assert.equal(await count('inventory_heads'), 0);

      const metadata = {
        ...seed.metadata,
        source: 'azure-storage',
        generatedAt: '2026-10-09T05:00:00Z',
        storage: {
          accountUrl: 'https://demo.blob.core.windows.net',
          container: 'inventory',
          blob: 'azure/latest.json',
          etag: 'v1',
        },
      };
      const first = await saveStorageInventory(seed.files, metadata, pool);
      assert.equal(first.skipped, false);
      const duplicate = await saveStorageInventory(seed.files, metadata, pool);
      assert.equal(duplicate.runId, first.runId);
      assert.equal(duplicate.skipped, true);
      const old = await saveStorageInventory(
        seed.files,
        {
          ...metadata,
          generatedAt: '2026-10-08T05:00:00Z',
          storage: { ...metadata.storage, etag: 'old' },
        },
        pool,
      );
      assert.equal(old.skipped, true);
      assert.equal(await count('inventory_runs'), 1);
      const next = {
        ...metadata,
        generatedAt: '2026-10-10T05:00:00Z',
        storage: { ...metadata.storage, etag: 'v2' },
      };
      const concurrent = await Promise.all([
        saveStorageInventory(seed.files, next, pool),
        saveStorageInventory(seed.files, next, pool),
      ]);
      assert.equal(concurrent[0].runId, concurrent[1].runId);
      assert.equal(await count('inventory_runs'), 2);
      assert.equal((await getInventory(pool)).metadata.storage.etag, 'v2');
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
