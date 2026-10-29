export async function readAzureBody(body, maxBytes, signal) {
  if (!body) throw new Error('Blob Storage devolvió un archivo sin contenido.');
  const chunks = [];
  const state = { size: 0 };
  try {
    for await (const chunk of body) {
      signal?.throwIfAborted();
      const bytes = Buffer.from(chunk);
      state.size += bytes.length;
      if (state.size > maxBytes) throw new Error('El documento Azure supera el tamaño permitido.');
      chunks.push(bytes);
    }
    signal?.throwIfAborted();
    return Buffer.concat(chunks);
  } finally {
    body.destroy?.();
  }
}
