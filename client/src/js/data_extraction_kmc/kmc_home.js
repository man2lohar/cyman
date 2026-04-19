/* ══════════════════════════════════════════
   kmc_home.js  —  Home tab logic
   Lazy-loaded on first click of the Home tab.
   Handles:
   • File upload & drag-drop
   • localStorage visibility (show/hide data card)
   • Sequential tab unlock via kmcTabDone / applyTabStates
   • Error modal (Check Errors button)
   • Patch: scrollToTableRowAndBlink
   • Patch: displayData (triggers tab unlock after parse)
   • Instruction overlay
══════════════════════════════════════════ */

(function initHome() {

  /* ── DOM refs ── */
  const clearBtn  = document.getElementById('clearStorageBtn');
  const infoDiv   = document.getElementById('info-container');
  const mainDiv   = document.getElementById('main-container');
  const fileInput = document.getElementById('file-input');
  const dot       = document.getElementById('status-dot');
  const txt       = document.getElementById('status-text');

  /* ────────────────────────────────────────
     Visibility helpers
  ──────────────────────────────────────── */
  function updateVisibility() {
    const has = !!localStorage.getItem('csvData');
    clearBtn.style.display = has ? 'inline-flex' : 'none';
    infoDiv.style.display  = has ? 'none'        : 'block';
    mainDiv.style.display  = has ? 'block'       : 'none';
    if (has) {
      dot.classList.add('green');
      const fname = localStorage.getItem('uploadedFileName') || 'File loaded';
      txt.textContent = fname;
      const fnEl = document.getElementById('loaded-filename');
      if (fnEl) fnEl.textContent = fname;
    } else {
      dot.classList.remove('green');
      txt.textContent = 'No file loaded — upload to begin';
      _clearTable();
    }
  }

  /**
   * _showTabs — directly shows all non-home tab buttons
   * and calls applyTabStates for lock/unlock rendering.
   * Called immediately on file upload — no page refresh needed.
   * Pass forceHasData=true to show tabs even before csvData
   * reaches localStorage (e.g. right after file-input change).
   */
  function _showTabs(forceHasData) {
    // Make all non-home tab buttons visible immediately
    const allTabBtns = document.querySelectorAll('.tab-btn:not([data-tab="section-home"])');
    allTabBtns.forEach(btn => { btn.style.display = ''; });
    // Then let core apply lock/unlock state
    if (typeof applyTabStates === 'function') applyTabStates(forceHasData);
  }

  /**
   * updateTabBar — delegates to _showTabs / applyTabStates,
   * and navigates back to Home if data was cleared on another tab.
   */
  function updateTabBar() {
    const has = !!localStorage.getItem('csvData');
    if (!has) {
      const dataTabs = [
        'section-tables','section-filtered','section-sanction',
        'section-parking','section-occupancy','section-master'
      ];
      dataTabs.forEach(id => {
        const sec = document.getElementById(id);
        if (sec && sec.classList.contains('active') && typeof switchTab === 'function') {
          switchTab('section-home');
        }
      });
    }
    if (typeof applyTabStates === 'function') applyTabStates();
  }

  function _clearTable() {
    const tbl = document.getElementById('data-table');
    if (!tbl) return;
    const hdr  = tbl.querySelector('#table-header');
    const body = tbl.querySelector('tbody');
    if (hdr)  hdr.innerHTML  = '';
    if (body) body.innerHTML = '';
  }

  function _clearMasterDOM() {
    // List of all cell IDs used in the master / Final Summary tab
    const masterCellIds = [
      'roadwidth','pro-height','per-height',
      'land-area','land-area-doc',
      'pro-ground-coverage','per-ground-coverage',
      'pro-front','pro-side1','pro-side2','pro-rear',
      'per-front','per-side1','per-side2','per-rear',
      'pro-park-area','per-park-area',
      'pro-car','per-car',
      'pro-far','per-far',
      'pro-tree','per-tree',
      'pro-cb','per-cb',
      'total-floor','additional-floor','total-fees-area',
      'usegroup',
    ];
    masterCellIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = '';
        el.classList.remove('text-red');
      }
    });
    // Also hide the master popup if open
    const popup = document.getElementById('master-popup');
    if (popup) popup.style.display = 'none';
    // Reset initMasterTab so it re-runs fresh on next visit,
    // and clear the lazy-loader cache so the script is re-fetched
    window.initMasterTab = null;
    if (typeof _loadedScripts !== 'undefined') {
      Object.keys(_loadedScripts).forEach(k => {
        if (k.includes('kmc_master')) delete _loadedScripts[k];
      });
    }
  }

  // Expose so displayData patch can call it
  window._kmcTabRefresh = updateTabBar;

  updateVisibility();
  updateTabBar();

  /* ────────────────────────────────────────
     Clear storage button
  ──────────────────────────────────────── */
  clearBtn.addEventListener('click', () => {
    if (!confirm('Clear all local data? This cannot be undone.')) return;
    localStorage.clear();
    dot.classList.remove('green');
    txt.textContent = 'No file loaded — upload to begin';
    const fnEl = document.getElementById('loaded-filename');
    if (fnEl) fnEl.textContent = '';
    _clearTable();
    const zone = document.getElementById('uploadZone');
    if (zone) zone.classList.remove('has-file', 'drag-over');
    fileInput.value = '';
    updateVisibility();
    // Reset sequential unlock state
    if (typeof resetTabUnlocks === 'function') resetTabUnlocks();
    else updateTabBar();
    // Clear master tab DOM so stale values don't show after clear
    _clearMasterDOM();
    // Switch back to Home tab
    if (typeof switchTab === 'function') switchTab('section-home');
  });

  /* ────────────────────────────────────────
     File input change
  ──────────────────────────────────────── */
  fileInput.addEventListener('change', () => {
    if (!fileInput.files[0]) return;
    infoDiv.style.display  = 'none';
    clearBtn.style.display = 'inline-flex';
    mainDiv.style.display  = 'block';
    dot.classList.add('green');
    const fname = fileInput.files[0].name;
    localStorage.setItem('uploadedFileName', fname);
    txt.textContent = fname;
    const fnEl = document.getElementById('loaded-filename');
    if (fnEl) fnEl.textContent = fname;
    document.getElementById('uploadZone').classList.add('has-file');
    // Apply tab states immediately — pass true so tabs show before csvData is stored
    _showTabs(true);
  });

  /* ────────────────────────────────────────
     Upload zone — click & drag-drop
  ──────────────────────────────────────── */
  const zone = document.getElementById('uploadZone');
  if (zone) {
    zone.addEventListener('click', e => {
      if (e.target.id !== 'file-input') fileInput.click();
    });
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', e => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (!f) return;
      if (typeof window.processFile === 'function') {
        window.processFile(f);
      } else {
        const dt = new DataTransfer();
        dt.items.add(f);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change'));
      }
    });
  }

  /* ────────────────────────────────────────
     Error modal
  ──────────────────────────────────────── */
  const errorModal = document.getElementById('errorModal');
  if (errorModal) {
    const observer = new MutationObserver(() => {
      if (errorModal.style.display &&
          errorModal.style.display !== 'none' &&
          !errorModal.classList.contains('show')) {
        errorModal.style.display = 'none';
      }
    });
    observer.observe(errorModal, { attributes: true, attributeFilter: ['style'] });
  }

  const modalClose = document.getElementById('modalClose');
  if (modalClose) {
    modalClose.addEventListener('click', () => {
      errorModal.classList.remove('show');
      errorModal.style.display = 'none';
    });
  }

  const checkBtn = document.getElementById('checkErrorsBtn');
  if (checkBtn) {
    checkBtn.addEventListener('click', () => {
      const body = document.getElementById('modalBody');
      if (body && body.innerHTML.trim() !== '') {
        errorModal.classList.add('show');
      } else {
        body.innerHTML = '<span style="color:var(--green);font-weight:600;">✔ No errors detected in uploaded data.</span>';
        errorModal.classList.add('show');
      }
    });
  }

  /* ────────────────────────────────────────
     Patch: scrollToTableRowAndBlink
  ──────────────────────────────────────── */
  const _origBlink = window.scrollToTableRowAndBlink;
  window.scrollToTableRowAndBlink = function (rowNumber) {
    if (errorModal) {
      errorModal.classList.remove('show');
      errorModal.style.removeProperty('display');
    }
    if (typeof switchTab === 'function') switchTab('section-home');
    if (typeof _origBlink === 'function') {
      setTimeout(() => _origBlink(rowNumber), 120);
    }
  };

  /* ────────────────────────────────────────
     Patch: displayData
     Wraps the original so we can call
     kmcTabDone('section-home') after data
     is stored → unlocks Layer Tables tab.
  ──────────────────────────────────────── */
  const _origDD = window.displayData;
  window.displayData = function (csv) {
    if (typeof _origDD === 'function') _origDD(csv);
    // csvData is now in localStorage — show and unlock tabs immediately
    _showTabs(true);
  };

})(); // end initHome

/* ──────────────────────────────────────────
   INSTRUCTION OVERLAY
────────────────────────────────────────── */
function handleOverlayClick(e) {
  if (e.target === document.getElementById('instrOverlay'))
    document.getElementById('instrOverlay').classList.remove('active');
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const ov = document.getElementById('instrOverlay');
    if (ov) ov.classList.remove('active');
  }
});
