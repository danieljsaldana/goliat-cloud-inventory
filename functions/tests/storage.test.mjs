import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { storageClient } from '../src/storage/client.mjs';

test('el SDK lee estados pequeños sin exigir 16 KB y rechaza estados excesivos', async () => {
  const state = { operationId: 'test', status: 'queued' };
  const documents = {
    small: Buffer.from(JSON.stringify(state)),
    large: Buffer.alloc(16385, 'x'),
  };
  const server = createServer((request, response) => {
    const id = new URL(request.url, 'http://localhost').pathname
      .split('/')
      .at(-1)
      .replace('.json', '');
    const bytes = documents[id];
    if (!bytes) {
      response.writeHead(404);
      response.end();
      return;
    }
    const range = request.headers['x-ms-range'] || request.headers.range;
    response.writeHead(range ? 206 : 200, {
      'Content-Length': bytes.length,
      ...(range ? { 'Content-Range': `bytes 0-${bytes.length - 1}/${bytes.length}` } : {}),
      ETag: '"test"',
      'x-ms-blob-type': 'BlockBlob',
    });
    response.end(bytes);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const endpoint = `http://127.0.0.1:${server.address().port}/testaccount/`;
    const store = storageClient({
      endpoint,
      queueEndpoint: endpoint,
      container: 'inventory',
      blob: 'latest.json',
    });
    assert.deepEqual(await store.getOperation('small'), state);
    assert.equal(await store.getOperation('missing'), null);
    await assert.rejects(store.getOperation('large'), /Estado de operación excesivo/);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
