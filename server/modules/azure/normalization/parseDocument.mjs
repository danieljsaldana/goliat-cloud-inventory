import { validateAzureDocument } from './validateDocument.mjs';

export function parseAzureDocument(buffer, maxBytes) {
  if (buffer.length > maxBytes) throw new Error('El documento Azure supera el tamaño permitido.');
  const document = JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, ''));
  validateAzureDocument(document);
  return document;
}
