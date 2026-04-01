// Platform-agnostic offline storage interface
export interface IOfflineStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  size(): Promise<number>;
}

// Web implementation using IndexedDB
export class WebOfflineStorage implements IOfflineStorage {
  private dbName = 'nexus-offline-db';
  private version = 1;
  private storeName = 'storage';

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || null);
      });
    } catch (error) {
      console.error('Error getting from offline storage:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(value, key);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(undefined);
      });
    } catch (error) {
      console.error('Error setting to offline storage:', error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(key);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(undefined);
      });
    } catch (error) {
      console.error('Error removing from offline storage:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(undefined);
      });
    } catch (error) {
      console.error('Error clearing offline storage:', error);
      throw error;
    }
  }

  async keys(): Promise<string[]> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAllKeys();
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result as string[]);
      });
    } catch (error) {
      console.error('Error getting keys from offline storage:', error);
      return [];
    }
  }

  async size(): Promise<number> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.count();
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    } catch (error) {
      console.error('Error getting size of offline storage:', error);
      return 0;
    }
  }
}

// React Native implementation using AsyncStorage
export class NativeOfflineStorage implements IOfflineStorage {
  private AsyncStorage: any;

  constructor() {
    // AsyncStorage will be imported dynamically for React Native
    this.AsyncStorage = require('@react-native-async-storage/async-storage').default;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error getting from AsyncStorage:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await this.AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error setting to AsyncStorage:', error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await this.AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from AsyncStorage:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing AsyncStorage:', error);
      throw error;
    }
  }

  async keys(): Promise<string[]> {
    try {
      return await this.AsyncStorage.getAllKeys();
    } catch (error) {
      console.error('Error getting keys from AsyncStorage:', error);
      return [];
    }
  }

  async size(): Promise<number> {
    try {
      const keys = await this.AsyncStorage.getAllKeys();
      return keys.length;
    } catch (error) {
      console.error('Error getting size of AsyncStorage:', error);
      return 0;
    }
  }
}

// Factory function to get the appropriate storage implementation
export const createOfflineStorage = (): IOfflineStorage => {
  // Check if we're in a React Native environment
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    return new NativeOfflineStorage();
  }
  
  // Default to web implementation
  return new WebOfflineStorage();
};
