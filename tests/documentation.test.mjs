import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isPageRoute } from '../src/core/routing/paths.js';
import { architectureDocument } from '../server/architecture/document.mjs';
import { findBrandMark } from '../vendor/archify/renderers/shared/brand-marks.mjs';

test('la vista Arquitectura sirve el diagrama de documentación completo sin caché compartida', async () => {
  const source = JSON.parse(await readFile('docs/architecture.json', 'utf8'));
  const html = await readFile('docs/architecture.html', 'utf8');
  const ids = new Set(source.components.map(({ id }) => id));
  assert.equal(ids.size, source.components.length);
  for (const { from, to } of source.connections) assert.ok(ids.has(from) && ids.has(to));
  assert.match(html, /<html lang="es"/);
  for (const id of ids) assert.ok(html.includes(`data-node-id="${id}"`), id);
  assert.ok(ids.has('cost'), 'La arquitectura incluye FinOps.');
  const providerMark = await readFile('src/components/branding/ProviderMark/index.jsx', 'utf8');
  const providerPath = providerMark.match(/\sd="([^"]+)"/)[1];
  assert.equal(findBrandMark('microsoft-azure').path, providerPath);
  assert.ok(html.includes('data-brand-mark="microsoft-azure"'));
  assert.equal(source.components.find(({ id }) => id === 'azure').icon, 'none');
  assert.ok(
    source.connections.some(({ from, to }) => from === 'cost' && to === 'api'),
    'Cost Management se consulta desde el backend.',
  );
  const right = Math.max(...source.components.map(({ pos, size }) => pos[0] + size[0]));
  const bottom = Math.max(...source.components.map(({ pos, size }) => pos[1] + size[1]));
  assert.ok(right / bottom < 2, 'El diagrama no debe volver al formato excesivamente horizontal.');
  assert.equal(isPageRoute(['architecture']), true);
  const response = await architectureDocument();
  assert.equal(await response.text(), html);
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'self'/);
});

test('Archify conserva la integridad del release fijado y su adaptación Azure', async () => {
  const manifest = JSON.parse(await readFile('vendor/archify/upstream.json', 'utf8'));
  assert.equal(manifest.version, '3.0.1');
  for (const [path, hash] of Object.entries(manifest.files)) {
    const bytes = await readFile(`vendor/archify/${path}`);
    const expected = manifest.localOverrides?.[path]?.sha256 || hash;
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, path);
  }
});

test('el documento del despliegue incluye los recursos y conserva el aislamiento del visor', async () => {
  const source = JSON.parse(await readFile('docs/azure-deployment.json', 'utf8'));
  const html = await readFile('docs/azure-deployment.html', 'utf8');
  const ids = new Set(source.components.map(({ id }) => id));
  assert.equal(ids.size, source.components.length);
  for (const { from, to } of source.connections) assert.ok(ids.has(from) && ids.has(to));
  for (const { wraps } of source.boundaries) for (const id of wraps) assert.ok(ids.has(id));
  for (const id of ids) assert.ok(html.includes(`data-node-id="${id}"`), id);
  for (const name of ['rg-goliat-dev', 'web-plan-goliat-dev', 'plan-goliat-dev', 'North Europe'])
    assert.ok(html.includes(name), name);
  const response = await architectureDocument(undefined, { diagram: 'azure' });
  assert.equal(await response.text(), html);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.match(response.headers.get('content-security-policy'), /connect-src 'none'/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'self'/);
  // La selección nunca se convierte en una ruta de archivos proporcionada por el cliente.
  const unknown = await architectureDocument(undefined, { diagram: '../../.env' });
  assert.equal(await unknown.text(), await readFile('docs/architecture.html', 'utf8'));
});
