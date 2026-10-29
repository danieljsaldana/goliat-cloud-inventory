import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyChanges, changedPaths } from '../scripts/ci-changes.mjs';

const enabled = (paths, options) =>
  Object.entries(classifyChanges(paths, options))
    .filter(([, value]) => value)
    .map(([name]) => name);

test('documentation and community changes do not run application suites', () => {
  assert.deepEqual(
    enabled([
      'README.md',
      'SECURITY.md',
      'docs/backend.md',
      'functions/README.md',
      '.github/WORKFLOWS.md',
      '.github/ISSUE_TEMPLATE/bug_report.yml',
      '.github/dependabot.yml',
    ]),
    [],
  );
  assert.deepEqual(enabled([]), []);
});

test('isolated site, collector and infrastructure changes select their own suites', () => {
  assert.deepEqual(enabled(['site/index.html']), ['site']);
  assert.deepEqual(enabled(['site/demo.js']), ['site', 'codeql']);
  assert.deepEqual(enabled(['tests/site.browser.mjs']), ['site', 'codeql']);
  assert.deepEqual(enabled(['functions/package-lock.json']), ['functions', 'codeql']);
  assert.deepEqual(enabled(['functions/src/inventory/build.mjs']), ['functions', 'codeql']);
  assert.deepEqual(enabled(['iac/main.bicep']), ['iac']);
  assert.deepEqual(enabled(['functions/deploy.ps1']), ['functions', 'iac', 'codeql']);
  assert.deepEqual(enabled(['tests/project-iac.test.mjs']), ['iac', 'codeql']);
});

test('shared contracts and demo inputs validate every affected consumer', () => {
  assert.deepEqual(enabled(['src/core/inventory/reports.js']), [
    'dashboard',
    'functions',
    'site',
    'codeql',
  ]);
  assert.deepEqual(enabled(['server/administration/schedule.mjs']), [
    'dashboard',
    'site',
    'codeql',
  ]);
  assert.deepEqual(enabled(['docs/architecture.html']), ['dashboard', 'site']);
  assert.deepEqual(enabled(['public/social/cloud-inventory.png']), ['dashboard', 'site', 'codeql']);
  assert.deepEqual(enabled(['app/page.jsx']), ['dashboard', 'codeql']);
});

test('dependency, workflow and unknown changes conservatively run every suite', () => {
  const all = ['dashboard', 'functions', 'site', 'iac', 'codeql'];
  for (const path of [
    'package-lock.json',
    'next.config.mjs',
    '.github/workflows/dashboard-check.yml',
    'scripts/ci-changes.mjs',
    'some-new-config',
  ])
    assert.deepEqual(enabled([path]), all, path);
  assert.deepEqual(enabled([], { full: true }), all);
});

test('multiple changes combine suites and invalid diff SHAs fail explicitly', () => {
  assert.deepEqual(enabled(['site/demo.css', 'iac/main.bicep']), ['site', 'iac']);
  assert.throws(() => changedPaths('', 'HEAD'), /valid base and head/);
  assert.throws(() => changedPaths('--help', 'a'.repeat(40)), /valid base and head/);
});
