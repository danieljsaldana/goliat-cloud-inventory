import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const cwd = fileURLToPath(new URL('../', import.meta.url));

test('GHSA-g3hv-75wg-m249: ESLint glob preprocessing has bounded resource use', () => {
  // Keep a regression in the dependency isolated from the test runner's memory and CPU.
  const output = execFileSync(
    process.execPath,
    [
      '--max-old-space-size=64',
      '--input-type=module',
      '--eval',
      `
        import { createRequire } from 'node:module';
        const require = createRequire(import.meta.url);
        const eslintRequire = createRequire(require.resolve('eslint'));
        const { Minimatch } = eslintRequire('minimatch');
        const matcher = new Minimatch('**/../x/'.repeat(20) + 'target.js', {
          optimizationLevel: 2,
          braceExpandMax: 64,
        });
        process.stdout.write(String(matcher.match('target.js')));
      `,
    ],
    { cwd, encoding: 'utf8', timeout: 5000, maxBuffer: 4096 },
  );
  assert.equal(output, 'false');
});

test('ESLint keeps applying project file globs, rules and ignores with the patched matcher', async () => {
  const eslint = new ESLint({ cwd });
  const filePath = 'src/core/minimatch-security-probe.js';
  const valid = await eslint.lintText('const safe = 1;\nexport { safe };\n', { filePath });
  assert.equal(valid.length, 1);
  assert.equal(valid[0].fatalErrorCount, 0);
  assert.deepEqual(valid[0].messages, []);
  const invalid = await eslint.lintText('var accidental = 1;\n', { filePath });
  assert.ok(invalid[0].messages.some(({ ruleId }) => ruleId === 'no-var'));
  assert.equal(await eslint.isPathIgnored(filePath), false);
  assert.equal(await eslint.isPathIgnored('vendor/minimatch-security-probe.js'), true);
});
