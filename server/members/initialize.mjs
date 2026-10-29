import { readFile } from 'node:fs/promises';
import { transaction, getMigrationPool } from '../db.mjs';

export async function initializeMembers(pool = getMigrationPool()) {
  const sql = await readFile(new URL('../schema/members.sql', import.meta.url), 'utf8');
  await transaction(async (connection) => {
    await connection.query("SET LOCAL lock_timeout = '5s'");
    await connection.query("SELECT pg_advisory_xact_lock(hashtext('goliat-members-schema'))");
    await connection.query(sql);
  }, pool);
  return { membersReady: true };
}
