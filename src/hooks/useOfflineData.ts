import { useState, useEffect, useCallback, useRef } from "react";

interface UseOfflineDataOptions<T> {
  /** Key for localStorage */
  key: string;
  /** Function to fetch fresh data from server */
  fetcher: () => Promise<T>;
  /** How long cached data is considered valid (ms) */
  staleTime?: number;
  /** Whether to fetch on mount */
  fetchOnMount?: boolean;
}

interface UseOfflineDataResult<T> {
  data: T | null;
  isLoading: boolean;
  isStale: boolean;
  isOffline: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateLocal: (updater: (current: T | null) => T) => void;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Generic hook for offline-first data fetching with local caching.
 * Uses stale-while-revalidate pattern:
 * 1. Returns cached data immediately (if available)
 * 2. Fetches fresh data in background
 * 3. Updates cache and state when fresh data arrives
 * 4. Works offline with cached data
 */
export function useOfflineData<T>({
  key,
  fetcher,
  staleTime = 5 * 60 * 1000, // 5 minutes default
  fetchOnMount = true,
}: UseOfflineDataOptions<T>): UseOfflineDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [error, setError] = useState<Error | null>(null);
  const fetchingRef = useRef(false);

  // Storage key with prefix
  const storageKey = `offline_cache_${key}`;

  // Load from cache on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const entry: CacheEntry<T> = JSON.parse(cached);
        setData(entry.data);
        
        // Check if stale
        const age = Date.now() - entry.timestamp;
        setIsStale(age > staleTime);
      }
    } catch (e) {
      console.error("Error loading from cache:", e);
    }
  }, [storageKey, staleTime]);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // Refetch when coming back online
      refetch();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Save to cache
  const saveToCache = useCallback((newData: T) => {
    try {
      const entry: CacheEntry<T> = {
        data: newData,
        timestamp: Date.now(),
      };
      localStorage.setItem(storageKey, JSON.stringify(entry));
    } catch (e) {
      console.error("Error saving to cache:", e);
    }
  }, [storageKey]);

  // Fetch fresh data
  const refetch = useCallback(async () => {
    if (fetchingRef.current || !navigator.onLine) return;
    
    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const freshData = await fetcher();
      setData(freshData);
      setIsStale(false);
      saveToCache(freshData);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to fetch data"));
      // Don't clear existing data on error - keep showing cached
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [fetcher, saveToCache]);

  // Fetch on mount if enabled
  useEffect(() => {
    if (fetchOnMount && navigator.onLine) {
      refetch();
    }
  }, [fetchOnMount]); // Only run once on mount

  // Update local data and cache
  const updateLocal = useCallback((updater: (current: T | null) => T) => {
    setData((current) => {
      const updated = updater(current);
      saveToCache(updated);
      return updated;
    });
  }, [saveToCache]);

  return {
    data,
    isLoading,
    isStale,
    isOffline,
    error,
    refetch,
    updateLocal,
  };
}

/**
 * Simple hook for checking online status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
