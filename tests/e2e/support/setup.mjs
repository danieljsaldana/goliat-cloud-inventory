import { initializeDatabase } from '../../../server/database/initialize.mjs';
import { seedDatabase } from '../../../server/seed/seedDatabase.mjs';
import { testPool, testSchema } from './database.mjs';

export default async function setup() {
  const schema = testSchema();
  const admin = testPool({ scoped: false });
  const pool = testPool();
  async function clean() {
    try {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await admin.end();
    }
  }
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await initializeDatabase(pool);
    await seedDatabase(pool, { NODE_ENV: 'test' });
  } catch (error) {
    await clean();
    throw error;
  } finally {
    await pool.end();
  }
  return clean;
}
