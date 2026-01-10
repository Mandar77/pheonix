import { useState, useEffect, useCallback, useRef } from 'react';

interface UsePollingOptions<T> {
  fetchFn: () => Promise<T>;
  interval: number;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function usePolling<T>({
  fetchFn,
  interval,
  enabled = true,
  onSuccess,
  onError,
}: UsePollingOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  const poll = useCallback(async () => {
    try {
      const result = await fetchFn();
      if (mountedRef.current) {
        setData(result);
        setError(null);
        onSuccess?.(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        onError?.(error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchFn, onSuccess, onError]);

  useEffect(() => {
    mountedRef.current = true;
    
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    poll();

    // Set up polling interval
    const intervalId = setInterval(poll, interval);

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [poll, interval, enabled]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    poll();
  }, [poll]);

  return { data, error, isLoading, refetch };
}