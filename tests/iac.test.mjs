import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const shell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
const available =
  spawnSync(shell, ['-NoProfile', '-NonInteractive', '-Command', 'exit 0']).status === 0;
const subscriptionId = '11111111-1111-4111-8111-111111111111';

async function readIfPresent(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function invoke(script, mode, args = []) {
  const directory = await mkdtemp(join(tmpdir(), 'goliat-iac-'));
  try {
    for (const file of ['common.ps1', 'deploy.ps1', 'destroy.ps1']) {
      await copyFile(resolve('iac', file), join(directory, file));
    }
    const log = join(directory, 'calls.jsonl');
    const result = spawnSync(
      shell,
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'RemoteSigned',
        '-File',
        join(directory, script),
        '-AzPath',
        resolve('tests/fixtures/iac-cli.ps1'),
        ...args,
      ],
      {
        encoding: 'utf8',
        timeout: 20_000,
        env: {
          ...process.env,
          GOLIAT_IAC_TEST_LOG: log,
          GOLIAT_IAC_TEST_MODE: mode,
        },
      },
    );
    assert.equal(result.error, undefined);
    const calls = (await readIfPresent(log))
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const outputExists = await fileExists(join(directory, '.azure', 'goliat-dev.json'));
    return { ...result, calls, outputExists };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const targeted = ['-SubscriptionId', subscriptionId];
const deletes = ({ calls }) =>
  calls.filter(([command, action]) => command === 'group' && action === 'delete');

test(
  'IaC valida sin Azure y previsualiza sin desplegar ni registrar proveedores',
  { skip: !available },
  async () => {
    const offline = await invoke('deploy.ps1', 'owned', ['-ValidateOnly']);
    assert.equal(offline.status, 0, offline.stderr);
    assert.deepEqual(
      offline.calls.map(([command]) => command),
      ['bicep'],
    );
    assert.equal(offline.outputExists, false);

    const plan = await invoke('deploy.ps1', 'owned', [...targeted, '-Plan']);
    assert.equal(plan.status, 0, plan.stderr);
    assert.ok(plan.calls.some(([a, b, c]) => a === 'deployment' && b === 'sub' && c === 'what-if'));
    assert.ok(!plan.calls.some(([a]) => a === 'provider'));
    assert.equal(plan.outputExists, false);
  },
);

test(
  'IaC rechaza grupos ajenos al crear y al destruir, incluidos IDs o etiquetas incorrectos',
  { skip: !available },
  async () => {
    for (const mode of ['foreign', 'untagged', 'wrong-subscription']) {
      for (const script of ['deploy.ps1', 'destroy.ps1']) {
        const result = await invoke(script, mode, targeted);
        assert.notEqual(result.status, 0, `${script}: ${mode}`);
        assert.equal(deletes(result).length, 0);
        assert.ok(
          !result.calls.some(([command]) => command === 'deployment' || command === 'provider'),
        );
        assert.equal(result.outputExists, false);
      }
    }
  },
);

test(
  'IaC destruye solo el grupo explícito, admite WhatIf y repetir el borrado',
  { skip: !available },
  async () => {
    const preview = await invoke('destroy.ps1', 'owned', [...targeted, '-WhatIf']);
    assert.equal(preview.status, 0, preview.stderr);
    assert.equal(deletes(preview).length, 0);

    const missing = await invoke('destroy.ps1', 'missing', targeted);
    assert.equal(missing.status, 0, missing.stderr);
    assert.equal(deletes(missing).length, 0);

    const destroyed = await invoke('destroy.ps1', 'owned', targeted);
    assert.equal(destroyed.status, 0, destroyed.stderr);
    assert.equal(deletes(destroyed).length, 1);
    const call = deletes(destroyed)[0];
    assert.equal(call[call.indexOf('--subscription') + 1], subscriptionId);
    assert.equal(call[call.indexOf('--name') + 1], 'rg-goliat-dev');
    assert.ok(call.includes('--yes'));
  },
);

test(
  'IaC fija la suscripción en cada operación y no guarda salidas tras un fallo',
  { skip: !available },
  async () => {
    const created = await invoke('deploy.ps1', 'missing', targeted);
    assert.equal(created.status, 0, created.stderr);
    assert.equal(created.outputExists, true);
    for (const call of created.calls.filter(([command]) => command !== 'bicep')) {
      assert.equal(call[call.indexOf('--subscription') + 1], subscriptionId);
    }

    const failed = await invoke('deploy.ps1', 'deployment-failed', targeted);
    assert.notEqual(failed.status, 0);
    assert.equal(failed.outputExists, false);
    assert.ok(!failed.stdout.includes('Infraestructura creada'));

    const invalid = await invoke('deploy.ps1', 'owned', ['-SubscriptionId', 'tenant-id']);
    assert.notEqual(invalid.status, 0);
    assert.ok(invalid.calls.every(([command]) => command === 'bicep'));
  },
);
