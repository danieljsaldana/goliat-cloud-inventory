import { SUBSCRIPTION_KEY } from '../constants.js';

export function readSubscription(storage) {
  try {
    return storage.getItem(SUBSCRIPTION_KEY) || '';
  } catch {
    return '';
  }
}
