/**
 * Performs a hard refresh by clearing stale app/SW caches while preserving
 * user authentication sessions, safely unregistering Service Workers with
 * timeouts, busting the browser HTTP cache for index.html, and reloading.
 */
export const handleHardRefresh = async () => {
  const withTimeout = <T,>(promise: Promise<T>, ms = 1500): Promise<T | void> =>
    Promise.race([promise, new Promise<void>((resolve) => setTimeout(resolve, ms))]);

  try {
    // 1. Clear sessionStorage and app/workbox/offline caches (preserving auth sessions & user prefs)
    try {
      sessionStorage.clear();
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('cache_') ||
            key.startsWith('workbox') ||
            key.startsWith('local_notices_') ||
            key.startsWith('local_polls_') ||
            key.startsWith('local_poll_votes_') ||
            key.startsWith('local_fees_'))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('Cache clear error:', e);
    }

    // 2. Safely unregister all service workers with a 1500ms timeout guard
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        await withTimeout(
          (async () => {
            const registrations = await navigator.serviceWorker.getRegistrations();
            if (registrations && registrations.length > 0) {
              await Promise.all(
                registrations.map(async (reg) => {
                  try {
                    if (reg.active) reg.active.postMessage({ type: 'SKIP_WAITING' });
                    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                    await reg.unregister();
                  } catch (err) {
                    console.warn('Error unregistering worker:', err);
                  }
                })
              );
            }
          })(),
          1500
        );
      } catch (e) {
        console.warn('SW unregister bypassed:', e);
      }
    }

    // 3. Safely delete all entries in CacheStorage with a 1500ms timeout guard
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        await withTimeout(
          (async () => {
            const cacheNames = await caches.keys();
            if (cacheNames && cacheNames.length > 0) {
              await Promise.all(cacheNames.map((name) => caches.delete(name)));
            }
          })(),
          1500
        );
      } catch (e) {
        console.warn('Cache delete bypassed:', e);
      }
    }

    // 4. Revalidate index.html against network before reloading to bust HTTP cache
    const bustTs = Date.now().toString();
    await Promise.race([
      fetch('/index.html?_v=' + bustTs, {
        cache: 'reload',
        headers: { 'Cache-Control': 'no-cache' }
      }).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1000))
    ]);

    // 5. Replace location with cache-busting query param without polluting Back history
    const url = new URL(window.location.href);
    url.searchParams.set('_v', bustTs);
    window.location.replace(url.toString());
  } catch (error) {
    console.error('Hard refresh fallback:', error);
    window.location.reload();
  }
};

export const hardReload = handleHardRefresh;
