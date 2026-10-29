export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { getLogger } = await import('./server/logging/logger.mjs');
  getLogger().info({ event: 'server.started' }, 'Servidor del inventario cloud iniciado.');
}

export async function onRequestError(error, request, context) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { getLogger } = await import('./server/logging/logger.mjs');
  const { requestId } = await import('./server/logging/utils/requestId.mjs');
  getLogger().error(
    {
      err: error,
      event: 'server.request.failed',
      route: context.routePath,
      method: request.method,
      requestId: requestId(request.headers['x-request-id']),
    },
    'Error no controlado en el servidor.',
  );
}
