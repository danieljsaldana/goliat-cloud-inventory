import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import nextTesting from 'next/experimental/testing/server.js';
import nextConfig from '../next.config.mjs';

test('el proxy permite la recarga de Next.js y sigue protegiendo páginas y API de datos', async () => {
  // Next.js exige matchers literales; lee el declarado y comprueba sus rutas con su matcher real.
  const source = await readFile(new URL('../proxy.js', import.meta.url), 'utf8');
  const literal = source.match(/matcher:\s*\[\s*'([^']+)'/);
  assert.ok(literal, 'El proxy declara un matcher estático.');
  const config = { matcher: [literal[1]] };
  for (const url of [
    '/_next/hmr',
    '/_next/webpack-hmr',
    '/_next/static/chunks/login.js',
    '/_next/image?url=%2Fsocial%2Fcloud-inventory.png',
    '/api/health/',
    '/api/ready/',
    '/favicon.ico',
    '/icon.svg?version=1',
    '/apple-icon.png',
    '/social/cloud-inventory.png',
    '/social/cloud-inventory.png?version=2',
  ])
    assert.equal(nextTesting.unstable_doesMiddlewareMatch({ config, nextConfig, url }), false, url);
  for (const url of [
    '/es/inventario/',
    '/api/inventory/azure/',
    '/icon.svg/private',
    '/apple-icon.png-other',
    '/favicon.ico-private',
    '/social/cloud-inventory.png/private',
    '/social/cloud-inventory.png-other',
    '/social/private.png',
  ])
    assert.equal(nextTesting.unstable_doesMiddlewareMatch({ config, nextConfig, url }), true, url);
  assert.ok(nextConfig.allowedDevOrigins.includes('127.0.0.1'));
});
