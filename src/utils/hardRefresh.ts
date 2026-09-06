/**
 * Performs a hard refresh by clearing browser caches, unregistering service workers,
 * and reloading the page with a clean slate and cache-busting parameter.
 */
export const handleHardRefresh = async () => {
  try {
    // 1. Clear sessionStorage and specific localStorage caches
    try {
      sessionStorage.clear();
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('cache_') || key.startsWith('supabase.') || key.includes('workbox'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('executive_session');
      localStorage.removeItem('member_session');
    } catch (e) {
      console.warn('Cache clear error:', e);
    }

    // 2. Safely unregister all service workers
    if ('serviceWorker' in navigator) {
      try {
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
      } catch (e) {
        console.warn('SW unregister bypassed:', e);
      }
    }

    // 3. Safely delete all entries in CacheStorage
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        if (cacheNames && cacheNames.length > 0) {
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
      } catch (e) {
        console.warn('Cache delete bypassed:', e);
      }
    }

    // 4. Force reload with cache busting query param
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString());
    window.location.href = url.toString();
  } catch (error) {
    console.error('Hard refresh fallback:', error);
    window.location.reload();
  }
};

