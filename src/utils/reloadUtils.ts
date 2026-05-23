import { requestManager } from '../services/RequestManager';

export const hardReload = async () => {
  try {
    // 0. Invalidate RequestManager cache (IndexedDB)
    await requestManager.invalidate();

    // 1. Unregister all service workers to ensure new files are fetched
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }

    // Clear all caches
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
      }
    }

    // Force a hard reload by appending a cache-busting query parameter
    const url = new URL(window.location.href);
    url.searchParams.set('v', new Date().getTime().toString());
    window.location.href = url.toString();
  } catch (error) {
    console.error('Hard reload failed:', error);
    window.location.reload();
  }
};
