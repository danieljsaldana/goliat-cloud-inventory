import { readFile } from 'node:fs/promises';
import { localTagConfig } from './localTagConfig.mjs';

export async function localConfig() {
  await localTagConfig();
  try {
    const settings = JSON.parse(
      (await readFile(new URL('../local.settings.json', import.meta.url), 'utf8')).replace(
        /^\uFEFF/,
        '',
      ),
    );
    for (const [key, value] of Object.entries(settings.Values || {}))
      if (process.env[key] === undefined) process.env[key] = String(value);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
