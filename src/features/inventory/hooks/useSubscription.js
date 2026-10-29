import { useEffect, useState } from 'react';
import { getLocalStorage } from '../../../lib/storage.js';
import {
  readSubscription,
  saveSubscription,
  SUBSCRIPTION_KEY,
} from '../../../core/inventory/subscriptions.js';

export function useSubscription(subscriptions, loading) {
  const [saved, setSaved] = useState(() => readSubscription(getLocalStorage()));
  const invalid =
    !loading &&
    subscriptions.length > 0 &&
    saved &&
    !subscriptions.some((item) => item.id === saved);

  function select(id) {
    setSaved(id);
    saveSubscription(getLocalStorage(), id);
  }

  useEffect(() => {
    if (invalid) {
      setSaved('');
      saveSubscription(getLocalStorage(), '');
    }
  }, [invalid]);

  useEffect(() => {
    const sync = (event) => {
      if (
        event.storageArea === getLocalStorage() &&
        (event.key === SUBSCRIPTION_KEY || event.key === null)
      ) {
        setSaved(event.newValue || '');
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  return [invalid ? '' : saved, select];
}
