import { BlobServiceClient } from '@azure/storage-blob';
import { QueueClient } from '@azure/storage-queue';
import { QUEUE_NAME } from '../config.mjs';

export function storageClient(config, credential) {
  const service = new BlobServiceClient(config.endpoint, credential);
  const container = service.getContainerClient(config.container);
  const stateContainer = service.getContainerClient('function-state');
  const latest = container.getBlockBlobClient(config.blob);
  const queue = config.queueConnectionString
    ? QueueClient.fromConnectionString(config.queueConnectionString, QUEUE_NAME)
    : new QueueClient(`${config.queueEndpoint}${QUEUE_NAME}`, credential);
  const operation = (id) => stateContainer.getBlockBlobClient(`_operations/${id}.json`);

  async function getOperation(id) {
    try {
      const response = await operation(id).download();
      if (response.contentLength > 16384) {
        response.readableStreamBody.destroy();
        throw new Error('Estado de operación excesivo.');
      }
      const chunks = [];
      const state = { length: 0 };
      for await (const chunk of response.readableStreamBody) {
        state.length += chunk.length;
        if (state.length > 16384) throw new Error('Estado de operación excesivo.');
        chunks.push(chunk);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  async function putOperation(id, state, options = {}) {
    await operation(id).uploadData(Buffer.from(JSON.stringify(state), 'utf8'), {
      blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
      ...options,
    });
  }

  async function latestProperties(signal) {
    try {
      return await latest.getProperties({ abortSignal: signal });
    } catch (error) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  async function publish(bytes, expected, metadata, signal) {
    return await latest.uploadData(bytes, {
      abortSignal: signal,
      conditions: expected ? { ifMatch: expected } : { ifNoneMatch: '*' },
      blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
      metadata,
    });
  }

  async function enqueue(job) {
    await queue.createIfNotExists();
    await queue.sendMessage(Buffer.from(JSON.stringify(job), 'utf8').toString('base64'));
  }

  async function withLock(work, signal, name = 'inventory') {
    const lock = stateContainer.getBlockBlobClient(`_control/${name}.lock`);
    try {
      await lock.uploadData(Buffer.alloc(0), {
        conditions: { ifNoneMatch: '*' },
        abortSignal: signal,
      });
    } catch (error) {
      if (error.statusCode !== 412 && error.code !== 'BlobAlreadyExists') throw error;
    }
    const lease = lock.getBlobLeaseClient();
    await lease.acquireLease(60, { abortSignal: signal });
    const controller = new AbortController();
    const combined = AbortSignal.any([signal, controller.signal]);
    const state = { closed: false, timer: undefined, pending: undefined };
    const renew = async () => {
      try {
        await lease.renewLease({ abortSignal: combined });
      } catch {
        controller.abort(new Error('Se perdió el bloqueo de publicación.'));
      }
      if (!state.closed && !combined.aborted)
        state.timer = setTimeout(() => {
          state.pending = renew();
        }, 20000);
    };
    state.timer = setTimeout(() => {
      state.pending = renew();
    }, 20000);
    try {
      return await work(combined);
    } finally {
      state.closed = true;
      clearTimeout(state.timer);
      await state.pending;
      await lease.releaseLease();
    }
  }
  return {
    getOperation,
    putOperation,
    latestProperties,
    publish,
    enqueue,
    withLock,
    getCurrent: () => getOperation('current'),
    putCurrent: (id) => putOperation('current', { operationId: id }),
    withRequestLock: (work, signal) => withLock(work, signal, 'request'),
  };
}
