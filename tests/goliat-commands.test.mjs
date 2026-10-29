import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const shell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
const available =
  spawnSync(shell, ['-NoProfile', '-NonInteractive', '-Command', 'exit 0']).status === 0;
const subscriptionId = '11111111-1111-4111-8111-111111111111';
const tenantId = '33333333-3333-4333-8333-333333333333';
const alternativeId = '22222222-2222-4222-8222-222222222222';

// These scripts only record delegation. Destruction uses the real script with a fake CLI.
const recorder = String.raw`
[CmdletBinding()]
param(
    [string] $Name, [string] $SubscriptionId, [string] $AzPath,
    [string] $AuthMode, [string] $TenantId, [string] $Location,
    [string] $WebSku, [string] $ConfigPath, [string] $Action,
    [switch] $Plan, [switch] $ValidateOnly, [switch] $RotateEntraSecret,
    [switch] $GrantReader, [switch] $RunAfterDeploy, [switch] $InfrastructureOnly
)
$parameters = @{}
foreach ($key in $PSBoundParameters.Keys) {
    $value = $PSBoundParameters[$key]
    if ($value -is [Management.Automation.SwitchParameter]) { $value = $value.IsPresent }
    $parameters[$key] = $value
}
@{ script = (Split-Path $PSCommandPath -Leaf); parameters = $parameters; cwd = (Get-Location).Path } |
    ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $env:GOLIAT_COMMAND_TEST_LOG -Encoding UTF8
if ($env:GOLIAT_COMMAND_TEST_FAIL -eq 'true') { throw 'Simulated child failure' }
`;

async function readIfPresent(path) {
  try {
    return (await readFile(path, 'utf8')).replace(/^\uFEFF/, '').trim();
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

async function invoke(
  args,
  {
    envText = `AZURE_SUBSCRIPTION_ID="${subscriptionId}"`,
    mode = 'owned',
    inherited = false,
    fail = false,
  } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), 'goliat commands-'));
  try {
    const project = join(directory, 'project');
    const iac = join(project, 'iac');
    await mkdir(iac, { recursive: true });
    await copyFile(resolve('goliat.ps1'), join(project, 'goliat.ps1'));
    for (const file of ['common.ps1', 'destroy.ps1']) {
      await copyFile(resolve('iac', file), join(iac, file));
    }
    for (const file of [
      'init-project.ps1',
      'package-web.ps1',
      'deploy-project.ps1',
      'power-project.ps1',
    ]) {
      await writeFile(join(iac, file), recorder);
    }
    if (envText !== null) await writeFile(join(iac, '.env'), envText);
    await copyFile(resolve('tests/fixtures/iac-cli.ps1'), join(directory, 'fake-cli.ps1'));
    const launcher = join(directory, 'inherited.ps1');
    await writeFile(
      launcher,
      String.raw`param([string] $AzPath)
$WhatIfPreference = $true
& (Join-Path $PSScriptRoot 'project/goliat.ps1') destroy -AzPath $AzPath
`,
    );
    const callLog = join(directory, 'delegated.json');
    const cliLog = join(directory, 'cli.jsonl');
    const result = spawnSync(
      shell,
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'RemoteSigned',
        '-File',
        inherited ? launcher : join(project, 'goliat.ps1'),
        ...args,
      ],
      {
        cwd: directory,
        encoding: 'utf8',
        timeout: 20_000,
        env: {
          ...process.env,
          GOLIAT_COMMAND_TEST_LOG: callLog,
          GOLIAT_COMMAND_TEST_FAIL: String(fail),
          GOLIAT_IAC_TEST_LOG: cliLog,
          GOLIAT_IAC_TEST_MODE: mode,
        },
      },
    );
    assert.equal(result.error, undefined);
    const delegated = await readIfPresent(callLog);
    const calls = (await readIfPresent(cliLog))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    return {
      ...result,
      delegated: delegated ? JSON.parse(delegated) : null,
      calls,
      directory,
      project,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('Goliat help works without configuration, CLI or login', { skip: !available }, async () => {
  for (const args of [[], ['help']]) {
    const result = await invoke(args, { envText: null });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /destroy-plan/);
    assert.equal(result.delegated, null);
    assert.deepEqual(result.calls, []);
  }
});

test(
  'Goliat delegates local commands without a subscription or cloud calls',
  { skip: !available },
  async () => {
    for (const [command, script] of [
      ['init', 'init-project.ps1'],
      ['validate', 'deploy-project.ps1'],
      ['build', 'package-web.ps1'],
    ]) {
      const result = await invoke([command], { envText: null });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.delegated.script, script);
      assert.equal(result.delegated.parameters.Name, 'goliat-dev');
      assert.equal('SubscriptionId' in result.delegated.parameters, false);
      if (command === 'validate') assert.equal(result.delegated.parameters.ValidateOnly, true);
      assert.deepEqual(result.calls, []);
    }
  },
);

test(
  'Goliat reads the project env and preserves authentication when omitted',
  { skip: !available },
  async () => {
    for (const command of ['plan', 'deploy', 'start', 'stop']) {
      const result = await invoke([command], {
        envText: `# Configuration\n AZURE_SUBSCRIPTION_ID = '${subscriptionId}'\n`,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.delegated.parameters.SubscriptionId, subscriptionId);
      assert.equal(result.delegated.cwd, result.project);
      assert.equal('AuthMode' in result.delegated.parameters, false);
      if (command === 'plan') assert.equal(result.delegated.parameters.Plan, true);
      if (command === 'start') assert.equal(result.delegated.parameters.Action, 'Start');
      if (command === 'stop') assert.equal(result.delegated.parameters.Action, 'Stop');
    }
  },
);

test(
  'Goliat forwards explicit deployment options and resolves caller-relative paths',
  { skip: !available },
  async () => {
    const result = await invoke(
      [
        'deploy',
        '-Name',
        'goliat-test',
        '-SubscriptionId',
        alternativeId,
        '-AuthMode',
        'tenant',
        '-TenantId',
        tenantId,
        '-Location',
        'northeurope',
        '-WebSku',
        'B1',
        '-ConfigPath',
        './custom.json',
        '-AzPath',
        './fake-cli.ps1',
        '-GrantReader',
        '-RunAfterDeploy',
        '-RotateEntraSecret',
        '-InfrastructureOnly',
      ],
      { envText: 'invalid file that must be ignored with an explicit subscription' },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.delegated.parameters, {
      Name: 'goliat-test',
      SubscriptionId: alternativeId,
      AuthMode: 'tenant',
      TenantId: tenantId,
      Location: 'northeurope',
      WebSku: 'B1',
      ConfigPath: join(result.directory, 'custom.json'),
      AzPath: join(result.directory, 'fake-cli.ps1'),
      GrantReader: true,
      RunAfterDeploy: true,
      RotateEntraSecret: true,
      InfrastructureOnly: true,
    });
    const demo = await invoke(['init', '-AuthMode', 'demo']);
    assert.equal(demo.status, 0, demo.stderr);
    assert.equal(demo.delegated.parameters.AuthMode, 'demo');
  },
);

test(
  'Goliat fails before delegation for invalid commands, flags or subscription configuration',
  { skip: !available },
  async () => {
    for (const args of [
      ['unknown'],
      ['destroy', '-AuthMode', 'tenant'],
      ['stop', '-GrantReader'],
      ['plan', '-RunAfterDeploy'],
      ['build', '-SubscriptionId', subscriptionId],
      ['deploy', '-SubscriptionId', 'not-a-subscription'],
    ]) {
      const result = await invoke(args);
      assert.notEqual(result.status, 0);
      assert.equal(result.delegated, null);
      assert.deepEqual(result.calls, []);
    }
    for (const envText of [
      null,
      '',
      `AZURE_SUBSCRIPTION_ID=${subscriptionId}\nAZURE_SUBSCRIPTION_ID=${alternativeId}`,
    ]) {
      const result = await invoke(['deploy'], { envText });
      assert.notEqual(result.status, 0);
      assert.equal(result.delegated, null);
      assert.deepEqual(result.calls, []);
    }
  },
);

test(
  'Goliat WhatIf skips scripts that could modify local files or Azure',
  { skip: !available },
  async () => {
    for (const command of ['init', 'build', 'deploy', 'start', 'stop']) {
      const result = await invoke([command, '-WhatIf']);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.delegated, null);
      assert.deepEqual(result.calls, []);
    }
  },
);

test(
  'Goliat destruction previews check ownership but never delete, including inherited WhatIf',
  { skip: !available },
  async () => {
    for (const [args, options] of [
      [['destroy-plan', '-AzPath', './fake-cli.ps1'], {}],
      [['destroy', '-WhatIf', '-AzPath', './fake-cli.ps1'], {}],
      [['-AzPath', './fake-cli.ps1'], { inherited: true }],
    ]) {
      const result = await invoke(args, options);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(result.calls.some(([a, b]) => a === 'group' && b === 'show'));
      assert.ok(
        result.calls.every(
          ([a, b]) => a === 'account' || (a === 'group' && ['exists', 'show'].includes(b)),
        ),
      );
      assert.equal(result.delegated, null);
    }
  },
);

test(
  'Goliat destroy retains ownership checks and targets only the project group',
  { skip: !available },
  async () => {
    const args = ['destroy', '-AzPath', './fake-cli.ps1'];
    for (const mode of ['foreign', 'missing', 'owned']) {
      const result = await invoke(args, { mode });
      assert.equal(result.status === 0, mode !== 'foreign', result.stderr);
      const deletes = result.calls.filter(([a, b]) => a === 'group' && b === 'delete');
      assert.equal(deletes.length, mode === 'owned' ? 1 : 0);
      for (const call of result.calls) {
        assert.equal(call[call.indexOf('--subscription') + 1], subscriptionId);
        if (call[0] === 'group') assert.equal(call[call.indexOf('--name') + 1], 'rg-goliat-dev');
      }
    }
  },
);

test(
  'Goliat propagates a delegated failure to the calling shell',
  { skip: !available },
  async () => {
    const result = await invoke(['deploy'], { fail: true });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Simulated child failure/);
  },
);
