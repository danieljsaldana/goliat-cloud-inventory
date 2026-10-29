import { request as httpsRequest } from 'node:https';

// Las operaciones son mensajes JSON pequeños y privados; no pasan por la caché de fetch de Next.
export function functionRequest(url, { method, signal, headers, body }) {
  return new Promise((resolve, reject) => {
    const transport = { dns: false, connected: false, tls: false, headers: false };
    const fail = (error) => reject(Object.assign(error, { transport }));
    const request = httpsRequest(url, { method, signal, headers }, (response) => {
      transport.headers = true;
      const chunks = [];
      const size = { bytes: 0 };
      response.on('data', (chunk) => {
        size.bytes += chunk.length;
        if (size.bytes > 64 * 1024) {
          response.destroy(new Error('La respuesta de la Function supera el límite.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('error', fail);
      response.on('end', () => {
        try {
          const bytes = Buffer.concat(chunks);
          resolve(new Response(bytes.length ? bytes : null, { status: response.statusCode }));
        } catch (error) {
          fail(error);
        }
      });
    });
    request.on('socket', (socket) => {
      socket.on('lookup', () => {
        transport.dns = true;
      });
      socket.on('connect', () => {
        transport.connected = true;
      });
      socket.on('secureConnect', () => {
        transport.tls = true;
      });
    });
    request.on('error', fail);
    request.end(body);
  });
}
