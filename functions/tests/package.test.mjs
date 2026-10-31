import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { inflateRawSync } from 'node:zlib';

test('el paquete Functions conserva licencia y autoría y excluye la configuración local', async () => {
  const root = await mkdtemp(join(tmpdir(), 'goliat-function-licence-'));
  try {
    const functions = join(root, 'functions');
    await mkdir(join(functions, 'scripts'), { recursive: true });
    await mkdir(join(functions, 'src'), { recursive: true });
    const notices = {
      LICENSE: 'Fixture licence terms\n',
      NOTICE: 'Required Notice: Fixture Author\n',
    };
    for (const [name, contents] of Object.entries(notices))
      await writeFile(join(root, name), contents);
    for (const name of ['host.json', 'package.json', 'package-lock.json', 'local.settings.json']) {
      await writeFile(join(functions, name), '{}');
    }
    await writeFile(join(functions, '.env'), 'SYNTHETIC_FIXTURE=true\n');
    await writeFile(join(functions, 'src/fixture.mjs'), 'export {};');
    const script = join(functions, 'scripts/package.mjs');
    await copyFile(new URL('../scripts/package.mjs', import.meta.url), script);
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const bytes = await readFile(join(functions, '.azure/function.zip'));
    const entries = new Map();
    const cursor = { offset: 0 };
    while (bytes.readUInt32LE(cursor.offset) === 0x04034b50) {
      const offset = cursor.offset;
      const size = bytes.readUInt32LE(offset + 18);
      const nameSize = bytes.readUInt16LE(offset + 26);
      const extraSize = bytes.readUInt16LE(offset + 28);
      const start = offset + 30 + nameSize + extraSize;
      const name = bytes.toString('utf8', offset + 30, offset + 30 + nameSize);
      entries.set(name, inflateRawSync(bytes.subarray(start, start + size)).toString());
      cursor.offset = start + size;
    }
    for (const [name, contents] of Object.entries(notices))
      assert.equal(entries.get(name), contents);
    assert.ok(entries.has('src/fixture.mjs'));
    assert.equal(entries.has('local.settings.json'), false);
    assert.equal(entries.has('.env'), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
