const maxBytes = 256 * 1024;
const imageTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);

export async function readMemberPhoto(response) {
  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (
    !imageTypes.has(contentType) ||
    !response.body ||
    Number(response.headers.get('content-length') || 0) > maxBytes
  ) {
    await response.body?.cancel();
    throw new Error('directory_unavailable');
  }
  const chunks = [];
  const state = { length: 0 };
  for await (const chunk of response.body) {
    state.length += chunk.byteLength;
    if (state.length > maxBytes) throw new Error('directory_unavailable');
    chunks.push(chunk);
  }
  if (!state.length) throw new Error('directory_unavailable');
  return {
    body: Buffer.concat(chunks, state.length),
    contentType: contentType === 'image/jpg' ? 'image/jpeg' : contentType,
  };
}
