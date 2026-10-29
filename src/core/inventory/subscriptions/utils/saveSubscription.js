import { SUBSCRIPTION_KEY } from '../constants.js';

export function saveSubscription(storage, id) {
  try {
    if (id) storage.setItem(SUBSCRIPTION_KEY, id);
    else storage.removeItem(SUBSCRIPTION_KEY);
  } catch {
    /* El filtro sigue funcionando si el navegador bloquea el almacenamiento. */
  }
}
