import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsyncResource(
  load,
  { enabled = true, preserveData = false, refresh = load } = {},
) {
  const [state, setState] = useState({ loading: true, data: null, error: false });
  const active = useRef(null);
  const execute = useCallback(
    async (loader, { keepDataOnError = false } = {}) => {
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      setState((previous) => ({
        loading: true,
        error: false,
        data: preserveData ? previous.data : null,
      }));
      try {
        const data = await loader(controller.signal);
        controller.signal.throwIfAborted();
        setState({ loading: false, error: false, data });
        return { ok: true };
      } catch (error) {
        if (!controller.signal.aborted)
          setState((previous) => ({
            loading: false,
            error: true,
            data: preserveData && keepDataOnError ? previous.data : null,
          }));
        return { ok: false, error };
      }
    },
    [preserveData],
  );
  const reload = useCallback(() => execute(refresh, { keepDataOnError: true }), [execute, refresh]);
  useEffect(() => {
    if (!enabled) {
      setState({ loading: false, data: null, error: false });
      return;
    }
    async function initialLoad() {
      await execute(load);
    }
    void initialLoad();
    return () => active.current?.abort();
  }, [load, enabled, execute]);
  return { ...state, reload };
}
