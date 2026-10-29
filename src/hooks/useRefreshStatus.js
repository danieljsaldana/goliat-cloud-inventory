import { useCallback, useEffect, useState } from 'react';
import { loadRefreshStatus } from '../services/refresh/status.js';
import {
  REFRESH_STATUS_POLL_MS,
  REFRESH_STATUS_TIMEOUT_MS,
} from '../services/refresh/constants.js';

export function useRefreshStatus(provider) {
  const [state, setState] = useState({ running: false, checking: true, unavailable: false });
  const markRunning = useCallback(
    () => setState({ running: true, checking: false, unavailable: false }),
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    const pending = { active: false };
    async function checkStatus() {
      if (pending.active || controller.signal.aborted || document.visibilityState === 'hidden')
        return;
      pending.active = true;
      try {
        const signal = AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(REFRESH_STATUS_TIMEOUT_MS),
        ]);
        const { running } = await loadRefreshStatus(provider, { signal });
        if (!controller.signal.aborted) setState({ running, checking: false, unavailable: false });
      } catch {
        if (!controller.signal.aborted)
          setState((previous) => ({ ...previous, checking: false, unavailable: true }));
      } finally {
        pending.active = false;
      }
    }
    function poll() {
      void checkStatus();
    }
    poll();
    const interval = window.setInterval(poll, REFRESH_STATUS_POLL_MS);
    document.addEventListener('visibilitychange', poll);
    window.addEventListener('focus', poll);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', poll);
      window.removeEventListener('focus', poll);
    };
  }, [provider]);
  return { ...state, markRunning };
}
