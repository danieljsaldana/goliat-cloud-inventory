import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import translations from '../vendor/archify/es.json' with { type: 'json' };

const root = resolve(import.meta.dirname, '..');
const execute = promisify(execFile);
const temporary = await mkdtemp(join(tmpdir(), 'inventory-documentation-'));
try {
  for (const name of ['architecture', 'azure-deployment']) {
    const specification = JSON.parse(await readFile(join(root, `docs/${name}.json`), 'utf8'));
    specification.meta.translations = translations;
    await writeFile(join(temporary, `${name}.json`), JSON.stringify(specification));
    await execute(
      process.execPath,
      [
        join(root, 'vendor/archify/renderers/architecture/render-architecture.mjs'),
        `${name}.json`,
        `${name}.html`,
      ],
      {
        cwd: temporary,
        timeout: 30000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
        env: { ...process.env, ARCHIFY_UPDATE_CHECK_DISABLED: '1' },
      },
    );
    const html = (await readFile(join(temporary, `${name}.html`), 'utf8')).replace(/[ \t]+$/gm, '');
    await writeFile(join(root, `docs/${name}.html`), html);
    console.log(`Diagrama de documentación: docs/${name}.html`);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
