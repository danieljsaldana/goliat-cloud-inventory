import { requestJson } from '../requestJson.js';
import { REFRESH_STATUS_URLS } from './constants.js';

export async function loadRefreshStatus(provider, { signal, fetcher } = {}) {
  const url = REFRESH_STATUS_URLS[provider];
  if (!url) throw new Error('Proveedor de actualización inválido.');
  const data = await requestJson(url, { signal, fetcher });
  if (typeof data.running !== 'boolean') throw new Error('Estado de actualización inválido.');
  return data;
}
