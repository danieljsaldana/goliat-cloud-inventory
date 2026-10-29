import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const shell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
const available =
  spawnSync(shell, ['-NoProfile', '-NonInteractive', '-Command', 'exit 0']).status === 0;
const subscription = '11111111-1111-4111-8111-111111111111';

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function invoke(mode, parameters = [], configure, script = 'deploy-project.ps1', repeat = 1) {
  const root = await mkdtemp(join(tmpdir(), 'goliat-project-test-'));
  const iac = join(root, 'iac');
  try {
    await mkdir(iac);
    await mkdir(join(root, 'functions'));
    for (const file of [
      'common.ps1',
      'project-config.ps1',
      'entra.ps1',
      'deploy-project.ps1',
      'init-project.ps1',
      'power-project.ps1',
      'project.example.json',
    ])
      await copyFile(resolve('iac', file), join(iac, file));
    await writeFile(
      join(iac, 'configure-refresh.ps1'),
      `param([string] $SubscriptionId, [string] $Name, [string] $ConfigPath, [string] $AzPath)\nSet-Content -LiteralPath (Join-Path $PSScriptRoot 'refresh-configured.txt') -Value $SubscriptionId\n`,
      'utf8',
    );
    await writeFile(
      join(iac, 'configure-administration.ps1'),
      `param([string] $SubscriptionId, [string] $Name, [string] $ConfigPath, [string] $AzPath)\nSet-Content -LiteralPath (Join-Path $PSScriptRoot 'administration-configured.txt') -Value $SubscriptionId\n`,
      'utf8',
    );
    await writeFile(
      join(iac, 'package-web.ps1'),
      `param([string] $Name)
if ($env:GOLIAT_IAC_TEST_MODE -eq 'build-failed') { throw 'Error de compilación simulado.' }
New-Item -ItemType Directory -Path (Join-Path $PSScriptRoot '.azure') -Force | Out-Null
Set-Content -LiteralPath (Join-Path $PSScriptRoot ".azure/$Name.web.zip") -Value 'test-artifact'
`,
      'utf8',
    );
    await writeFile(
      join(iac, 'initialize-project.ps1'),
      `param([string] $SubscriptionId, [string] $Name, [string] $ConfigPath, [string] $AzPath)
if ($env:GOLIAT_IAC_TEST_MODE -eq 'init-failed') { throw 'Error de inicialización simulado.' }
Set-Content -LiteralPath (Join-Path $PSScriptRoot 'database-initialized.txt') -Value $SubscriptionId
`,
      'utf8',
    );
    await writeFile(
      join(root, 'functions/deploy.ps1'),
      `param([string] $SubscriptionId, [string] $Name, [string] $AzPath, [switch] $CodeOnly, [switch] $GrantReader, [switch] $RunAfterDeploy)
if (-not $CodeOnly) { throw 'Debe preservar settings de la infraestructura.' }
Set-Content -LiteralPath (Join-Path $PSScriptRoot 'published.txt') -Value $SubscriptionId
`,
      'utf8',
    );
    if (configure) await configure(iac);
    const log = join(root, 'calls.jsonl');
    const run = () =>
      spawnSync(
        shell,
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'RemoteSigned',
          '-File',
          join(iac, script),
          ...(script === 'init-project.ps1'
            ? []
            : ['-AzPath', resolve('tests/fixtures/iac-cli.ps1')]),
          ...parameters,
        ],
        {
          encoding: 'utf8',
          timeout: 20000,
          env: { ...process.env, GOLIAT_IAC_TEST_LOG: log, GOLIAT_IAC_TEST_MODE: mode },
        },
      );
    const first = run();
    assert.equal(first.error, undefined);
    const result = repeat > 1 && first.status === 0 ? run() : first;
    assert.equal(result.error, undefined);
    const calls = ((await exists(log)) ? await readFile(log, 'utf8') : '')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const secretsPath = join(iac, '.azure/goliat-dev.project.local.json');
    const settings = (await exists(secretsPath))
      ? JSON.parse(await readFile(secretsPath, 'utf8'))
      : undefined;
    const published = await exists(join(root, 'functions/published.txt'));
    const outputsPath = join(iac, '.azure/goliat-dev.json');
    const outputs = (await exists(outputsPath))
      ? (await readFile(outputsPath, 'utf8')).replace(/^\uFEFF/, '')
      : '';
    for (const call of calls.filter((args) => args.includes('--parameters'))) {
      assert.equal(
        await exists(call[call.indexOf('--parameters') + 1].slice(1)),
        false,
        'Debe borrar el fichero temporal con secretos.',
      );
    }
    const initialized = await exists(join(iac, 'database-initialized.txt'));
    const deployedPath = `${log}.parameters.json`;
    const deployed = (await exists(deployedPath))
      ? JSON.parse((await readFile(deployedPath, 'utf8')).replace(/^\uFEFF/, ''))
      : undefined;
    const entraPath = `${log}.entra.json`;
    const application = (await exists(entraPath))
      ? JSON.parse((await readFile(entraPath, 'utf8')).replace(/^\uFEFF/, ''))
      : undefined;
    for (const call of calls.filter((args) => args.includes('--body'))) {
      assert.equal(await exists(call[call.indexOf('--body') + 1].slice(1)), false);
    }
    return { ...result, calls, settings, published, outputs, initialized, deployed, application };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const target = ['-SubscriptionId', subscription];
const tenant = '33333333-3333-4333-8333-333333333333';
const clientId = '77777777-7777-4777-8777-777777777777';
const directoryCalls = ({ calls }) => calls.filter(([command]) => ['ad', 'rest'].includes(command));

async function configuredAuthentication(iac, authentication = {}) {
  const settings = JSON.parse(await readFile('iac/project.example.json', 'utf8'));
  settings.database.password = 'synthetic-database-password-with-32-bytes';
  Object.assign(settings.authentication, {
    password: 'synthetic-demo-password',
    secret: 'synthetic-session-secret-with-at-least-32-bytes',
    ...authentication,
  });
  await mkdir(join(iac, '.azure'));
  await writeFile(join(iac, '.azure/goliat-dev.project.local.json'), JSON.stringify(settings));
}

test(
  'el puerto JSON admite enteros válidos en PowerShell 5 y 7 y rechaza otros tipos o límites',
  { skip: !available },
  async () => {
    for (const port of [1, 5432, 65535, 0, 65536, 5432.5, '5432', null, true]) {
      const result = await invoke(
        'owned',
        ['-AuthMode', 'demo'],
        async (iac) => {
          await configuredAuthentication(iac);
          const path = join(iac, '.azure/goliat-dev.project.local.json');
          const settings = JSON.parse(await readFile(path, 'utf8'));
          Object.assign(settings.database, {
            create: false,
            host: 'postgres.example.invalid',
            port,
          });
          await writeFile(path, JSON.stringify(settings));
        },
        'init-project.ps1',
      );
      const valid =
        typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535;
      if (valid) {
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.settings.database.port, port);
      } else {
        assert.notEqual(result.status, 0, String(port));
        assert.match(result.stderr, /Configuración de PostgreSQL inválida/);
      }
      assert.deepEqual(result.calls, [], 'La validación no debe consultar Azure.');
      assert.equal(result.published, false);
    }
  },
);

test(
  'guarda la elección demo o tenant antes de desplegar sin acceder a Azure',
  { skip: !available },
  async () => {
    const prepared = await invoke(
      'owned',
      ['-AuthMode', 'tenant', '-TenantId', tenant],
      undefined,
      'init-project.ps1',
    );
    assert.equal(prepared.status, 0, prepared.stderr);
    assert.equal(prepared.settings.authentication.mode, 'azure-ad');
    assert.equal(prepared.settings.authentication.tenantId, tenant);
    assert.equal(prepared.calls.length, 0);
    const existing = await invoke(
      'owned',
      ['-AuthMode', 'demo'],
      (iac) =>
        configuredAuthentication(iac, {
          mode: 'azure-ad',
          tenantId: tenant,
          clientId,
          clientSecret: 'synthetic-manual-client-secret',
        }),
      'init-project.ps1',
      2,
    );
    assert.equal(existing.status, 0, existing.stderr);
    assert.equal(existing.settings.authentication.mode, 'demo');
    assert.equal(existing.settings.authentication.password, 'synthetic-demo-password');
    assert.equal(
      existing.settings.authentication.secret,
      'synthetic-session-secret-with-at-least-32-bytes',
    );
    assert.equal(existing.settings.authentication.clientSecret, 'synthetic-manual-client-secret');
    assert.equal(existing.calls.length, 0);
  },
);

test(
  'elige demo sobre una configuración tenant sin consultar Entra',
  { skip: !available },
  async () => {
    const result = await invoke(
      'owned',
      [...target, '-AuthMode', 'demo', '-InfrastructureOnly'],
      (iac) => configuredAuthentication(iac, { mode: 'azure-ad', clientId, tenantId: tenant }),
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.settings.authentication.mode, 'demo');
    assert.equal(result.deployed.authentication.mode, 'demo');
    assert.equal(directoryCalls(result).length, 0);
    assert.equal(result.published, false);
  },
);

test(
  'previsualizar tenant no crea aplicaciones ni cambia la elección guardada',
  { skip: !available },
  async () => {
    const result = await invoke('owned', [...target, '-AuthMode', 'tenant', '-Plan']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.settings.authentication.mode, 'demo');
    assert.equal(result.deployed.authentication.mode, 'azure-ad');
    assert.equal(directoryCalls(result).length, 0);
    assert.equal(result.published, false);
    const validation = await invoke('owned', [...target, '-AuthMode', 'tenant', '-ValidateOnly']);
    assert.equal(validation.status, 0, validation.stderr);
    assert.deepEqual(
      validation.calls.map(([command]) => command),
      ['bicep'],
    );
  },
);

test(
  'crea Entra y reutiliza aplicación, secreto y callback al repetir el despliegue',
  { skip: !available },
  async () => {
    const result = await invoke(
      'owned',
      [...target, '-AuthMode', 'tenant'],
      undefined,
      undefined,
      2,
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.published, true);
    assert.equal(result.settings.authentication.mode, 'azure-ad');
    assert.equal(result.settings.authentication.tenantId, tenant);
    assert.equal(result.settings.authentication.clientId, clientId);
    assert.equal(result.settings.authentication.clientSecret, 'synthetic-client-secret-for-test');
    assert.ok(new Date(result.settings.authentication.clientSecretExpiresAt) > new Date());
    assert.equal(
      result.deployed.authentication.clientSecret,
      result.settings.authentication.clientSecret,
    );
    const commands = directoryCalls(result);
    assert.equal(commands.filter((call) => call[0] === 'rest' && call.includes('POST')).length, 1);
    assert.equal(commands.filter((call) => call.includes('reset')).length, 1);
    assert.equal(
      commands.filter(([a, b, c]) => a === 'ad' && b === 'sp' && c === 'create').length,
      1,
    );
    assert.equal(commands.filter((call) => call.includes('update')).length, 1);
    assert.ok(commands.find((call) => call.includes('reset')).includes('--append'));
    assert.equal(result.application.signInAudience, 'AzureADMyOrg');
    assert.deepEqual(result.application.web.redirectUris, [
      'https://web-test.azurewebsites.net/api/auth/callback/microsoft-entra-id',
    ]);
    assert.equal(
      result.application.requiredResourceAccess[0].resourceAccess[0].id,
      'e1fe6dd8-ba31-4d61-89e7-88639da4683d',
    );
    for (const value of [
      result.settings.authentication.clientSecret,
      result.settings.authentication.secret,
      result.settings.authentication.password,
    ]) {
      assert.ok(
        !result.stdout.includes(value) &&
          !result.stderr.includes(value) &&
          !result.outputs.includes(value),
      );
      assert.ok(!JSON.stringify(result.calls).includes(value));
    }
  },
);

test(
  'reutiliza un registro propio sin ID local y conserva los callbacks existentes',
  { skip: !available },
  async () => {
    const result = await invoke('entra-existing', [
      ...target,
      '-AuthMode',
      'tenant',
      '-InfrastructureOnly',
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.settings.authentication.clientId, clientId);
    assert.ok(!directoryCalls(result).some((call) => call.includes('POST')));
    assert.deepEqual(result.application.web.redirectUris, [
      'http://localhost:4000/api/auth/callback/microsoft-entra-id',
      'https://web-test.azurewebsites.net/api/auth/callback/microsoft-entra-id',
    ]);
    assert.equal(result.application.requiredResourceAccess.length, 2);
    assert.deepEqual(result.application.requiredResourceAccess[0].resourceAccess, [
      { id: '88888888-8888-4888-8888-888888888888', type: 'Scope' },
      { id: 'e1fe6dd8-ba31-4d61-89e7-88639da4683d', type: 'Scope' },
    ]);
    assert.equal(
      result.application.requiredResourceAccess[1].resourceAppId,
      '99999999-9999-4999-8999-999999999999',
    );
  },
);

test(
  'conserva la selección tenant y el secreto manual cuando no se indican opciones',
  { skip: !available },
  async () => {
    const result = await invoke('entra-existing', [...target, '-InfrastructureOnly'], (iac) =>
      configuredAuthentication(iac, {
        mode: 'azure-ad',
        tenantId: tenant,
        clientId,
        clientSecret: 'synthetic-manual-client-secret',
      }),
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.settings.authentication.clientSecret, 'synthetic-manual-client-secret');
    assert.ok(
      !directoryCalls(result).some((call) => call.includes('reset') || call.includes('POST')),
    );
  },
);

test(
  'detiene tenant ante errores de permisos o identidad sin recurrir a demo',
  { skip: !available },
  async () => {
    for (const mode of [
      'entra-denied',
      'entra-wrong-tenant',
      'entra-foreign',
      'entra-duplicate',
      'entra-multitenant',
      'entra-secret-failed',
    ]) {
      const result = await invoke(mode, [...target, '-AuthMode', 'tenant', '-InfrastructureOnly']);
      assert.notEqual(result.status, 0, mode);
      assert.equal(result.published, false);
      assert.ok(
        !result.calls.some(([command]) => command === 'deployment' || command === 'provider'),
        mode,
      );
      if (mode === 'entra-wrong-tenant') assert.equal(directoryCalls(result).length, 0);
      if (mode === 'entra-secret-failed') {
        assert.equal(result.settings.authentication.mode, 'azure-ad');
        assert.equal(result.settings.authentication.clientId, clientId);
        assert.equal(result.settings.authentication.clientSecret, '');
      }
    }
    const callbackFailure = await invoke('entra-callback-failed', [
      ...target,
      '-AuthMode',
      'tenant',
    ]);
    assert.notEqual(callbackFailure.status, 0);
    assert.equal(callbackFailure.settings.authentication.mode, 'azure-ad');
    assert.equal(callbackFailure.published, false);
    assert.ok(!callbackFailure.calls.some(([command]) => command === 'webapp'));
    const failedBuild = await invoke('build-failed', [...target, '-AuthMode', 'tenant']);
    assert.notEqual(failedBuild.status, 0);
    assert.equal(directoryCalls(failedBuild).length, 0);
  },
);

test(
  'renueva secretos próximos a caducar y permite una rotación explícita conservando los anteriores',
  { skip: !available },
  async () => {
    for (const [expiry, options] of [
      [new Date(Date.now() - 60_000).toISOString(), []],
      [new Date(Date.now() + 3 * 86400_000).toISOString(), []],
      [new Date(Date.now() + 180 * 86400_000).toISOString(), ['-RotateEntraSecret']],
    ]) {
      const result = await invoke(
        'entra-existing',
        [...target, '-InfrastructureOnly', ...options],
        (iac) =>
          configuredAuthentication(iac, {
            mode: 'azure-ad',
            tenantId: tenant,
            clientId,
            clientSecret: 'old-synthetic-client-secret',
            clientSecretExpiresAt: expiry,
          }),
      );
      assert.equal(result.status, 0, result.stderr);
      const rotations = directoryCalls(result).filter((call) => call.includes('reset'));
      assert.equal(rotations.length, 1);
      assert.ok(rotations[0].includes('--append'));
      assert.equal(result.settings.authentication.clientSecret, 'synthetic-client-secret-for-test');
    }
  },
);

test(
  'valida opciones de tenant y rechaza cambiar el directorio de una aplicación configurada',
  { skip: !available },
  async () => {
    for (const [options, authentication] of [
      [['-AuthMode', 'demo', '-TenantId', tenant], {}],
      [['-RotateEntraSecret'], {}],
      [
        ['-AuthMode', 'tenant', '-TenantId', '44444444-4444-4444-8444-444444444444'],
        { mode: 'azure-ad', tenantId: tenant, clientId, clientSecret: 'synthetic-client-secret' },
      ],
    ]) {
      const result = await invoke('owned', [...target, ...options], (iac) =>
        configuredAuthentication(iac, authentication),
      );
      assert.notEqual(result.status, 0);
      assert.equal(directoryCalls(result).length, 0);
      assert.ok(
        !result.calls.some(([command]) => command === 'deployment' || command === 'provider'),
      );
    }
  },
);

test(
  'el proyecto valida sin login y previsualiza sin Docker ni recursos de pago',
  { skip: !available },
  async () => {
    const validation = await invoke('owned', ['-ValidateOnly']);
    assert.equal(validation.status, 0, validation.stderr);
    assert.deepEqual(
      validation.calls.map(([command]) => command),
      ['bicep'],
    );
    assert.equal(validation.settings, undefined);
    const plan = await invoke('owned', [...target, '-Plan']);
    assert.equal(plan.status, 0, plan.stderr);
    const whatIf = plan.calls.find(
      ([a, b, c]) => a === 'deployment' && b === 'sub' && c === 'what-if',
    );
    assert.ok(whatIf.includes('ResourceIdOnly'));
    assert.ok(!plan.calls.some(([command]) => command === 'provider' || command === 'webapp'));
    assert.equal(plan.published, false);
    assert.equal(plan.outputs, '');
    for (const value of [
      plan.settings.database.password,
      plan.settings.authentication.password,
      plan.settings.authentication.secret,
    ]) {
      assert.ok(value.length >= 32);
      assert.ok(!plan.stdout.includes(value) && !plan.stderr.includes(value));
    }
    const localEnvironment = await invoke('owned', ['-Plan'], async (iac) => {
      await writeFile(join(iac, '.env'), `AZURE_SUBSCRIPTION_ID=${subscription}\n`);
    });
    assert.equal(localEnvironment.status, 0, localEnvironment.stderr);
    for (const call of localEnvironment.calls.filter(([command]) => command !== 'bicep'))
      assert.equal(call[call.indexOf('--subscription') + 1], subscription);
  },
);

test(
  'rechaza grupos ajenos y errores de compilación antes de crear recursos del proyecto',
  { skip: !available },
  async () => {
    for (const mode of ['foreign', 'untagged', 'wrong-subscription', 'build-failed']) {
      const result = await invoke(mode, target);
      assert.notEqual(result.status, 0, mode);
      assert.ok(
        !result.calls.some(
          ([command]) => command === 'deployment' || command === 'provider' || command === 'webapp',
        ),
      );
      assert.equal(result.published, false);
      assert.equal(result.outputs, '');
    }
  },
);

test(
  'crea el proyecto, publica el ZIP y la Function sin exportar secretos ni cambiar de suscripción',
  { skip: !available },
  async () => {
    const result = await invoke('missing', [...target, '-GrantReader', '-RunAfterDeploy']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.published, true);
    assert.equal(result.initialized, true);
    assert.equal(JSON.parse(result.outputs).webAppName, 'web-goliat-dev-abcdefghijklm');
    for (const call of result.calls.filter(([command]) => command !== 'bicep'))
      assert.equal(call[call.indexOf('--subscription') + 1], subscription);
    assert.ok(
      result.calls.some(([command, action]) => command === 'webapp' && action === 'deploy'),
    );
    for (const value of [
      result.settings.database.password,
      result.settings.authentication.password,
      result.settings.authentication.secret,
    ])
      assert.ok(
        !result.outputs.includes(value) &&
          !result.stdout.includes(value) &&
          !result.stderr.includes(value),
      );
    const failure = await invoke('deployment-failed', target);
    assert.notEqual(failure.status, 0);
    assert.equal(failure.published, false);
    assert.equal(failure.outputs, '');
    const initializationFailure = await invoke('init-failed', target);
    assert.notEqual(initializationFailure.status, 0);
    assert.equal(initializationFailure.published, false);
    assert.ok(!initializationFailure.calls.some(([command]) => command === 'webapp'));
  },
);

test(
  'detener e iniciar respeta el grupo y evita repetir cambios de estado de PostgreSQL',
  { skip: !available },
  async () => {
    const configure = async (iac) => {
      await mkdir(join(iac, '.azure'));
      await writeFile(
        join(iac, '.azure/goliat-dev.project.json'),
        JSON.stringify({
          subscriptionId: subscription,
          resourceGroupName: 'rg-goliat-dev',
          webAppName: 'web-goliat-dev-abcdefghijklm',
          functionAppName: 'func-goliat-dev-abcdefghijklm',
          postgresServerName: 'pg-goliat-dev-abcdefghijklm',
          webUrl: 'https://web-test.azurewebsites.net',
        }),
      );
    };
    for (const [mode, action, expected] of [
      ['owned', 'Stop', 'stop'],
      ['stopped', 'Start', 'start'],
      ['stopped', 'Stop', undefined],
    ]) {
      const result = await invoke(
        mode,
        [...target, '-Action', action],
        configure,
        'power-project.ps1',
      );
      assert.equal(result.status, 0, result.stderr);
      const commands = result.calls.filter(
        ([command, , operation]) => command === 'postgres' && operation !== 'show',
      );
      assert.deepEqual(
        commands.map((call) => call[2]),
        expected ? [expected] : [],
      );
    }
  },
);
