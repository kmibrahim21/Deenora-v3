import { useState, useEffect, useCallback } from 'react';
import {
  HijriData,
  getTodayDateStringYYYYMMDD,
  loadCachedHijriData,
  saveHijriDataToCache,
  fetchHijriDateFromApi,
  getFallbackHijriData
} from '../utils/hijriService';

export function useHijriCalendar() {
  const [hijriData, setHijriData] = useState<HijriData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    const todayStr = getTodayDateStringYYYYMMDD();
    const cached = loadCachedHijriData();

    // If we have cached data for today, and we are not forcing refresh, use it.
    if (cached && cached.cachedAt === todayStr && !forceRefresh) {
      setHijriData(cached.data);
      setLoading(false);
      return;
    }

    // Otherwise, try to fetch from AlAdhan API
    try {
      const freshData = await fetchHijriDateFromApi();
      setHijriData(freshData);
      saveHijriDataToCache(freshData);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch Hijri date from API:', err);
      setError(err?.message || 'Failed to fetch Hijri date');

      // Use last cached data as a fallback (even if older than today)
      if (cached) {
        setHijriData(cached.data);
      } else {
        // Absolute fallback: local offline calculation
        setHijriData(getFallbackHijriData());
      }
      setLoading(false);

      // Retry automatically in 15 seconds if API failed
      const timer = setTimeout(() => {
        loadData();
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Set up a daily refresh interval (checks every hour if the day has changed)
    const interval = setInterval(() => {
      const todayStr = getTodayDateStringYYYYMMDD();
      const cached = loadCachedHijriData();
      if (!cached || cached.cachedAt !== todayStr) {
        loadData();
      }
    }, 60 * 60 * 1000); // Once an hour

    return () => clearInterval(interval);
  }, [loadData]);

  const refresh = useCallback(() => {
    loadData(true);
  }, [loadData]);

  return {
    hijriData,
    loading,
    error,
    refresh
  };
}
