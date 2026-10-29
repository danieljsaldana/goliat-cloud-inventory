import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const suites = ['dashboard', 'functions', 'site', 'iac', 'codeql'];

export function classifyChanges(paths, { full = false } = {}) {
  const selected = new Set(full ? suites : []);
  for (const path of paths) {
    if (/\.(md|txt)$/i.test(path) || path === 'LICENSE') continue;
    if (/^\.github\/(ISSUE_TEMPLATE\/|dependabot\.yml$)/.test(path)) continue;
    if (/^site\//.test(path) || path === 'tests/site.browser.mjs') {
      selected.add('site');
      if (/\.(js|mjs|html)$/.test(path)) selected.add('codeql');
      continue;
    }
    if (/^functions\//.test(path)) {
      selected.add('functions');
      selected.add('codeql');
      if (/\.ps1$/.test(path)) selected.add('iac');
      continue;
    }
    if (/^iac\//.test(path) || path === 'goliat.ps1') {
      selected.add('iac');
      if (/\.(js|mjs)$/.test(path)) selected.add('codeql');
      continue;
    }
    if (/^tests\/(iac|project-iac|goliat-commands|web-package)\.test\.mjs$/.test(path)) {
      selected.add('iac');
      selected.add('codeql');
      continue;
    }
    if (
      path === 'tests/function-contract.test.mjs' ||
      path === 'tests/inventory-catalog.test.mjs'
    ) {
      selected.add('functions');
      selected.add('codeql');
      continue;
    }
    if (/^(app|src|server|public|vendor|tests)\//.test(path)) {
      selected.add('dashboard');
      selected.add('codeql');
      if (
        /^(src\/core\/|src\/features\/administration\/|server\/administration\/)/.test(path) ||
        path === 'src/components/branding/ProviderMark/index.jsx' ||
        path === 'server/modules/azure/seed/data/inventory.json' ||
        path === 'public/social/cloud-inventory.png'
      )
        selected.add('site');
      if (
        /^src\/core\/inventory\//.test(path) ||
        /^server\/modules\/azure\/(normalization\/|documentConstants\.mjs$)/.test(path)
      )
        selected.add('functions');
      continue;
    }
    if (/^docs\/(architecture|azure-deployment)\.(html|json)$/.test(path)) {
      selected.add('dashboard');
      selected.add('site');
      if (path.endsWith('.html')) selected.add('codeql');
      continue;
    }
    for (const suite of suites) selected.add(suite);
  }
  return Object.fromEntries(suites.map((suite) => [suite, selected.has(suite)]));
}

export function changedPaths(base, head, { pullRequest = false, cwd = process.cwd() } = {}) {
  if (!/^[a-f0-9]{40}$/.test(base || '') || !/^[a-f0-9]{40}$/.test(head || ''))
    throw new Error('CI diff requires valid base and head commit SHAs.');
  const revisions = pullRequest ? [`${base}...${head}`] : [base, head];
  return execFileSync('git', ['diff', '--name-only', '-z', '--no-renames', ...revisions, '--'], {
    encoding: 'utf8',
    cwd,
  })
    .split('\0')
    .filter(Boolean);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const full =
    process.env.EVENT_NAME === 'workflow_dispatch' || /^0{40}$/.test(process.env.BASE_SHA || '');
  const paths = full
    ? []
    : changedPaths(process.env.BASE_SHA, process.env.HEAD_SHA, {
        pullRequest: process.env.EVENT_NAME === 'pull_request',
      });
  const selected = classifyChanges(paths, { full });
  if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required.');
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(selected)
      .map(([suite, enabled]) => `${suite}=${enabled}\n`)
      .join(''),
  );
  console.log(JSON.stringify({ changedFiles: paths.length, selected }));
}
