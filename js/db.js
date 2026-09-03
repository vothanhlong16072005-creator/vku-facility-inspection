/**
 * db.js — IndexedDB wrapper for Facility Inspection PWA
 * Stores: inspections (submissions) + draft (current form state)
 * Pure vanilla JS — no external library needed
 */

const DB_NAME    = 'FacilityInspectionDB';
const DB_VERSION = 1;
const STORE_INSPECTIONS = 'inspections';
const STORE_DRAFT       = 'draft';

let _db = null;

/* ─────────────── Open / Init ─────────────── */

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => {
      console.error('[DB] Open error:', req.error);
      reject(req.error);
    };

    req.onsuccess = () => {
      _db = req.result;
      _db.onversionchange = () => {
        _db.close();
        _db = null;
      };
      resolve(_db);
    };

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      // ── Inspections store ──
      if (!db.objectStoreNames.contains(STORE_INSPECTIONS)) {
        const store = db.createObjectStore(STORE_INSPECTIONS, {
          keyPath: 'uuid',
          autoIncrement: false,
        });
        store.createIndex('status',    'status',    { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('building',  'data.building', { unique: false });
      }

      // ── Draft store (single key-value) ──
      if (!db.objectStoreNames.contains(STORE_DRAFT)) {
        db.createObjectStore(STORE_DRAFT, { keyPath: 'key' });
      }
    };
  });
}

/* ─────────────── UUID Generator ─────────────── */

function generateUUID() {
  // RFC 4122 v4 UUID
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ─────────────── Draft Persistence ─────────────── */

/**
 * Save the current form draft to IndexedDB in real-time.
 * Called on every form `input` event to prevent data loss.
 */
async function saveDraft(formData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFT, 'readwrite');
    const store = tx.objectStore(STORE_DRAFT);
    const req = store.put({ key: 'current', data: formData, savedAt: new Date().toISOString() });
    req.onsuccess = () => resolve(true);
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Get the current draft from IndexedDB.
 */
async function getDraft() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFT, 'readonly');
    const store = tx.objectStore(STORE_DRAFT);
    const req = store.get('current');
    req.onsuccess = () => resolve(req.result ? req.result.data : null);
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Clear the current draft after successful submission.
 */
async function clearDraft() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFT, 'readwrite');
    const store = tx.objectStore(STORE_DRAFT);
    const req = store.delete('current');
    req.onsuccess = () => resolve(true);
    req.onerror   = () => reject(req.error);
  });
}

/* ─────────────── Inspections CRUD ─────────────── */

/**
 * Save a new inspection to IndexedDB with PENDING_SYNC status.
 * @param {Object} formData - The collected form data
 * @returns {Promise<Object>} The saved inspection record
 */
async function saveInspection(formData) {
  const db = await openDB();
  const now = new Date().toISOString();

  const inspection = {
    uuid:         generateUUID(),
    status:       'PENDING_SYNC',   // PENDING_SYNC | SYNCED | ERROR
    createdAt:    now,
    updatedAt:    now,
    syncedAt:     null,
    retryCount:   0,
    errorMessage: null,
    data:         formData,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_INSPECTIONS, 'readwrite');
    const store = tx.objectStore(STORE_INSPECTIONS);
    const req = store.add(inspection);
    req.onsuccess = () => resolve(inspection);
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Get all inspections sorted by createdAt DESC.
 */
async function getAllInspections() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_INSPECTIONS, 'readonly');
    const store = tx.objectStore(STORE_INSPECTIONS);
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result || [];
      records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(records);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get inspections filtered by status.
 * @param {'PENDING_SYNC'|'SYNCED'|'ERROR'} status
 */
async function getInspectionsByStatus(status) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_INSPECTIONS, 'readonly');
    const store = tx.objectStore(STORE_INSPECTIONS);
    const index = store.index('status');
    const req = index.getAll(status);
    req.onsuccess = () => {
      const records = req.result || [];
      records.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // FIFO
      resolve(records);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Count inspections with PENDING_SYNC status.
 */
async function getPendingCount() {
  try {
    const pending = await getInspectionsByStatus('PENDING_SYNC');
    const errored = await getInspectionsByStatus('ERROR');
    return pending.length + errored.length;
  } catch (err) {
    console.error('[DB] getPendingCount error:', err);
    return 0;
  }
}

/**
 * Get a single inspection by UUID.
 */
async function getInspection(uuid) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_INSPECTIONS, 'readonly');
    const store = tx.objectStore(STORE_INSPECTIONS);
    const req = store.get(uuid);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Update the status (and optionally other fields) of an inspection.
 * @param {string} uuid
 * @param {'PENDING_SYNC'|'SYNCED'|'ERROR'} status
 * @param {Object} extra - Additional fields to merge
 */
async function updateInspectionStatus(uuid, status, extra = {}) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_INSPECTIONS, 'readwrite');
    const store = tx.objectStore(STORE_INSPECTIONS);
    const getReq = store.get(uuid);

    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) {
        reject(new Error(`Inspection not found: ${uuid}`));
        return;
      }
      record.status    = status;
      record.updatedAt = new Date().toISOString();
      if (status === 'SYNCED') {
        record.syncedAt     = new Date().toISOString();
        record.errorMessage = null;
      }
      Object.assign(record, extra);

      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror   = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Delete an inspection by UUID.
 */
async function deleteInspection(uuid) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_INSPECTIONS, 'readwrite');
    const store = tx.objectStore(STORE_INSPECTIONS);
    const req = store.delete(uuid);
    req.onsuccess = () => resolve(true);
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Clear all inspections (debug only).
 */
async function clearAllInspections() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_INSPECTIONS, 'readwrite');
    const store = tx.objectStore(STORE_INSPECTIONS);
    const req = store.clear();
    req.onsuccess = () => resolve(true);
    req.onerror   = () => reject(req.error);
  });
}

/* ─────────────── Exports ─────────────── */

window.FacilityDB = {
  // Draft
  saveDraft,
  getDraft,
  clearDraft,
  // Inspections
  saveInspection,
  getAllInspections,
  getInspectionsByStatus,
  getPendingCount,
  getInspection,
  updateInspectionStatus,
  deleteInspection,
  clearAllInspections,
  // Utils
  generateUUID,
};
