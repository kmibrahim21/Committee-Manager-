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

    // 3. Clear sessionStorage and optionally localStorage (decided to keep localStorage for user settings)
    sessionStorage.clear();
    
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
