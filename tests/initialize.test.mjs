import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { databaseConfig } from '../server/config.mjs';
import { initializeDatabase } from '../server/database/initialize.mjs';
import { assertSchemaReady } from '../server/database/status.mjs';

test(
  'PostgreSQL: la inicialización es concurrente, repetible y protege esquemas ajenos',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.match(process.env.DB_NAME, /_test$/);
    const schema = `initial_${randomUUID().replaceAll('-', '')}`;
    const admin = new pg.Pool(databaseConfig());
    const pool = new pg.Pool({ ...databaseConfig(), options: `-c search_path=${schema}`, max: 3 });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await assert.rejects(assertSchemaReady(pool), { code: 'SCHEMA_NOT_READY' });
      await pool.query('CREATE TABLE keep_me (value TEXT)');
      await pool.query('INSERT INTO keep_me VALUES ($1)', ['conservar']);
      await assert.rejects(initializeDatabase(pool), { name: 'MigrationError' });
      assert.deepEqual((await pool.query('SELECT * FROM keep_me')).rows, [{ value: 'conservar' }]);
      assert.equal(
        (await pool.query("SELECT to_regclass('inventory_schema') AS name")).rows[0].name,
        null,
      );
      await pool.query('DROP TABLE keep_me');
      const results = await Promise.all([initializeDatabase(pool), initializeDatabase(pool)]);
      assert.equal(results.filter(({ initialized }) => initialized).length, 1);
      assert.equal((await assertSchemaReady(pool)).ready, true);
      await pool.query("UPDATE inventory_schema SET checksum = repeat('0', 64)");
      await assert.rejects(initializeDatabase(pool), { name: 'MigrationError' });
      await assert.rejects(assertSchemaReady(pool), { code: 'SCHEMA_NOT_READY' });
      assert.equal(
        (await pool.query('SELECT checksum FROM inventory_schema')).rows[0].checksum,
        '0'.repeat(64),
      );
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
