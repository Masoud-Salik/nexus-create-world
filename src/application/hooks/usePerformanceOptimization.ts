import { useEffect, useRef, useState, useCallback } from 'react';

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  const [performanceMetrics, setPerformanceMetrics] = useState({
    renderCount: 0,
    averageRenderTime: 0,
    maxRenderTime: 0,
    minRenderTime: Infinity
  });

  useEffect(() => {
    renderCount.current += 1;
    const currentTime = Date.now();
    const renderTime = currentTime - lastRenderTime.current;
    lastRenderTime.current = currentTime;

    setPerformanceMetrics(prev => ({
      renderCount: renderCount.current,
      averageRenderTime: (prev.averageRenderTime * (prev.renderCount - 1) + renderTime) / prev.renderCount,
      maxRenderTime: Math.max(prev.maxRenderTime, renderTime),
      minRenderTime: Math.min(prev.minRenderTime, renderTime)
    }));
  });

  return performanceMetrics;
}

// Lazy loading hook
export function useLazyLoad<T>(
  loadFn: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await loadFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

// Debounced value hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Throttled function hook
export function useThrottle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T {
  const lastCall = useRef(0);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall.current >= delay) {
        lastCall.current = now;
        return fn(...args);
      }
    }) as T,
    [fn, delay]
  );
}

// Virtual scrolling hook
export function useVirtualScrolling(
  items: any[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );

  const visibleItems = items.slice(visibleStart, visibleEnd);
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleStart * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  useEffect(() => {
    if (containerRef) {
      containerRef.addEventListener('scroll', handleScroll);
      return () => containerRef.removeEventListener('scroll', handleScroll);
    }
  }, [containerRef, handleScroll]);

  return {
    visibleItems,
    totalHeight,
    offsetY,
    containerRef: setContainerRef,
    handleScroll
  };
}

// Image optimization hook
export function useImageOptimization() {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const loadImage = useCallback((src: string) => {
    if (loadedImages.has(src) || loadingImages.has(src)) {
      return;
    }

    setLoadingImages(prev => new Set(prev).add(src));

    const img = new Image();
    
    img.onload = () => {
      setLoadedImages(prev => new Set(prev).add(src));
      setLoadingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(src);
        return newSet;
      });
    };

    img.onerror = () => {
      setFailedImages(prev => new Set(prev).add(src));
      setLoadingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(src);
        return newSet;
      });
    };

    img.src = src;
  }, [loadedImages, loadingImages]);

  const isImageLoaded = useCallback((src: string) => {
    return loadedImages.has(src);
  }, [loadedImages]);

  const isImageLoading = useCallback((src: string) => {
    return loadingImages.has(src);
  }, [loadingImages]);

  const isImageFailed = useCallback((src: string) => {
    return failedImages.has(src);
  }, [failedImages]);

  return {
    loadImage,
    isImageLoaded,
    isImageLoading,
    isImageFailed,
    loadedImages,
    loadingImages,
    failedImages
  };
}

// Memory management hook
export function useMemoryManagement() {
  const [memoryUsage, setMemoryUsage] = useState({
    used: 0,
    total: 0,
    percentage: 0
  });

  const updateMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const used = memory.usedJSHeapSize;
      const total = memory.totalJSHeapSize;
      
      setMemoryUsage({
        used,
        total,
        percentage: (used / total) * 100
      });
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(updateMemoryUsage, 5000);
    return () => clearInterval(interval);
  }, [updateMemoryUsage]);

  const cleanup = useCallback(() => {
    // Force garbage collection if available
    if ('gc' in window) {
      (window as any).gc();
    }
    
    // Clear unused event listeners
    // This would be implemented based on specific needs
  }, []);

  return {
    memoryUsage,
    updateMemoryUsage,
    cleanup
  };
}

// Bundle size optimization hook
export function useBundleOptimization() {
  const [bundleInfo, setBundleInfo] = useState({
    size: 0,
    chunks: 0,
    loadTime: 0
  });

  useEffect(() => {
    // Monitor bundle loading performance
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const scriptEntries = entries.filter(entry => entry.name.includes('.js'));
      
      if (scriptEntries.length > 0) {
        const totalSize = scriptEntries.reduce((acc, entry) => {
          return acc + (entry as any).transferSize || 0;
        }, 0);
        
        const loadTime = scriptEntries.reduce((acc, entry) => {
          return acc + entry.duration;
        }, 0);

        setBundleInfo({
          size: totalSize,
          chunks: scriptEntries.length,
          loadTime
        });
      }
    });

    observer.observe({ entryTypes: ['resource'] });

    return () => observer.disconnect();
  }, []);

  return bundleInfo;
}

// Network optimization hook
export function useNetworkOptimization() {
  const [networkInfo, setNetworkInfo] = useState({
    effectiveType: '4g',
    downlink: 0,
    rtt: 0,
    saveData: false
  });

  useEffect(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const updateNetworkInfo = () => {
        setNetworkInfo({
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData
        });
      };

      updateNetworkInfo();
      connection.addEventListener('change', updateNetworkInfo);

      return () => {
        connection.removeEventListener('change', updateNetworkInfo);
      };
    }
  }, []);

  const shouldUseLowQualityImages = useCallback(() => {
    return networkInfo.effectiveType === 'slow-2g' || 
           networkInfo.effectiveType === '2g' || 
           networkInfo.saveData;
  }, [networkInfo]);

  const getOptimalImageQuality = useCallback(() => {
    if (shouldUseLowQualityImages()) return 'low';
    if (networkInfo.effectiveType === '3g') return 'medium';
    return 'high';
  }, [shouldUseLowQualityImages, networkInfo.effectiveType]);

  return {
    networkInfo,
    shouldUseLowQualityImages,
    getOptimalImageQuality
  };
}
