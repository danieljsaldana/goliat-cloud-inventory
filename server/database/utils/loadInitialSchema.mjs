import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export async function loadInitialSchema() {
  const path = resolve(process.cwd(), 'server/schema/initial.sql');
  const sql = (await readFile(/* turbopackIgnore: true */ path, 'utf8')).replace(/\r\n/g, '\n');
  return { sql, checksum: createHash('sha256').update(sql).digest('hex'), version: 1 };
}
