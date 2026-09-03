/**
 * app.js — Main Application Controller (Single-page Industrial UI)
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════
     STATE
  ═══════════════════════════════════════════════════ */
  const state = {
    formData: {
      building:     '',
      floor:        '',
      room:         '',
      category:     '',
      deviceName:   '',
      deviceCode:   '',
      rating:       0,
      issueShort:   '',
      notes:        '',
      photoBase64:  '',
      geo:          '15.9753° N, 108.2532° E'
    },
    draftSaveTimer: null,
  };

  const RATING_TEXT = ['', 'Critical Failure', 'Substandard', 'Acceptable', 'Good', 'Optimal'];

  /* ═══════════════════════════════════════════════════
     DOM REFS
  ═══════════════════════════════════════════════════ */
  const $ = (id) => document.getElementById(id);
  const els = {
    statusBar:        $('statusBar'),
    statusIcon:       $('statusIcon'),
    statusText:       $('statusText'),
    draftSyncText:    $('draftSyncText'),
    
    // Form Inputs
    inputBuilding:    $('inputBuilding'),
    inputFloor:       $('inputFloor'),
    inputRoom:        $('inputRoom'),
    categoryGrid:     $('categoryGrid'),
    inputDeviceName:  $('inputDeviceName'),
    inputDeviceCode:  $('inputDeviceCode'),
    starRating:       $('starRating'),
    ratingValueText:  $('ratingValueText'),
    inputIssueShort:  $('inputIssueShort'),
    inputNotes:       $('inputNotes'),
    
    // Photo
    photoInputArea:   $('photoInputArea'),
    photoFileInput:   $('photoFileInput'),
    photoPlaceholder: $('photoPlaceholder'),
    photoPreviewContainer: $('photoPreviewContainer'),
    photoPreviewImg:  $('photoPreviewImg'),
    photoOverlayText: $('photoOverlayText'),
    photoRemoveBtn:   $('photoRemoveBtn'),
    
    // Submit
    btnSubmit:        $('btnSubmit'),
    btnSubmitText:    $('btnSubmitText'),
    
    // Navigation & Modals
    navBtns:          document.querySelectorAll('.nav-btn'),
    navBadge:         $('navBadge'),
    listModal:        $('listModal'),
    settingsModal:    $('settingsModal'),
    inputApiUrl:      $('inputApiUrl'),
    recordsList:      $('recordsList'),
    toastContainer:   $('toastContainer'),
  };

  /* ═══════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', async () => {
    bindEvents();
    
    // Restore draft
    try {
      const draft = await FacilityDB.getDraft();
      if (draft) {
        restoreFormFromDraft(draft);
      }
    } catch (err) {
      console.warn('[App] Could not restore draft:', err);
    }

    updateOnlineStatus();
    await refreshPendingCount();
    FacilitySync.initAutoSync();
    FacilitySync.onSyncStateChange(handleSyncState);
    registerSW();
  });

  /* ═══════════════════════════════════════════════════
     BIND EVENTS
  ═══════════════════════════════════════════════════ */
  function bindEvents() {
    // Taxonomy (Category) selection
    els.categoryGrid.querySelectorAll('.taxo-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.formData.category = btn.dataset.category;
        els.categoryGrid.querySelectorAll('.taxo-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        scheduleDraftSave();
      });
    });

    // Star Rating
    els.starRating.querySelectorAll('.star-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.value);
        state.formData.rating = val;
        updateStarUI(val);
        scheduleDraftSave();
      });
    });

    // Text Inputs (Live Draft)
    const liveInputs = [els.inputBuilding, els.inputFloor, els.inputRoom, els.inputDeviceName, els.inputDeviceCode, els.inputIssueShort, els.inputNotes];
    liveInputs.forEach((el) => {
      el.addEventListener('input', () => {
        state.formData[el.dataset.field] = el.value;
        scheduleDraftSave();
      });
    });

    // Photo Input
    els.photoFileInput.addEventListener('change', handlePhotoChange);
    els.photoRemoveBtn.addEventListener('click', removePhoto);

    // Submit
    els.btnSubmit.addEventListener('click', handleSubmit);

    // Navigation & Modals
    els.navBtns.forEach((btn) => {
      btn.addEventListener('click', () => handleNavClick(btn.dataset.view));
    });

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        $(btn.dataset.closeModal).classList.add('hidden');
        els.navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === 'form'));
      });
    });

    // Settings
    $('btnSaveSettings').addEventListener('click', () => {
      const url = els.inputApiUrl.value.trim();
      FacilityAPI.setApiUrl(url);
      showToast(url ? 'ENDPOINT SAVED' : 'ENDPOINT CLEARED', 'success');
    });
    $('btnClearData').addEventListener('click', async () => {
      if (!confirm('Purge all local storage? Cannot be undone.')) return;
      await FacilityDB.clearAllInspections();
      await FacilityDB.clearDraft();
      await refreshPendingCount();
      showToast('STORAGE PURGED', 'info');
    });
    $('btnRetryAll').addEventListener('click', async () => {
      showToast('FORCING SYNC...', 'info');
      await FacilitySync.retryAll();
    });

    // Network
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Modal Tabs
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderRecordsList(btn.dataset.filter);
      });
    });
  }

  function updateStarUI(val) {
    els.starRating.querySelectorAll('.star-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.value) <= val);
    });
    const label = RATING_TEXT[val] || 'Unrated';
    els.ratingValueText.textContent = `${val} / 5 (${label})`;
    els.ratingValueText.style.color = val > 0 && val <= 2 ? 'var(--accent-red)' : 'var(--text-main)';
  }

  /* ═══════════════════════════════════════════════════
     PHOTO
  ═══════════════════════════════════════════════════ */
  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('INVALID IMAGE', 'warning'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('IMAGE > 5MB', 'warning'); return; }

    const reader = new FileReader();
    reader.onload = (ev) => {
      state.formData.photoBase64 = ev.target.result;
      renderPhotoPreview();
      scheduleDraftSave();
    };
    reader.readAsDataURL(file);
  }

  function renderPhotoPreview() {
    if (state.formData.photoBase64) {
      els.photoPlaceholder.classList.add('hidden');
      els.photoPreviewContainer.classList.remove('hidden');
      els.photoPreviewImg.src = state.formData.photoBase64;
      
      const now = new Date();
      els.photoOverlayText.textContent = `${now.toISOString().replace('T',' ').substring(0,19)} ${state.formData.room || 'VKU'}`;
    } else {
      els.photoPlaceholder.classList.remove('hidden');
      els.photoPreviewContainer.classList.add('hidden');
      els.photoPreviewImg.src = '';
    }
  }

  function removePhoto() {
    state.formData.photoBase64 = '';
    els.photoFileInput.value = '';
    renderPhotoPreview();
    scheduleDraftSave();
  }

  /* ═══════════════════════════════════════════════════
     DRAFT
  ═══════════════════════════════════════════════════ */
  function scheduleDraftSave() {
    clearTimeout(state.draftSaveTimer);
    els.draftSyncText.textContent = 'Draft sync: Saving...';
    state.draftSaveTimer = setTimeout(async () => {
      await FacilityDB.saveDraft({ ...state.formData });
      els.draftSyncText.textContent = 'Draft sync: Just now';
    }, 500);
  }

  function restoreFormFromDraft(data) {
    Object.assign(state.formData, data);
    els.inputBuilding.value = data.building || '';
    els.inputFloor.value = data.floor || '';
    els.inputRoom.value = data.room || '';
    els.inputDeviceName.value = data.deviceName || '';
    els.inputDeviceCode.value = data.deviceCode || '';
    els.inputIssueShort.value = data.issueShort || '';
    els.inputNotes.value = data.notes || '';
    
    if (data.category) {
      els.categoryGrid.querySelectorAll('.taxo-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.category === data.category);
      });
    }
    updateStarUI(data.rating || 0);
    renderPhotoPreview();
    els.draftSyncText.textContent = 'Draft sync: Restored';
  }

  /* ═══════════════════════════════════════════════════
     SUBMIT
  ═══════════════════════════════════════════════════ */
  async function handleSubmit() {
    // Validate
    if (!state.formData.building) { showToast('Missing Building', 'error'); return els.inputBuilding.focus(); }
    if (!state.formData.room) { showToast('Missing Location', 'error'); return els.inputRoom.focus(); }
    if (!state.formData.category) { showToast('Missing Taxonomy', 'error'); return; }

    els.btnSubmit.disabled = true;
    els.btnSubmitText.innerHTML = '<span class="spinner"></span> COMMITTING...';

    try {
      // 1. Luôn lưu vào máy trước (trạng thái PENDING_SYNC) để đảm bảo không mất dữ liệu
      const inspection = await FacilityDB.saveInspection({ ...state.formData });
      
      // Xóa draft
      await FacilityDB.clearDraft();
      resetForm();

      // 2. Nếu có mạng thì tự động đồng bộ ngay
      if (navigator.onLine && FacilityAPI.isApiConfigured()) {
        els.btnSubmitText.innerHTML = '<span class="spinner"></span> DIRECT SYNC...';
        const result = await FacilitySync.syncOne(inspection);
        
        if (result.success) {
          showToast('DIRECT SYNC SUCCESS', 'success');
        } else {
          showToast('SYNC FAILED - SAVED LOCALLY', 'warning');
        }
      } else {
        showToast('SAVED TO LOCAL IDB', 'info');
      }

      await refreshPendingCount();
    } catch (err) {
      showToast('ERROR: ' + err.message, 'error');
    } finally {
      els.btnSubmit.disabled = false;
      els.btnSubmitText.textContent = 'COMMIT TO LOCAL STORE';
    }
  }

  function resetForm() {
    state.formData = { building: '', floor: '', room: '', category: '', deviceName: '', deviceCode: '', rating: 0, issueShort: '', notes: '', photoBase64: '', geo: state.formData.geo };
    els.inputBuilding.value = ''; els.inputFloor.value = ''; els.inputRoom.value = ''; 
    els.inputDeviceName.value = ''; els.inputDeviceCode.value = ''; 
    els.inputIssueShort.value = ''; els.inputNotes.value = '';
    els.categoryGrid.querySelectorAll('.taxo-btn').forEach(b => b.classList.remove('active'));
    updateStarUI(0);
    removePhoto();
    els.draftSyncText.textContent = 'Draft sync: Cleared';
  }

  /* ═══════════════════════════════════════════════════
     NETWORK & SYNC
  ═══════════════════════════════════════════════════ */
  function updateOnlineStatus() {
    const online = navigator.onLine;
    els.statusBar.className = `status-bar ${online ? 'online' : 'offline'}`;
    els.statusIcon.textContent = online ? '🌐' : '✈️';
    els.statusText.textContent = online ? 'ONLINE • DIRECT SYNC ACTIVE' : 'AIRPLANE / DISCONNECTED • SW CACHE';
  }

  async function refreshPendingCount() {
    const count = await FacilityDB.getPendingCount();
    if (count > 0) {
      els.navBadge.textContent = count;
      els.navBadge.classList.remove('hidden');
    } else {
      els.navBadge.classList.add('hidden');
    }
  }

  function handleSyncState(st) {
    if (st.phase === 'started') {
      els.statusIcon.textContent = '🔄';
      els.statusText.textContent = 'SYNC IN PROGRESS...';
    } else if (st.phase === 'finished') {
      updateOnlineStatus();
      refreshPendingCount();
      if (st.synced > 0) showToast(`${st.synced} RECORDS SYNCED`, 'success');
    } else {
      updateOnlineStatus();
      refreshPendingCount();
    }
  }

  /* ═══════════════════════════════════════════════════
     LIST & MODALS
  ═══════════════════════════════════════════════════ */
  function handleNavClick(view) {
    els.navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === view));
    
    if (view === 'list') {
      els.listModal.classList.remove('hidden');
      renderRecordsList('all');
    } else if (view === 'settings') {
      els.inputApiUrl.value = FacilityAPI.getApiUrl();
      els.settingsModal.classList.remove('hidden');
    } else {
      els.listModal.classList.add('hidden');
      els.settingsModal.classList.add('hidden');
    }
  }

  async function renderRecordsList(filter) {
    els.recordsList.innerHTML = '';
    let records = [];
    
    if (filter === 'pending') {
      const p = await FacilityDB.getInspectionsByStatus('PENDING_SYNC');
      const e = await FacilityDB.getInspectionsByStatus('ERROR');
      records = [...p, ...e];
    } else if (filter === 'synced') {
      records = await FacilityDB.getInspectionsByStatus('SYNCED');
    } else {
      records = await FacilityDB.getAllInspections();
    }

    if (!records.length) {
      els.recordsList.innerHTML = `<div class="empty-state">NO RECORDS FOUND</div>`;
      return;
    }

    els.recordsList.innerHTML = records.map(rec => {
      const d = rec.data;
      const date = new Date(rec.createdAt).toLocaleString();
      const stars = '★'.repeat(d.rating||0) + '☆'.repeat(5-(d.rating||0));
      return `
        <div class="record-card">
          <div class="record-status ${rec.status}">${rec.status}</div>
          <div class="record-title">${d.category||'N/A'} - ${d.room||'Unknown'}</div>
          <div class="record-meta">${d.building||''}</div>
          <div class="record-meta" style="color:var(--accent-yellow)">${stars}</div>
          <div class="record-meta">${date}</div>
          ${rec.status !== 'SYNCED' ? `
            <button type="button" class="btn-submit" data-action="sync" data-uuid="${rec.uuid}" style="height:24px; font-size:10px; margin-top:8px;">FORCE SYNC</button>
          ` : ''}
        </div>
      `;
    }).join('');

    els.recordsList.querySelectorAll('[data-action="sync"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const item = await FacilityDB.getInspection(btn.dataset.uuid);
        if (item) {
          btn.innerHTML = '...';
          await FacilitySync.syncOne(item);
          renderRecordsList(document.querySelector('.tab-btn.active').dataset.filter);
          refreshPendingCount();
        }
      });
    });
  }

  /* ═══════════════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════════════ */
  function showToast(msg, type='info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = msg;
    els.toastContainer.appendChild(t);
    setTimeout(() => { t.style.opacity=0; setTimeout(()=>t.remove(),300); }, 3000);
  }

  function registerSW() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }

})();
