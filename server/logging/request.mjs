import { getLogging } from './logger.mjs';
import { withLogContext } from './context.mjs';
import { requestId } from './utils/requestId.mjs';
import { SLOW_REQUEST_MS } from './constants.mjs';

export function loggedRoute(handler, { route, health = false, logSuccess = true, logging } = {}) {
  return async (request, context) => {
    const { logger, config } = logging ?? getLogging();
    if (!config.enabled) return handler(request, context);
    const id = requestId(request.headers.get('x-request-id'));
    const started = performance.now();
    return withLogContext({ requestId: id }, async () => {
      try {
        const response = await handler(request, context);
        const durationMs = Math.round((performance.now() - started) * 100) / 100;
        if (config.httpEnabled) {
          const fields = {
            event: 'http.completed',
            route,
            method: request.method,
            statusCode: response.status,
            durationMs,
          };
          if (response.status >= 500)
            logger.error(fields, 'La petición ha terminado con un error del servidor.');
          else if (response.status >= 400) logger.warn(fields, 'La petición ha sido rechazada.');
          else if (logSuccess && !health) {
            if (durationMs >= SLOW_REQUEST_MS)
              logger.warn(fields, 'La petición ha tardado más de un segundo.');
            else logger.info(fields, 'Petición completada.');
          }
        }
        try {
          response.headers.set('x-request-id', id);
          return response;
        } catch {
          const headers = new Headers(response.headers);
          headers.set('x-request-id', id);
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        }
      } catch (err) {
        logger.error(
          {
            err,
            event: 'http.failed',
            route,
            method: request.method,
            durationMs: Math.round(performance.now() - started),
          },
          'Error inesperado al procesar la petición.',
        );
        throw err;
      }
    });
  };
}
