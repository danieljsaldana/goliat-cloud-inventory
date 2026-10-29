import test from 'node:test';
import assert from 'node:assert/strict';
import { ciSummary } from '../scripts/ci-summary.mjs';

const jobs = () =>
  Object.fromEntries(
    ['changes', 'quality', 'functions', 'tests', 'site', 'iac', 'codeql'].map((name) => [
      name,
      { result: 'success' },
    ]),
  );

test('full CI summary lists all checks and diagnostic links', () => {
  const input = jobs();
  input.changes.outputs = { full: 'true' };
  const result = ciSummary(input, 'https://github.com/example/project/actions/runs/1');
  assert.equal(result.passed, true);
  assert.match(result.markdown, /full validation/);
  assert.match(result.markdown, /PostgreSQL/);
  assert.match(result.markdown, /actions\/runs\/1/);
});

test('docs-only summary distinguishes omitted suites from successful tests', () => {
  const input = jobs();
  for (const name of ['functions', 'tests', 'site', 'iac', 'codeql'])
    input[name].result = 'skipped';
  input.changes.outputs = { full: 'false', changed_files: '2' };
  const result = ciSummary(input, 'https://example.test/run');
  assert.equal(result.passed, true);
  assert.match(result.markdown, /Changed paths: 2/);
  assert.match(result.markdown, /skipped/);
  assert.match(result.markdown, /not a passed test/);
});

test('failure, cancellation, missing jobs and skipped prerequisites block CI', () => {
  for (const state of ['failure', 'cancelled', 'missing', 'unexpected']) {
    const input = jobs();
    input.tests.result = state;
    assert.equal(ciSummary(input, '').passed, false, state);
  }
  for (const name of ['changes', 'quality']) {
    const input = jobs();
    input[name].result = 'skipped';
    assert.equal(ciSummary(input, '').passed, false, name);
  }
  const input = jobs();
  delete input.functions;
  assert.equal(ciSummary(input, '').passed, false);
  assert.match(ciSummary(input, '').markdown, /missing/);
});
