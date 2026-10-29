import { randomUUID } from 'node:crypto';
import { UUID, RETRIES } from '../config.mjs';
import { validateDocument } from '../inventory/validate.mjs';

export function inventoryService(config, store, generate) {
  async function getCurrentOperation() {
    const pointer = await store.getCurrent();
    const operation = pointer ? await store.getOperation(pointer.operationId) : null;
    if (
      operation &&
      ['queued', 'running', 'retrying'].includes(operation.status) &&
      Date.now() - Date.parse(operation.requestedAt) > config.timeoutMs * RETRIES + 300000
    )
      return {
        ...operation,
        status: 'failed',
        error: 'La generación ha superado su plazo máximo.',
      };
    return operation;
  }
  const inProgress = (operation) =>
    operation && ['queued', 'running', 'retrying'].includes(operation.status);

  async function requestGeneration(requestedBy = 'timer') {
    const current = await getCurrentOperation();
    if (inProgress(current)) return current.operationId;
    const signal = AbortSignal.timeout(30000);
    try {
      return await store.withRequestLock(async () => {
        const existing = await getCurrentOperation();
        if (inProgress(existing)) return existing.operationId;
        return enqueueGeneration(requestedBy);
      }, signal);
    } catch (error) {
      if (error.statusCode === 409) {
        const existing = await getCurrentOperation();
        if (inProgress(existing)) return existing.operationId;
      }
      throw error;
    }
  }

  async function enqueueGeneration(requestedBy) {
    const operationId = randomUUID();
    const job = { operationId };
    await store.putOperation(
      operationId,
      { operationId, status: 'queued', requestedAt: new Date().toISOString(), requestedBy },
      { conditions: { ifNoneMatch: '*' } },
    );
    try {
      await store.putCurrent(operationId);
      await store.enqueue(job);
    } catch (error) {
      await store.putOperation(operationId, {
        operationId,
        status: 'failed',
        requestedAt: new Date().toISOString(),
        error: 'No se pudo encolar la generación.',
      });
      throw error;
    }
    return operationId;
  }

  async function run(job, attempt = 1) {
    if (!UUID.test(job?.operationId)) throw new Error('Mensaje de generación inválido.');
    const id = job.operationId;
    const previous = await store.getOperation(id);
    if (!previous) throw new Error('La operación no existe.');
    if (previous.status === 'succeeded') return previous;
    const deadline = AbortSignal.timeout(config.timeoutMs);
    try {
      return await store.withLock(async (signal) => {
        const current = await store.latestProperties(signal);
        if (current?.metadata?.operationid === id) {
          const recovered = {
            ...previous,
            error: undefined,
            status: 'succeeded',
            etag: current.etag,
            generatedAt: current.metadata.generatedat,
            resources: Number(current.metadata.resources),
            completedAt: new Date().toISOString(),
          };
          await store.putOperation(id, recovered);
          return recovered;
        }
        await store.putOperation(id, { ...previous, error: undefined, status: 'running', attempt });
        const document = await generate(signal);
        const bytes = validateDocument(document, config.maxBytes);
        signal.throwIfAborted();
        const resources = document.snapshot.totals.reduce((sum, row) => sum + row.resources, 0);
        const result = await store.publish(
          bytes,
          current?.etag,
          { operationid: id, generatedat: document.generatedAt, resources: String(resources) },
          signal,
        );
        const completed = {
          ...previous,
          error: undefined,
          status: 'succeeded',
          attempt,
          etag: result.etag,
          generatedAt: document.generatedAt,
          resources,
          completedAt: new Date().toISOString(),
        };
        await store.putOperation(id, completed);
        return completed;
      }, deadline);
    } catch (error) {
      await store.putOperation(id, {
        ...previous,
        status: 'retrying',
        attempt,
        error: 'La recogida o publicación falló; se reintentará desde la cola.',
      });
      throw error;
    }
  }

  async function fail(job) {
    if (!UUID.test(job?.operationId)) return;
    const previous = await store.getOperation(job.operationId);
    if (previous?.status === 'succeeded') return;
    await store.putOperation(job.operationId, {
      ...previous,
      operationId: job.operationId,
      status: 'failed',
      error: 'Se agotaron los reintentos. Revisa permisos, límites y logs de la Function.',
      completedAt: new Date().toISOString(),
    });
  }

  async function publishDocument(document, condition) {
    const validated = () => {
      try {
        return validateDocument(document, config.maxBytes);
      } catch (error) {
        throw Object.assign(error, { status: 400 });
      }
    };
    const bytes = validated();
    const ids = document.snapshot.catalog.map((r) => r.subscriptionId.toLowerCase()).sort();
    if (JSON.stringify(ids) !== JSON.stringify([...config.subscriptionIds].sort()))
      throw Object.assign(new Error('El catálogo no coincide con el ámbito configurado.'), {
        status: 400,
      });
    if (condition.ifMatch && condition.ifNoneMatch)
      throw Object.assign(new Error('Usa una sola condición ETag.'), { status: 400 });
    if (!condition.ifMatch && condition.ifNoneMatch !== '*')
      throw Object.assign(new Error('Se requiere If-Match o If-None-Match: *.'), { status: 428 });
    return await store.withLock(async (signal) => {
      const current = await store.latestProperties(signal);
      if (
        (condition.ifMatch && condition.ifMatch !== current?.etag) ||
        (condition.ifNoneMatch === '*' && current)
      )
        throw Object.assign(new Error('El inventario ha cambiado.'), { status: 412 });
      if (current?.metadata?.generatedat && document.generatedAt < current.metadata.generatedat)
        throw Object.assign(new Error('La generación es anterior al inventario activo.'), {
          status: 409,
        });
      const result = await store.publish(
        bytes,
        current?.etag,
        {
          operationid: randomUUID(),
          generatedat: document.generatedAt,
          resources: String(document.snapshot.totals.reduce((n, r) => n + r.resources, 0)),
        },
        signal,
      );
      return { etag: result.etag, generatedAt: document.generatedAt };
    }, AbortSignal.timeout(120000));
  }
  return {
    requestGeneration,
    run,
    fail,
    publishDocument,
    getCurrentOperation,
    getOperation: store.getOperation,
  };
}
