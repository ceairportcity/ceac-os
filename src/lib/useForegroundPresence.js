import { useEffect } from 'react';

// Load the collector after the shell renders, preserving the initial bundle
// budget. If the account/session changes while loading, never start a stale job.
export function useForegroundPresence(me, session) {
  useEffect(() => {
    if (!me?.id || !session?.id) return;
    let stopped = false, dispose;
    import('./foregroundPresence').then(({startForegroundPresence}) => {
      if (!stopped) dispose = startForegroundPresence(me, session);
    }).catch(() => {}); // A collector load failure must not block ordinary work.
    return () => { stopped = true; dispose?.(); };
  }, [me?.id, session?.id]);
}
