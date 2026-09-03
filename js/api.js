/**
 * api.js — Google Sheets API layer for Facility Inspection PWA
 * Sends inspection data to Google Apps Script Web App endpoint
 *
 * Pattern: GET with query params + mode:'no-cors' to bypass CORS
 * (Apps Script does not support CORS preflight for POST with JSON body)
 */

// ── Default URL (replace after deploying Apps Script) ──
const DEFAULT_API_URL = '';   // e.g. 'https://script.google.com/macros/s/YOUR_ID/exec'

const API_CONFIG = {
  url:     localStorage.getItem('facilityApiUrl') || DEFAULT_API_URL,
  timeout: 30_000, // 30 seconds
};

/* ─────────────── URL Management ─────────────── */

function setApiUrl(url) {
  API_CONFIG.url = url.trim();
  localStorage.setItem('facilityApiUrl', API_CONFIG.url);
}

function getApiUrl() {
  return API_CONFIG.url;
}

function isApiConfigured() {
  return Boolean(API_CONFIG.url && API_CONFIG.url.startsWith('https://script.google.com'));
}

/* ─────────────── Push Inspection ─────────────── */

/**
 * Push one inspection to Google Sheets via Apps Script GET endpoint.
 * Uses no-cors mode so we can't read the response body, but the request
 * will reach the server if the network is up.
 *
 * @param {Object} inspection - Full inspection record from IndexedDB
 * @returns {Promise<{success: boolean, uuid: string}>}
 */
async function pushInspection(inspection) {
  if (!isApiConfigured()) {
    throw new Error(
      'Chưa cấu hình Google Apps Script URL. Vào ⚙️ Cài đặt để thiết lập.'
    );
  }

  if (!inspection || !inspection.data) {
    throw new Error('Dữ liệu kiểm tra không hợp lệ.');
  }

  const d = inspection.data;

  // Build query params — avoid sending large base64 photo via GET
  const photoFlag = d.photoBase64 ? 'yes' : 'no';

  const params = new URLSearchParams({
    action:      'addInspection',
    uuid:        inspection.uuid || String(Date.now()),
    timestamp:   inspection.createdAt || new Date().toISOString(),
    geo:         d.geo       || '',
    building:    d.building  || '',
    floor:       String(d.floor || ''),
    room:        d.room      || '',
    category:    d.category  || '',
    deviceName:  d.deviceName || '',
    deviceCode:  d.deviceCode || '',
    rating:      String(d.rating || 0),
    issueShort:  d.issueShort || '',
    notes:       d.notes     || '',
    hasPhoto:    photoFlag,
  });

  const fullUrl = `${API_CONFIG.url}?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), API_CONFIG.timeout);

  try {
    // no-cors: response type = 'opaque' — can't read body but request goes through
    const response = await fetch(fullUrl, {
      method: 'GET',
      mode:   'no-cors',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // opaque response = request reached server (treat as success)
    return { success: true, uuid: inspection.uuid };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timeout — kiểm tra kết nối mạng.');
    }
    throw err;
  }
}

/* ─────────────── Ping / Health Check ─────────────── */

/**
 * Quick connectivity check against the Apps Script endpoint.
 * Returns true if reachable (opaque response from no-cors).
 */
async function pingApi() {
  if (!isApiConfigured()) return false;

  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 8_000);

    const response = await fetch(`${API_CONFIG.url}?action=ping`, {
      method: 'GET',
      mode:   'no-cors',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.type === 'opaque';
  } catch {
    return false;
  }
}

/* ─────────────── Exports ─────────────── */

window.FacilityAPI = {
  setApiUrl,
  getApiUrl,
  isApiConfigured,
  pushInspection,
  pingApi,
};
