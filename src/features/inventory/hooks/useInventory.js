import { useAsyncResource } from '../../../hooks/useAsyncResource.js';
import { loadInventory } from '../api/loadInventory.js';
import { refreshInventory } from '../api/refreshInventory.js';
import { appBaseUrl } from '../../../app/routing/navigation.js';
import { EMPTY_FILES, NETWORK_ERRORS } from '../constants.js';

async function load(signal) {
  return loadInventory({ baseUrl: appBaseUrl(), signal });
}

async function refresh(signal) {
  return refreshInventory({ baseUrl: appBaseUrl(), signal });
}

export function useInventory() {
  const { data, error, loading, reload } = useAsyncResource(load, { preserveData: true, refresh });
  return {
    files: data?.files || EMPTY_FILES,
    metadata: data?.metadata || null,
    errors: error ? NETWORK_ERRORS : data?.errors || [],
    loading,
    reload,
  };
}
