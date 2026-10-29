import { REPORTS } from '../src/core/inventory/reports.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { azureDocument } from './fixtures/azure-document.mjs';
import { readAzureSnapshot } from '../server/modules/azure/storage/source.mjs';
import { parseAzureDocument } from '../server/modules/azure/normalization/parseDocument.mjs';
import { collectAzure } from '../server/modules/azure/services/collectAzure.mjs';
import { azureStorageClient } from '../server/modules/azure/storage/storageClient.mjs';

const env = { AZURE_STORAGE_CONTAINER: 'inventory' };

test('el backend descarga el JSON de Blob Storage con ETag y publica todas las vistas con la fecha de origen', async () => {
  const document = azureDocument();
  const bytes = Buffer.from(JSON.stringify(document));
  const saved = [];
  const client = {
    url: 'https://demo.blob.core.windows.net',
    getContainerClient(container) {
      assert.equal(container, 'inventory');
      return {
        getBlobClient(blob) {
          assert.equal(blob, 'azure/latest.json');
          return {
            async getProperties() {
              return { etag: 'etag-v1', contentLength: bytes.length };
            },
            async download(offset, count, options) {
              assert.equal(offset, 0);
              assert.equal(count, undefined);
              assert.deepEqual(options.conditions, { ifMatch: 'etag-v1' });
              return {
                readableStreamBody: Readable.from([bytes.subarray(0, 50), bytes.subarray(50)]),
              };
            },
          };
        },
      };
    },
  };
  await collectAzure({ env, client, save: async (...args) => saved.push(args) });
  const [files, metadata] = saved[0];
  assert.equal(Object.keys(files).length, REPORTS.length);
  assert.equal(files['resources'].rows[0][4], 'false');
  assert.equal(files['resources'].rows[0][5], '0');
  assert.equal(metadata.generatedAt, document.generatedAt);
  assert.equal(metadata.source, 'azure-storage');
  assert.deepEqual(metadata.storage, {
    accountUrl: client.url,
    container: 'inventory',
    blob: 'azure/latest.json',
    etag: 'etag-v1',
    schemaVersion: 2,
  });
});

test('contratos incompletos, versiones desconocidas y documentos excesivos se rechazan antes de guardar', async () => {
  const document = azureDocument();
  for (const bad of [
    { ...document, schemaVersion: 1 },
    { ...document, provider: 'unsupported' },
    { ...document, generatedAt: 'invalid' },
    { ...document, generatedAt: '2026-02-30T05:00:00.000Z' },
    { ...document, snapshot: { ...document.snapshot, reports: [] } },
    {
      ...document,
      snapshot: {
        ...document.snapshot,
        reports: [...document.snapshot.reports, document.snapshot.reports[0]],
      },
    },
  ])
    assert.throws(() => parseAzureDocument(Buffer.from(JSON.stringify(bad)), 1024 * 1024));
  assert.throws(() => parseAzureDocument(Buffer.from('{}'), 1), /tamaño/);
  const calls = [];
  const client = {
    getContainerClient: () => ({
      getBlobClient: () => ({
        getProperties: async () => ({ etag: 'new', contentLength: 2 * 1024 * 1024 }),
        download: async () => calls.push('download'),
      }),
    }),
  };
  await assert.rejects(
    readAzureSnapshot({ env: { ...env, AZURE_MAX_OBJECT_MB: '1' }, client }),
    /tamaño/,
  );
  assert.deepEqual(calls, []);
});

test('si cambia el blob durante la descarga se conserva la base, y se limita también el stream real', async () => {
  const saved = [];
  const blob = {
    getProperties: async () => ({ etag: 'old', contentLength: 10 }),
    download: async () => {
      throw new Error('If-Match failed');
    },
  };
  const client = { getContainerClient: () => ({ getBlobClient: () => blob }) };
  await assert.rejects(
    collectAzure({ env, client, save: async (...args) => saved.push(args) }),
    /If-Match/,
  );
  blob.download = async () => ({
    readableStreamBody: Readable.from([Buffer.alloc(1024 * 1024 + 1)]),
  });
  await assert.rejects(
    collectAzure({
      env: { ...env, AZURE_MAX_OBJECT_MB: '1' },
      client,
      save: async (...args) => saved.push(args),
    }),
    /tamaño/,
  );
  assert.deepEqual(saved, []);
});

test('la configuración de Storage exige un endpoint HTTPS sin tokens ni rutas', () => {
  for (const url of [
    'http://demo.blob.core.windows.net',
    'https://demo.blob.core.windows.net/?sig=secret',
    'https://demo.blob.core.windows.net/container',
  ]) {
    assert.throws(() => azureStorageClient({ AZURE_STORAGE_ACCOUNT_URL: url }), /HTTPS/);
  }
});
