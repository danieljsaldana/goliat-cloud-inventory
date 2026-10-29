import test from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';

const lint = new ESLint();

test('SDK, normalización, persistencia, API e infraestructura conservan sus límites', async () => {
  for (const [filePath, source] of [
    ['server/modules/azure/storage/boundary.mjs', '../repositories/inventory.mjs'],
    ['server/modules/azure/normalization/boundary.mjs', '@azure/storage-blob'],
    ['server/modules/azure/normalization/boundary.mjs', 'node:fs/promises'],
    ['server/modules/azure/repositories/boundary.mjs', '../services/inventory.mjs'],
    ['app/api/inventory/azure/route.js', '../../../../server/modules/azure/storage/source.mjs'],
    ['server/db.mjs', './modules/azure/services/inventory.mjs'],
  ]) {
    const [result] = await lint.lintText(
      `import * as dependency from '${source}'; export { dependency };`,
      { filePath },
    );
    assert.ok(
      result.messages.some(({ ruleId }) => ruleId === 'no-restricted-imports'),
      `${filePath}: ${source}`,
    );
  }
});

test('Azure usa su SDK, contratos y PostgreSQL; la semilla reutiliza sus repositorios', async () => {
  for (const [filePath, source] of [
    ['server/modules/azure/storage/boundary.mjs', '@azure/storage-blob'],
    ['server/modules/azure/normalization/boundary.mjs', '../constants.mjs'],
    ['server/modules/azure/repositories/boundary.mjs', '../../../db.mjs'],
    ['server/seed/writeSeed.mjs', '../modules/azure/repositories/seed.mjs'],
  ]) {
    const [result] = await lint.lintText(
      `import * as dependency from '${source}'; export { dependency };`,
      { filePath },
    );
    assert.equal(result.errorCount, 0, `${filePath}: ${JSON.stringify(result.messages)}`);
  }
});
