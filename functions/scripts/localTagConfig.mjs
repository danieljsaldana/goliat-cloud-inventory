import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

export async function localTagConfig({
  env = process.env,
  path = new URL('../../.env', import.meta.url),
} = {}) {
  if (env.INVENTORY_TAG_KEYS !== undefined) return;
  try {
    const values = parseEnv(await readFile(path, 'utf8'));
    if (values.INVENTORY_TAG_KEYS !== undefined) env.INVENTORY_TAG_KEYS = values.INVENTORY_TAG_KEYS;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
