import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadLocalEnv } from '../server/load-env.mjs';

const loader = new URL('../server/load-env.mjs', import.meta.url).href;

function runLoader(directory, overrides = {}) {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !['PORT', 'DASHBOARD_AUTH_ENABLED'].includes(name),
    ),
  );
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { loadLocalEnv } from ${JSON.stringify(loader)};
       loadLocalEnv();
       console.log(JSON.stringify({ port: process.env.PORT, auth: process.env.DASHBOARD_AUTH_ENABLED }));`,
    ],
    { cwd: directory, env: { ...inherited, ...overrides }, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('el arranque carga el puerto y la autenticación de .env antes de iniciar Next.js', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dashboard-env-'));
  try {
    await writeFile(join(directory, '.env'), 'PORT=4000\nDASHBOARD_AUTH_ENABLED=true\n');
    assert.deepEqual(runLoader(directory), { port: '4000', auth: 'true' });
    assert.deepEqual(runLoader(directory, { PORT: '4100' }), { port: '4100', auth: 'true' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('el contenedor puede arrancar con variables inyectadas sin un fichero .env', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dashboard-env-'));
  try {
    assert.deepEqual(runLoader(directory, { PORT: '4000', DASHBOARD_AUTH_ENABLED: 'false' }), {
      port: '4000',
      auth: 'false',
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('no oculta errores distintos de un fichero .env ausente', () => {
  assert.throws(() => loadLocalEnv({}), { code: 'ERR_INVALID_ARG_TYPE' });
});
