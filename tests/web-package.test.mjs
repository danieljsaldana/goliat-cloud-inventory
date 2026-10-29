import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

test('cada ZIP cambia la fecha de una ruta del mismo tamaño para evitar que Kudu reutilice código antiguo', async () => {
  const root = await mkdtemp(join(tmpdir(), 'goliat-package-'));
  const artifact = join(root, 'standalone');
  try {
    for (const file of [
      'server.js',
      '.next/BUILD_ID',
      'public/social/cloud-inventory.png',
      'docs/architecture.html',
      'docs/azure-deployment.html',
      'server/migrations/001_initial.sql',
      'server/schema/initial.sql',
    ]) {
      const path = join(artifact, file);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, 'initial');
    }
    async function pack(name) {
      const output = join(root, `${name}.zip`);
      const result = spawnSync(
        process.execPath,
        [resolve('iac/scripts/package-web.mjs'), artifact, output],
        { encoding: 'utf8' },
      );
      assert.equal(result.status, 0, result.stderr);
      const bytes = await readFile(output);
      const records = [];
      const position = { offset: 0 };
      while (bytes.readUInt32LE(position.offset) === 0x04034b50) {
        const offset = position.offset;
        const nameLength = bytes.readUInt16LE(offset + 26);
        const extra = bytes.readUInt16LE(offset + 28);
        const compressed = bytes.readUInt32LE(offset + 18);
        records.push({
          path: bytes.toString('utf8', offset + 30, offset + 30 + nameLength),
          timestamp: bytes.readUInt32LE(offset + 10),
          size: bytes.readUInt32LE(offset + 22),
          crc: bytes.readUInt32LE(offset + 14),
        });
        position.offset += 30 + nameLength + extra + compressed;
      }
      return records.find(({ path }) => path === 'server.js');
    }
    const before = await pack('before');
    await delay(2200);
    await writeFile(join(artifact, 'server.js'), 'changed');
    const after = await pack('after');
    assert.equal(after.size, before.size);
    assert.notEqual(after.crc, before.crc);
    assert.ok(after.timestamp > before.timestamp);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
