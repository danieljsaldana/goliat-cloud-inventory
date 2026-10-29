import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const paths = (output) => output.split('\0').filter(Boolean);

function git(args, input) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', input });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return paths(result.stdout);
}

test('Git no versiona dependencias, compilaciones, inventarios ni cachés', () => {
  const tracked = git(['ls-files', '-z']);
  assert.ok(tracked.includes('.gitignore'), 'El archivo activo .gitignore debe estar versionado.');
  const generated = tracked.filter(
    (path) =>
      /(^|\/)(node_modules|dist|_site|disk|[^/]*site_disk[^/]*|cloud-inventory|__pycache__|\.local-validation-tools|coverage|playwright-report|test-results)\//.test(
        path,
      ) || /\.py[cod]$/.test(path),
  );
  assert.deepEqual(generated, [], 'Los archivos generados deben publicarse como artefactos.');
  assert.deepEqual(git(['ls-files', '--cached', '--ignored', '--exclude-standard', '-z']), []);
});

test('Git ignora los resultados de futuras instalaciones y ejecuciones', () => {
  const generated = [
    'node_modules/react/index.js',
    'viewer/node_modules/react/index.js',
    'dist/index.html',
    'viewer/dist/index.html',
    '_site/index.html',
    'viewer/_site/index.html',
    'disk/index.html',
    'exports/disk/index.html',
    'site_disk/index.html',
    '_site_disk-preview/index.html',
    'exports/_site_disk-preview/index.html',
    'cloud-inventory/azure-run/meta.json',
    '.local-validation-tools/tool.exe',
    'playwright-report/index.html',
    'test-results/panel/trace.zip',
  ];
  const ignored = git(['check-ignore', '--no-index', '--stdin', '-z'], generated.join('\0') + '\0');
  assert.deepEqual(ignored.sort(), generated.sort());
});
