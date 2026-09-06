/**
 * Performs a hard refresh by clearing browser caches, unregistering service workers,
 * and reloading the page with a clean slate.
 */
export const handleHardRefresh = async () => {
  try {
    // 1. Clear sessionStorage and specific localStorage caches
    try {
      sessionStorage.clear();
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('executive_session');
      localStorage.removeItem('member_session');
    } catch (e) {
      console.warn('Cache clear error:', e);
    }

    // 2. Safely unregister service workers with a strict timeout
    if ('serviceWorker' in navigator) {
      try {
        const registrationsPromise = navigator.serviceWorker.getRegistrations();
        const timeoutPromise = new Promise<ServiceWorkerRegistration[]>((resolve) => setTimeout(() => resolve([]), 500));
        const registrations = await Promise.race([registrationsPromise, timeoutPromise]);
        
        if (registrations && Array.isArray(registrations)) {
          for (const registration of registrations) {
            if (registration.waiting) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            await registration.unregister();
          }
        }
      } catch (e) {
        console.warn('SW unregister bypassed:', e);
      }
    }

    // 3. Safely clear CacheStorage with a strict timeout
    if ('caches' in window) {
      try {
        const cachePromise = caches.keys();
        const timeoutPromise = new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 500));
        const cacheNames = await Promise.race([cachePromise, timeoutPromise]);
        if (cacheNames && Array.isArray(cacheNames)) {
          for (const cacheName of cacheNames) {
            await caches.delete(cacheName);
          }
        }
      } catch (e) {
        console.warn('Cache delete bypassed:', e);
      }
    }

    // 4. Force browser reload
    window.location.reload();
  } catch (error) {
    console.error('Hard refresh fallback:', error);
    window.location.reload();
  }
};
