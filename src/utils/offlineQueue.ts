/**
 * Offline Action Queue
 * 
 * Queues actions when offline and processes them when back online.
 * Actions are stored in localStorage and processed in order.
 */

export interface QueuedAction {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

const QUEUE_KEY = "offline_action_queue";
const MAX_RETRIES = 3;

/**
 * Get all queued actions
 */
export function getQueuedActions(): QueuedAction[] {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save queue to localStorage
 */
function saveQueue(queue: QueuedAction[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error("Failed to save offline queue:", e);
  }
}

/**
 * Add an action to the queue
 */
export function queueAction(type: string, payload: Record<string, unknown>): string {
  const action: QueuedAction = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    payload,
    timestamp: Date.now(),
    retries: 0,
  };

  const queue = getQueuedActions();
  queue.push(action);
  saveQueue(queue);

  console.log(`[OfflineQueue] Action queued: ${type}`, payload);
  return action.id;
}

/**
 * Remove an action from the queue
 */
export function removeAction(actionId: string): void {
  const queue = getQueuedActions();
  const filtered = queue.filter((a) => a.id !== actionId);
  saveQueue(filtered);
}

/**
 * Mark an action as failed (increment retry count)
 */
export function markActionFailed(actionId: string): void {
  const queue = getQueuedActions();
  const updated = queue.map((a) => {
    if (a.id === actionId) {
      return { ...a, retries: a.retries + 1 };
    }
    return a;
  }).filter((a) => a.retries < MAX_RETRIES);
  saveQueue(updated);
}

/**
 * Clear all queued actions
 */
export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

/**
 * Get the count of pending actions
 */
export function getPendingCount(): number {
  return getQueuedActions().length;
}

/**
 * Action processor function type
 */
export type ActionProcessor = (action: QueuedAction) => Promise<boolean>;

/**
 * Process all queued actions with the provided processor
 * Returns the number of successfully processed actions
 */
export async function processQueue(processor: ActionProcessor): Promise<number> {
  const queue = getQueuedActions();
  if (queue.length === 0) return 0;

  console.log(`[OfflineQueue] Processing ${queue.length} queued actions...`);
  
  let successCount = 0;

  for (const action of queue) {
    try {
      const success = await processor(action);
      if (success) {
        removeAction(action.id);
        successCount++;
        console.log(`[OfflineQueue] Action processed: ${action.type}`);
      } else {
        markActionFailed(action.id);
      }
    } catch (error) {
      console.error(`[OfflineQueue] Action failed: ${action.type}`, error);
      markActionFailed(action.id);
    }
  }

  return successCount;
}

/**
 * Hook-friendly queue manager that auto-processes when online
 */
export function createQueueManager(processor: ActionProcessor) {
  let isProcessing = false;

  const processIfOnline = async () => {
    if (!navigator.onLine || isProcessing) return;
    
    isProcessing = true;
    try {
      const processed = await processQueue(processor);
      if (processed > 0) {
        console.log(`[OfflineQueue] Processed ${processed} actions`);
      }
    } finally {
      isProcessing = false;
    }
  };

  // Auto-process when coming online
  window.addEventListener("online", processIfOnline);

  // Initial process if online
  if (navigator.onLine) {
    processIfOnline();
  }

  return {
    queue: (type: string, payload: Record<string, unknown>) => {
      const id = queueAction(type, payload);
      // Try to process immediately if online
      processIfOnline();
      return id;
    },
    getPendingCount,
    processNow: processIfOnline,
    cleanup: () => {
      window.removeEventListener("online", processIfOnline);
    },
  };
}
