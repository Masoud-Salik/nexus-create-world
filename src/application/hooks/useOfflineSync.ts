import { useEffect, useState, useCallback } from 'react';
import { SyncService, ConflictResolution } from '../services/SyncService';
import { createOfflineStorage } from '../../core/infrastructure/storage/OfflineStorage';

export interface UseOfflineSyncOptions {
  autoSync?: boolean;
  conflictResolution?: ConflictResolution;
  retryInterval?: number;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingOperations: number;
  failedOperations: number;
  lastSyncTime?: string;
}

export function useOfflineSync(options: UseOfflineSyncOptions = {}) {
  const {
    autoSync = true,
    conflictResolution = { strategy: 'client_wins' },
    retryInterval = 5000
  } = options;

  const [syncService] = useState(() => new SyncService(createOfflineStorage()));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    isSyncing: false,
    pendingOperations: 0,
    failedOperations: 0
  });

  // Update sync status
  const updateSyncStatus = useCallback(async () => {
    try {
      const status = await syncService.getSyncStatus();
      setSyncStatus(prev => ({
        ...prev,
        ...status,
        isSyncing: prev.isSyncing
      }));
    } catch (error) {
      console.error('Error updating sync status:', error);
    }
  }, [syncService]);

  // Initialize sync service
  useEffect(() => {
    const initialize = async () => {
      try {
        await syncService.loadSyncQueue();
        await updateSyncStatus();
      } catch (error) {
        console.error('Error initializing sync service:', error);
      }
    };

    initialize();
  }, [syncService, updateSyncStatus]);

  // Auto-sync when online
  useEffect(() => {
    if (autoSync && syncStatus.isOnline && syncStatus.pendingOperations > 0) {
      const timer = setTimeout(() => {
        sync();
      }, retryInterval);

      return () => clearTimeout(timer);
    }
  }, [autoSync, syncStatus.isOnline, syncStatus.pendingOperations, retryInterval]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
      if (autoSync) {
        sync();
      }
    };

    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [autoSync]);

  // Sync function
  const sync = useCallback(async () => {
    if (!syncStatus.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    setSyncStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      await syncService.forceSync();
      await updateSyncStatus();
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      setSyncStatus(prev => ({ ...prev, isSyncing: false }));
    }
  }, [syncService, syncStatus.isOnline, updateSyncStatus]);

  // Optimistic update helper
  const optimisticUpdate = useCallback(async <T>(
    entityType: string,
    data: T,
    updateFn: () => Promise<T>
  ) => {
    try {
      const result = await syncService.optimisticUpdate(entityType, data, updateFn);
      await updateSyncStatus();
      return result;
    } catch (error) {
      console.error('Optimistic update failed:', error);
      throw error;
    }
  }, [syncService, updateSyncStatus]);

  // Cache helper
  const cacheData = useCallback(async (key: string, data: any, ttl?: number) => {
    try {
      await syncService.cacheData(key, data, ttl);
    } catch (error) {
      console.error('Cache failed:', error);
      throw error;
    }
  }, [syncService]);

  // Get cached data
  const getCachedData = useCallback(async (key: string) => {
    try {
      return await syncService.getCachedData(key);
    } catch (error) {
      console.error('Get cached data failed:', error);
      return null;
    }
  }, [syncService]);

  // Clear expired cache
  const clearExpiredCache = useCallback(async () => {
    try {
      await syncService.clearExpiredCache();
    } catch (error) {
      console.error('Clear expired cache failed:', error);
    }
  }, [syncService]);

  // Resolve conflict
  const resolveConflict = useCallback(async (
    entityType: string,
    entityId: string,
    localData: any,
    serverData: any,
    resolution?: ConflictResolution
  ) => {
    try {
      const resolved = await syncService.resolveConflict(
        entityType,
        entityId,
        localData,
        serverData,
        resolution || conflictResolution
      );
      await updateSyncStatus();
      return resolved;
    } catch (error) {
      console.error('Conflict resolution failed:', error);
      throw error;
    }
  }, [syncService, conflictResolution, updateSyncStatus]);

  // Clear sync queue
  const clearSyncQueue = useCallback(async () => {
    try {
      await syncService.clearSyncQueue();
      await updateSyncStatus();
    } catch (error) {
      console.error('Clear sync queue failed:', error);
      throw error;
    }
  }, [syncService, updateSyncStatus]);

  return {
    syncStatus,
    sync,
    optimisticUpdate,
    cacheData,
    getCachedData,
    clearExpiredCache,
    resolveConflict,
    clearSyncQueue,
    updateSyncStatus
  };
}
