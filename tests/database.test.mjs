import { REPORTS } from '../src/core/inventory/reports.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import seedFiles from '../server/modules/azure/seed/data/inventory.json' with { type: 'json' };
import { databaseConfig } from '../server/config.mjs';
import { MIGRATION_LOCK } from '../server/database/constants.mjs';
import { migrationStatus, assertSchemaReady } from '../server/database/status.mjs';
import {
  getInventoryReport,
  inventoryReportFilters,
} from '../server/modules/azure/services/inventoryReport.mjs';
import { getPool, closePool } from '../server/db.mjs';
import { migrate } from '../server/migrate.mjs';
import { initializeDatabase } from '../server/database/initialize.mjs';
import { getInventory, saveInventory } from '../server/modules/azure/services/inventory.mjs';

test(
  'PostgreSQL: migraciones, todas las vistas, publicación atómica',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.match(
      process.env.DB_NAME,
      /_test$/,
      'Usar una base de datos temporal terminada en _test.',
    );
    const pool = getPool();
    try {
      await initializeDatabase(pool);
      await initializeDatabase(pool);
      await assertSchemaReady(pool);
      const saved = await saveInventory(seedFiles, { source: 'demo-seed' }, pool);
      assert.equal(saved.reports, REPORTS.length);
      const inventory = await getInventory(pool);
      assert.equal(Object.keys(inventory.files).length, REPORTS.length);
      assert.equal(inventory.files['subscriptions'].rows.length, 5);
      const invalid = {
        subscriptions: { headers: ['subscriptionId'], rows: [['x'.repeat(129)]] },
      };
      await assert.rejects(saveInventory(invalid, {}, pool));
      assert.deepEqual(await getInventory(pool), inventory);

      const filters = inventoryReportFilters('resources', new URLSearchParams({ limit: '17' }));
      const first = await getInventoryReport(filters, pool);
      const detail = inventory.files['resources'];
      await saveInventory(
        { ...inventory.files, resources: { ...detail, rows: detail.rows.slice(0, 1) } },
        {},
        pool,
      );
      const accumulated = [...first.file.rows];
      const cursor = { after: first.nextCursor };
      while (cursor.after !== null) {
        const page = await getInventoryReport(
          { ...filters, runId: first.runId, after: cursor.after },
          pool,
        );
        accumulated.push(...page.file.rows);
        cursor.after = page.nextCursor;
      }
      assert.deepEqual(
        accumulated,
        detail.rows,
        'Las páginas mantienen el snapshot aunque cambie la cabecera.',
      );
      const scope = detail.rows[0][detail.headers.indexOf('subscriptionId')];
      const scoped = await getInventoryReport(
        { ...filters, runId: first.runId, scope, limit: 500 },
        pool,
      );
      assert.ok(
        scoped.file.rows.every((row) => row[detail.headers.indexOf('subscriptionId')] === scope),
      );
      assert.equal(
        (await getInventoryReport({ ...filters, scope: "x' OR 1=1 --" }, pool)).file.rows.length,
        0,
      );
      assert.equal(await getInventoryReport({ ...filters, runId: randomUUID() }, pool), null);
    } finally {
      await closePool();
    }
  },
);

test(
  'PostgreSQL: upgrade con datos, rollback, checksums, readiness y migradores concurrentes',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.match(process.env.DB_NAME, /_test$/);
    const schema = `migration_${randomUUID().replaceAll('-', '')}`;
    const setup = new pg.Pool(databaseConfig());
    const pool = new pg.Pool({ ...databaseConfig(), options: `-c search_path=${schema}`, max: 3 });
    const directory = await mkdtemp(join(tmpdir(), 'migration-integration-'));
    const oldDirectory = join(directory, 'old');
    const newDirectory = join(directory, 'new');
    try {
      await setup.query(`CREATE SCHEMA ${schema}`);
      await mkdir(oldDirectory);
      await mkdir(newDirectory);
      const initial =
        "CREATE TABLE upgrade_probe (value TEXT NOT NULL); INSERT INTO upgrade_probe(value) VALUES ('conservar');\n";
      await writeFile(join(oldDirectory, '001_initial.sql'), initial);
      await writeFile(join(newDirectory, '001_initial.sql'), initial);
      await writeFile(
        join(newDirectory, '002_expand.sql'),
        'ALTER TABLE upgrade_probe ADD COLUMN version INTEGER NOT NULL DEFAULT 1;\n',
      );
      assert.equal((await migrationStatus(pool, { directory: oldDirectory })).ready, false);
      assert.deepEqual(await migrate(pool, { directory: oldDirectory }), {
        applied: ['001_initial.sql'],
        skipped: 0,
      });
      await assert.rejects(assertSchemaReady(pool, { directory: newDirectory }), {
        code: 'SCHEMA_NOT_READY',
      });
      assert.deepEqual(await migrate(pool, { directory: newDirectory }), {
        applied: ['002_expand.sql'],
        skipped: 1,
      });
      assert.deepEqual((await pool.query('SELECT * FROM upgrade_probe')).rows, [
        { value: 'conservar', version: 1 },
      ]);
      assert.equal((await assertSchemaReady(pool, { directory: newDirectory })).ready, true);
      assert.equal(
        (await assertSchemaReady(pool, { directory: oldDirectory })).ready,
        true,
        'El lector antiguo convive con una expansión.',
      );
      await assert.rejects(migrate(pool, { directory: oldDirectory }), {
        code: 'MIGRATION_BLOCKED',
      });
      assert.deepEqual(await migrate(pool, { directory: newDirectory }), {
        applied: [],
        skipped: 2,
      });

      const changed = `${initial}-- cambiado\n`;
      await writeFile(join(newDirectory, '001_initial.sql'), changed);
      await assert.rejects(migrate(pool, { directory: newDirectory }), {
        code: 'MIGRATION_BLOCKED',
      });
      await assert.rejects(assertSchemaReady(pool, { directory: newDirectory }), {
        code: 'SCHEMA_NOT_READY',
      });
      await writeFile(join(newDirectory, '001_initial.sql'), initial);

      await writeFile(
        join(newDirectory, '003_failure.sql'),
        "INSERT INTO upgrade_probe(value) VALUES ('revertir'); SELECT * FROM missing_relation;",
      );
      await assert.rejects(migrate(pool, { directory: newDirectory }), { code: '42P01' });
      assert.equal(
        (await pool.query('SELECT COUNT(*)::integer AS count FROM upgrade_probe')).rows[0].count,
        1,
      );
      assert.equal(
        (await migrationStatus(pool, { directory: newDirectory })).pending[0],
        '003_failure.sql',
      );

      const blocker = await pool.connect();
      try {
        await blocker.query('SELECT pg_advisory_lock(hashtext($1))', [MIGRATION_LOCK]);
        await assert.rejects(migrate(pool, { directory: newDirectory }), {
          code: 'MIGRATION_BUSY',
        });
        await blocker.query('SELECT pg_advisory_unlock(hashtext($1))', [MIGRATION_LOCK]);
        await writeFile(
          join(newDirectory, '003_failure.sql'),
          "INSERT INTO upgrade_probe(value) VALUES ('reintento');",
        );
        await blocker.query('BEGIN');
        await blocker.query('LOCK TABLE upgrade_probe IN ACCESS EXCLUSIVE MODE');
        await assert.rejects(
          migrate(pool, { directory: newDirectory, env: { DB_MIGRATION_LOCK_TIMEOUT_MS: '100' } }),
          { code: '55P03' },
        );
        await blocker.query('ROLLBACK');
        assert.deepEqual(await migrate(pool, { directory: newDirectory }), {
          applied: ['003_failure.sql'],
          skipped: 2,
        });
      } finally {
        await blocker.query('ROLLBACK');
        await blocker.query('SELECT pg_advisory_unlock(hashtext($1))', [MIGRATION_LOCK]);
        blocker.release();
      }
      assert.equal(
        (await pool.query('SELECT COUNT(*)::integer AS count FROM upgrade_probe')).rows[0].count,
        2,
      );
    } finally {
      await pool.end();
      await setup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await setup.end();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
