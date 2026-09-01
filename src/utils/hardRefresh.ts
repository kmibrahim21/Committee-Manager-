/**
 * Performs a hard refresh by clearing browser caches, unregistering service workers,
 * and reloading the page with a cache-busting parameter.
 */
export const handleHardRefresh = async () => {
  try {
    // 1. Unregister all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }

    // 2. Clear all browser caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
      }
    }

    // 3. Clear sessionStorage and specific localStorage caches
    sessionStorage.clear();
    
    // Clear OfflineService caches to force fresh data fetch
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cache_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    
    // Also remove specific auth session data to ensure a clean slate without fully logging out
    // Actually, don't remove session/auth tokens so the user stays logged in, 
    // but clearing cache_ profile data is enough.

    // 4. Reload with a cache-busting timestamp
    const url = new URL(window.location.href);
    url.searchParams.set('t', Date.now().toString());
    window.location.href = url.toString();
  } catch (error) {
    console.error('Hard refresh failed:', error);
    // Fallback to simple reload
    window.location.reload();
  }
};
