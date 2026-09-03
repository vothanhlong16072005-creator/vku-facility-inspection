/**
 * sync.js — Auto-sync engine for Facility Inspection PWA
 * Manages the sync queue: PENDING_SYNC → SYNCED | ERROR
 * Triggers automatically when device comes online (window.ononline)
 */

let _syncInProgress = false;
let _listeners = [];

const MAX_RETRY = 5;
const REQUEST_DELAY_MS = 300; // throttle between API calls

/* ─────────────── Pub/Sub ─────────────── */

/**
 * Subscribe to sync state changes.
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
function onSyncStateChange(callback) {
  _listeners.push(callback);
  return () => {
    _listeners = _listeners.filter((cb) => cb !== callback);
  };
}

function _emit(state) {
  _listeners.forEach((cb) => {
    try { cb(state); } catch (err) { console.error('[Sync] Listener error:', err); }
  });
}

/* ─────────────── Sync Single Inspection ─────────────── */

/**
 * Attempt to sync one inspection to Google Sheets.
 * Updates status in IndexedDB based on result.
 *
 * @param {Object} inspection - Full record from IndexedDB
 * @returns {Promise<{success: boolean, uuid: string, error?: string}>}
 */
async function syncOne(inspection) {
  try {
    await FacilityAPI.pushInspection(inspection);
    await FacilityDB.updateInspectionStatus(inspection.uuid, 'SYNCED');
    return { success: true, uuid: inspection.uuid };
  } catch (err) {
    const retryCount = (inspection.retryCount || 0) + 1;
    const nextStatus = retryCount >= MAX_RETRY ? 'ERROR' : 'PENDING_SYNC';

    await FacilityDB.updateInspectionStatus(inspection.uuid, nextStatus, {
      errorMessage: err.message || String(err),
      retryCount,
    });

    return { success: false, uuid: inspection.uuid, error: err.message };
  }
}

/* ─────────────── Sync All Pending ─────────────── */

/**
 * Process the entire PENDING_SYNC queue in FIFO order.
 * Also retries ERROR records up to MAX_RETRY times.
 *
 * @returns {Promise<{synced: number, failed: number, total: number} | {skipped: boolean}>}
 */
async function syncAll() {
  if (_syncInProgress) {
    console.log('[Sync] Already in progress, skipping.');
    return { skipped: true };
  }
  if (!navigator.onLine) {
    console.log('[Sync] Offline, skipping.');
    return { skipped: true, reason: 'offline' };
  }
  if (!FacilityAPI.isApiConfigured()) {
    console.log('[Sync] API not configured, skipping.');
    return { skipped: true, reason: 'no-api-url' };
  }

  _syncInProgress = true;
  _emit({ phase: 'started' });

  try {
    const pending = await FacilityDB.getInspectionsByStatus('PENDING_SYNC');
    const errored = await FacilityDB.getInspectionsByStatus('ERROR');

    // FIFO: pending first, then retry errored
    const queue = [...pending, ...errored];

    if (queue.length === 0) {
      _emit({ phase: 'idle' });
      return { synced: 0, failed: 0, total: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];

      _emit({
        phase:   'progress',
        current: i + 1,
        total:   queue.length,
        uuid:    item.uuid,
      });

      const result = await syncOne(item);
      result.success ? synced++ : failed++;

      // Rate-limit protection
      if (i < queue.length - 1) {
        await _delay(REQUEST_DELAY_MS);
      }
    }

    _emit({ phase: 'finished', synced, failed, total: queue.length });
    console.log(`[Sync] Done — ${synced} synced, ${failed} failed`);
    return { synced, failed, total: queue.length };

  } catch (err) {
    console.error('[Sync] syncAll error:', err);
    _emit({ phase: 'error', error: err.message });
    return { error: err.message };
  } finally {
    _syncInProgress = false;
  }
}

/* ─────────────── Auto-Sync Initializer ─────────────── */

/**
 * Set up automatic sync triggers:
 * - On window.ononline (network reconnect)
 * - On page load (if online and pending items exist)
 * - Every 60 seconds (periodic check)
 */
function initAutoSync() {
  // Trigger on network reconnect
  window.addEventListener('online', () => {
    console.log('[Sync] Back online — triggering sync...');
    _emit({ phase: 'online-detected' });
    syncAll().catch(console.error);
  });

  window.addEventListener('offline', () => {
    _emit({ phase: 'offline-detected' });
  });

  // Initial sync on page load (delayed to let app initialize)
  if (navigator.onLine) {
    setTimeout(() => {
      FacilityDB.getPendingCount().then((count) => {
        if (count > 0) {
          console.log(`[Sync] Page load: ${count} pending items, syncing...`);
          syncAll().catch(console.error);
        }
      });
    }, 2_000);
  }

  // Periodic sync every 60 seconds
  setInterval(() => {
    if (navigator.onLine && !_syncInProgress) {
      FacilityDB.getPendingCount().then((count) => {
        if (count > 0) {
          console.log(`[Sync] Periodic check: ${count} pending items`);
          syncAll().catch(console.error);
        }
      });
    }
  }, 60_000);

  // Listen for background-sync message from Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'BACKGROUND_SYNC_TRIGGERED') {
        console.log('[Sync] SW background sync triggered');
        syncAll().catch(console.error);
      }
    });
  }
}

/* ─────────────── Manual Retry ─────────────── */

/**
 * Reset all ERROR records back to PENDING_SYNC and trigger sync.
 */
async function retryAll() {
  const errored = await FacilityDB.getInspectionsByStatus('ERROR');
  for (const item of errored) {
    await FacilityDB.updateInspectionStatus(item.uuid, 'PENDING_SYNC', {
      retryCount:   0,
      errorMessage: null,
    });
  }
  if (errored.length > 0) {
    return syncAll();
  }
  return { synced: 0, failed: 0, total: 0 };
}

/* ─────────────── Helpers ─────────────── */

function _delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ─────────────── Exports ─────────────── */

window.FacilitySync = {
  syncAll,
  syncOne,
  retryAll,
  onSyncStateChange,
  initAutoSync,
};
