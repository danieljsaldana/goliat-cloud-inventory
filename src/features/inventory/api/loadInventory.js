import { requestJson } from '../../../services/requestJson.js';

export async function loadInventory({ baseUrl, signal, fetcher }) {
  const inventory = await requestJson(new URL('api/inventory/azure/', baseUrl), {
    signal,
    fetcher,
  });
  if (
    !inventory.files ||
    !Array.isArray(inventory.errors) ||
    Object.values(inventory.files).some(
      (file) =>
        !Array.isArray(file.headers) ||
        !Array.isArray(file.rows) ||
        file.rows.some(
          (row) =>
            !Array.isArray(row) ||
            row.length !== file.headers.length ||
            row.some((value) => typeof value !== 'string'),
        ),
    )
  )
    throw new Error('Respuesta de inventario invalida.');
  return { ...inventory, loading: false };
}
