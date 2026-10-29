import contract from '../src/inventory/contract.json' with { type: 'json' };
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDocument } from '../src/inventory/build.mjs';
import { validateDocument } from '../src/inventory/validate.mjs';
import { inventoryService } from '../src/services/inventory.mjs';
import { snapshot, memoryStore, SUBSCRIPTION, OTHER } from './fixture.mjs';

const config = {
  subscriptionIds: [SUBSCRIPTION, OTHER],
  tagKeys: [],
  maxBytes: 64 * 1024 * 1024,
  timeoutMs: 1000,
};

test('genera todos los informes con ámbito completo, vacíos, etiquetas y valores false/0', () => {
  const document = buildDocument(snapshot());
  assert.equal(document.snapshot.reports.length, contract.reports.length);
  assert.equal(document.snapshot.totals.find((r) => r.subscriptionId === OTHER).resources, 0);
  assert.ok(document.snapshot.tagKeys.includes('Environment'));
  const report = (id) => document.snapshot.reports.find((r) => r.id === id).rows;
  assert.equal(report('functions').length, 1);
  assert.equal(report('logic-apps').length, 1);
  assert.equal(report('container-apps')[0].minReplicas, 0);
  assert.equal(report('container-apps')[0].externalIngress, false);
  assert.equal(report('aks-node-pools')[0].pools[0].enableAutoScaling, false);
  assert.equal(report('virtual-machines')[0].powerState, 'PowerState/running');
  assert.ok(!validateDocument(document).includes('never-publish-this'));
});

test('rechaza documentos incompletos, duplicados, recuentos incoherentes y tamaños excesivos', () => {
  const incomplete = buildDocument(snapshot());
  incomplete.snapshot.reports.pop();
  assert.throws(() => validateDocument(incomplete));
  const duplicate = buildDocument(snapshot());
  duplicate.snapshot.reports[0].rows[0].subscriptionId = 'out-of-scope';
  assert.throws(() => validateDocument(duplicate));
  const counts = buildDocument(snapshot());
  counts.snapshot.totals[0].resources += 1;
  assert.throws(() => validateDocument(counts));
  for (const reportId of ['resource-types', 'tag-coverage']) {
    const wrong = buildDocument(snapshot());
    wrong.snapshot.reports.find((r) => r.id === reportId).rows[0].resources += 1;
    assert.throws(() => validateDocument(wrong));
  }
  const wrongTags = buildDocument(snapshot());
  wrongTags.snapshot.tags[0].tagsJson = '{"invented":"value"}';
  assert.throws(() => validateDocument(wrongTags));
  assert.throws(() => validateDocument(buildDocument(snapshot()), 1));
});

test('la cola conserva operaciones, publica con ETag y no vuelve a ejecutar trabajos completados', async () => {
  const store = memoryStore();
  const service = inventoryService(config, store, async () => buildDocument(snapshot()));
  const id = await service.requestGeneration('verified-user');
  assert.equal((await service.getOperation(id)).status, 'queued');
  const job = store.state.messages[0];
  const result = await service.run(job);
  assert.equal(result.status, 'succeeded');
  assert.equal(result.resources, 8);
  assert.equal((await service.run(job)).etag, result.etag);
  assert.equal(store.state.writes.length, 1);
});

test('un error de recogida conserva el blob anterior y acaba en estado fallido tras poison', async () => {
  const store = memoryStore();
  store.state.latest = { etag: '"old"', metadata: {} };
  const service = inventoryService(config, store, async () => {
    throw new Error('Azure no disponible.');
  });
  const id = await service.requestGeneration();
  await assert.rejects(service.run(store.state.messages[0]));
  assert.equal(store.state.latest.etag, '"old"');
  assert.equal(store.state.writes.length, 0);
  assert.equal((await service.getOperation(id)).status, 'retrying');
  await service.fail(store.state.messages[0]);
  assert.equal((await service.getOperation(id)).status, 'failed');
});

test('peticiones repetidas desde otras instancias comparten la operación activa y generan otra al terminar', async () => {
  const store = memoryStore();
  const service = inventoryService(config, store, async () => buildDocument(snapshot()));
  const id = await service.requestGeneration('web');
  const otherInstance = inventoryService(config, store, async () => buildDocument(snapshot()));
  assert.equal(await otherInstance.requestGeneration('another-web'), id);
  assert.equal((await otherInstance.getCurrentOperation()).operationId, id);
  assert.equal(store.state.messages.length, 1);
  await service.run(store.state.messages[0]);
  assert.notEqual(await otherInstance.requestGeneration('web'), id);
  assert.equal(store.state.messages.length, 2);
});

test('un fallo al encolar o un estado abandonado permite solicitar otra generación', async () => {
  const store = memoryStore();
  const service = inventoryService(config, store, async () => buildDocument(snapshot()));
  const enqueue = store.enqueue;
  store.enqueue = async () => {
    throw new Error('queue unavailable');
  };
  await assert.rejects(service.requestGeneration());
  assert.equal((await service.getCurrentOperation()).status, 'failed');
  store.enqueue = enqueue;
  const id = await service.requestGeneration();
  const operation = await store.getOperation(id);
  await store.putOperation(id, { ...operation, requestedAt: '2020-01-01T00:00:00.000Z' });
  assert.equal((await service.getCurrentOperation()).status, 'failed');
  assert.notEqual(await service.requestGeneration(), id);
});

test('recupera una publicación confirmada aunque falle el guardado posterior del estado', async () => {
  const store = memoryStore();
  const id = '77777777-7777-4777-8777-777777777777';
  await store.putOperation(id, { operationId: id, status: 'running' });
  store.state.latest = {
    etag: '"published"',
    metadata: { operationid: id, generatedat: new Date().toISOString(), resources: '8' },
  };
  const service = inventoryService(config, store, async () => {
    throw new Error('No debe regenerar.');
  });
  assert.equal((await service.run({ operationId: id })).etag, '"published"');
  assert.equal(store.state.writes.length, 0);
});

test('publicar JSON exige condiciones ETag, contrato y el ámbito fijo del servidor', async () => {
  const store = memoryStore();
  const service = inventoryService(config, store, async () => buildDocument(snapshot()));
  const document = buildDocument(snapshot());
  await assert.rejects(service.publishDocument(document, {}), { status: 428 });
  await assert.rejects(service.publishDocument(document, { ifMatch: '"old"', ifNoneMatch: '*' }), {
    status: 400,
  });
  await service.publishDocument(document, { ifNoneMatch: '*' });
  await assert.rejects(service.publishDocument(document, { ifNoneMatch: '*' }), { status: 412 });
  await assert.rejects(service.publishDocument(document, { ifMatch: '"wrong"' }), { status: 412 });
  const older = { ...document, generatedAt: '2020-01-01T00:00:00.000Z' };
  await assert.rejects(service.publishDocument(older, { ifMatch: store.state.latest.etag }), {
    status: 409,
  });
  const limited = inventoryService({ ...config, subscriptionIds: [SUBSCRIPTION] }, store, () => {});
  await assert.rejects(limited.publishDocument(document, { ifMatch: store.state.latest.etag }), {
    status: 400,
  });
  assert.equal(store.state.writes.length, 1);
});
