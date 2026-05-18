
import { useState, useEffect, useCallback } from 'react';
import { requestManager } from '../services/RequestManager';

export function useCachedData<T = any>(
  key: string,
  fetchFn: () => Promise<{ data: T | null; error: any; count?: number }>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<any>(null);
  const [count, setCount] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchFn();
      setData(result.data);
      setError(result.error);
      setCount(result.count);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    fetchData();

    // Subscribe to background revalidations
    return requestManager.subscribe(key, (result) => {
      if (result.data !== undefined) setData(result.data);
      if (result.count !== undefined) setCount(result.count);
      if (result.error !== undefined) setError(result.error);
    });
  }, [key, ...dependencies]);

  return { data, error, count, loading, refetch: fetchData };
}
