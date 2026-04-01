import { IOfflineStorage } from '../storage/OfflineStorage';

export interface SyncableEntity {
  id: string;
  last_modified: string;
  version: number;
}

export interface SyncOperation {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: 'create' | 'update' | 'delete';
  data?: any;
  timestamp: string;
  status: 'pending' | 'synced' | 'failed';
  retry_count: number;
}

export interface ConflictResolution {
  strategy: 'client_wins' | 'server_wins' | 'merge' | 'manual';
  resolved_data?: any;
}

export class SyncService {
  private storage: IOfflineStorage;
  private isOnline: boolean = true;
  private syncQueue: SyncOperation[] = [];
  private syncInProgress: boolean = false;

  constructor(storage: IOfflineStorage) {
    this.storage = storage;
    this.initializeNetworkMonitoring();
  }

  private initializeNetworkMonitoring() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.processSyncQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
      });

      this.isOnline = navigator.onLine;
    }
  }

  // Queue an operation for sync
  async queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'status' | 'retry_count'>): Promise<void> {
    const syncOp: SyncOperation = {
      ...operation,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      status: 'pending',
      retry_count: 0
    };

    this.syncQueue.push(syncOp);
    await this.saveSyncQueue();

    if (this.isOnline && !this.syncInProgress) {
      this.processSyncQueue();
    }
  }

  // Process the sync queue
  private async processSyncQueue(): Promise<void> {
    if (this.syncInProgress || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;

    try {
      const pendingOperations = this.syncQueue.filter(op => op.status === 'pending');
      
      for (const operation of pendingOperations) {
        try {
          await this.syncOperation(operation);
          operation.status = 'synced';
        } catch (error) {
          console.error('Sync operation failed:', error);
          operation.status = 'failed';
          operation.retry_count++;

          // Retry up to 3 times
          if (operation.retry_count < 3) {
            operation.status = 'pending';
          }
        }
      }

      await this.saveSyncQueue();
    } finally {
      this.syncInProgress = false;
    }
  }

  // Sync individual operation
  private async syncOperation(operation: SyncOperation): Promise<void> {
    // This would make actual API calls to sync with the server
    // For now, we'll simulate the sync process
    
    console.log(`Syncing ${operation.operation} for ${operation.entity_type}:${operation.entity_id}`);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate occasional failures for testing
    if (Math.random() < 0.1) {
      throw new Error('Simulated sync failure');
    }
  }

  // Resolve conflicts between local and server data
  async resolveConflict(
    entityType: string,
    entityId: string,
    localData: any,
    serverData: any,
    resolution: ConflictResolution
  ): Promise<any> {
    switch (resolution.strategy) {
      case 'client_wins':
        return localData;
      
      case 'server_wins':
        return serverData;
      
      case 'merge':
        return this.mergeData(localData, serverData);
      
      case 'manual':
        // Return both and let the UI handle the manual resolution
        return { local: localData, server: serverData };
      
      default:
        throw new Error(`Unknown conflict resolution strategy: ${resolution.strategy}`);
    }
  }

  // Merge two data objects
  private mergeData(local: any, server: any): any {
    // Simple merge strategy - in a real app, this would be more sophisticated
    const merged = { ...server, ...local };
    
    // Preserve server timestamps
    if (server.last_modified && local.last_modified) {
      merged.last_modified = new Date(server.last_modified) > new Date(local.last_modified) 
        ? server.last_modified 
        : local.last_modified;
    }
    
    return merged;
  }

  // Get sync status
  async getSyncStatus(): Promise<{
    isOnline: boolean;
    pendingOperations: number;
    failedOperations: number;
    lastSyncTime?: string;
  }> {
    const pendingCount = this.syncQueue.filter(op => op.status === 'pending').length;
    const failedCount = this.syncQueue.filter(op => op.status === 'failed').length;
    
    return {
      isOnline: this.isOnline,
      pendingOperations: pendingCount,
      failedOperations: failedCount,
      lastSyncTime: await this.getLastSyncTime()
    };
  }

  // Force sync all pending operations
  async forceSync(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    await this.processSyncQueue();
  }

  // Clear sync queue
  async clearSyncQueue(): Promise<void> {
    this.syncQueue = [];
    await this.storage.remove('sync-queue');
  }

  // Save sync queue to storage
  private async saveSyncQueue(): Promise<void> {
    await this.storage.set('sync-queue', this.syncQueue);
  }

  // Load sync queue from storage
  async loadSyncQueue(): Promise<void> {
    const queue = await this.storage.get<SyncOperation[]>('sync-queue');
    if (queue) {
      this.syncQueue = queue;
    }
  }

  // Get last sync time
  private async getLastSyncTime(): Promise<string | undefined> {
    return await this.storage.get<string>('last-sync-time');
  }

  // Update last sync time
  private async updateLastSyncTime(): Promise<void> {
    await this.storage.set('last-sync-time', new Date().toISOString());
  }

  // Generate unique ID
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Optimistic update helper
  async optimisticUpdate<T extends SyncableEntity>(
    entityType: string,
    data: T,
    updateFn: () => Promise<T>
  ): Promise<T> {
    // Queue the update operation
    await this.queueOperation({
      entity_type: entityType,
      entity_id: data.id,
      operation: 'update',
      data
    });

    try {
      // Try to update immediately if online
      if (this.isOnline) {
        const result = await updateFn();
        await this.updateLastSyncTime();
        return result;
      }

      // Return the local data if offline
      return data;
    } catch (error) {
      console.error('Optimistic update failed:', error);
      throw error;
    }
  }

  // Cache data for offline use
  async cacheData(key: string, data: any, ttl?: number): Promise<void> {
    const cacheEntry = {
      data,
      timestamp: new Date().toISOString(),
      ttl: ttl ? Date.now() + ttl * 1000 : undefined
    };

    await this.storage.set(`cache-${key}`, cacheEntry);
  }

  // Get cached data
  async getCachedData(key: string): Promise<any | null> {
    const cacheEntry = await this.storage.get<any>(`cache-${key}`);
    
    if (!cacheEntry) {
      return null;
    }

    // Check if cache has expired
    if (cacheEntry.ttl && Date.now() > cacheEntry.ttl) {
      await this.storage.remove(`cache-${key}`);
      return null;
    }

    return cacheEntry.data;
  }

  // Clear expired cache entries
  async clearExpiredCache(): Promise<void> {
    const keys = await this.storage.keys();
    const cacheKeys = keys.filter(key => key.startsWith('cache-'));

    for (const key of cacheKeys) {
      const cacheEntry = await this.storage.get<any>(key);
      if (cacheEntry && cacheEntry.ttl && Date.now() > cacheEntry.ttl) {
        await this.storage.remove(key);
      }
    }
  }
}
