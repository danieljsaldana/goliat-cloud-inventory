import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { databaseConfig } from '../server/config.mjs';
import { initializeDatabase } from '../server/database/initialize.mjs';
import { initialSchemaStatus } from '../server/database/initialStatus.mjs';
import { initializeMembers } from '../server/members/initialize.mjs';
import { membersRepository } from '../server/members/repository.mjs';
import { applicationAdministrator } from '../server/access/applicationAdministrator.mjs';

test(
  'PostgreSQL: permisos y auditoría atómicos, conflictos concurrentes y revocación de sesiones',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.match(process.env.DB_NAME, /_test$/);
    const schema = `members_${randomUUID().replaceAll('-', '')}`;
    const setup = new pg.Pool(databaseConfig());
    const pool = new pg.Pool({ ...databaseConfig(), options: `-c search_path=${schema}`, max: 3 });
    const tenantId = randomUUID();
    const initialId = randomUUID();
    const targetId = randomUUID();
    const otherId = randomUUID();
    const env = {
      DASHBOARD_ADMIN_OBJECT_IDS: initialId,
      DASHBOARD_MEMBERS_ENABLED: 'true',
      LOG_ENABLED: 'false',
    };
    const settings = { enabled: true, mode: 'azure-ad', tenantId };
    const initial = { user: {}, authMode: 'azure-ad', identity: { tenantId, objectId: initialId } };
    const target = { ...initial, identity: { tenantId, objectId: targetId } };
    const repository = membersRepository({ pool, env });
    const change = (objectId, role = 'administrator', expectedRole = 'member', session = initial) =>
      repository.update({ session, settings, objectId, role, expectedRole });
    try {
      await setup.query(`CREATE SCHEMA ${schema}`);
      await initializeDatabase(pool);
      const original = (await pool.query('SELECT * FROM inventory_schema')).rows;
      await initializeMembers(pool);
      await initializeMembers(pool);
      assert.deepEqual((await pool.query('SELECT * FROM inventory_schema')).rows, original);
      assert.equal((await initialSchemaStatus(pool)).ready, true);
      assert.equal(await applicationAdministrator(target, settings, env, pool), false);
      const competing = await Promise.allSettled([change(targetId), change(targetId)]);
      assert.equal(competing.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal(
        competing.find((result) => result.status === 'rejected').reason.message,
        'role_conflict',
      );
      assert.equal(await applicationAdministrator(target, settings, env, pool), true);
      assert.equal(
        (await pool.query('SELECT COUNT(*)::integer AS count FROM application_role_audit')).rows[0]
          .count,
        1,
      );
      await assert.rejects(change(initialId, 'member', 'administrator'), /protected_administrator/);
      await assert.rejects(change(targetId, 'member', 'administrator', target), /self_role_change/);
      await assert.rejects(
        change(otherId, 'administrator', 'member', {
          ...target,
          identity: { tenantId: randomUUID(), objectId: targetId },
        }),
        /invalid_member/,
      );
      await change(targetId, 'member', 'administrator');
      assert.equal(
        await applicationAdministrator({ ...target, administrator: true }, settings, env, pool),
        false,
      );
      await assert.rejects(
        change(otherId, 'administrator', 'member', target),
        /administrator_required/,
      );
      const audit = (
        await pool.query(
          'SELECT actor_id, previous_role, new_role FROM application_role_audit ORDER BY id',
        )
      ).rows;
      assert.deepEqual(audit, [
        { actor_id: initialId, previous_role: 'member', new_role: 'administrator' },
        { actor_id: initialId, previous_role: 'administrator', new_role: 'member' },
      ]);
      await pool.query(
        "ALTER TABLE application_role_audit ADD CONSTRAINT fail_audit CHECK (new_role <> 'administrator') NOT VALID",
      );
      await assert.rejects(change(otherId), { code: '23514' });
      assert.deepEqual(
        await repository.administrators(tenantId),
        [],
        'Un fallo de auditoría revierte también el permiso.',
      );
    } finally {
      await pool.end();
      await setup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await setup.end();
    }
  },
);
