import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const checks = {
  changes: 'Change selection',
  quality: 'Formatting / applicable lint',
  functions: 'Collector, contracts and package',
  tests: 'Dashboard, PostgreSQL and browser tests',
  site: 'Product website browser tests',
  iac: 'Bicep and deployment scripts',
  codeql: 'CodeQL',
};

export function ciSummary(jobs, runUrl) {
  const valid = Object.keys(checks).every((name) =>
    ['success', 'skipped'].includes(jobs[name]?.result),
  );
  const passed = valid && jobs.changes.result === 'success' && jobs.quality.result === 'success';
  const selected = jobs.changes.outputs || {};
  const rows = Object.entries(checks).map(([name, label]) => {
    const result = jobs[name]?.result || 'missing';
    const note = result === 'skipped' ? 'Not selected, or blocked by an upstream job' : '';
    return `| ${label} | ${result} | ${note} |`;
  });
  return {
    passed,
    markdown: [
      '# CI summary',
      '',
      `**Result: ${passed ? 'passed' : 'failed or incomplete'}**`,
      '',
      selected.full === 'true'
        ? 'Scope: full validation (manual run or initial push).'
        : `Changed paths: ${/^\d+$/.test(selected.changed_files || '') ? selected.changed_files : 'unavailable'}. Suites are selected from the complete diff.`,
      '',
      '| Check | Result | Notes |',
      '| --- | --- | --- |',
      ...rows,
      '',
      'A skipped suite is not a passed test. Failures and cancellations block the CI gate.',
      '',
      `[Jobs, logs and available diagnostic artifacts](${runUrl})`,
      '',
      'Browser failures upload diagnostics when available (7-day retention).',
      'Pages deployment has its own job and runs only after successful CI on main.',
      '',
    ].join('\n'),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.GITHUB_STEP_SUMMARY) throw new Error('GITHUB_STEP_SUMMARY is required.');
  const jobs = JSON.parse(process.env.RESULTS);
  const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const { passed, markdown } = ciSummary(jobs, runUrl);
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  console.log(markdown);
  if (!passed) process.exitCode = 1;
}
