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

  /* ── DOM refs ──
     Native HTML elements (always present): grabbed once.
     Shell-injected elements (arrive after feature-shell.js runs):
     accessed via lazy getters so null-at-parse-time is never an issue.
  ── */
  const infoDiv   = document.getElementById('info-container');
  const mainDiv   = document.getElementById('main-container');
  const fileInput = document.getElementById('file-input');

  // Lazy getters for shell-bar elements injected asynchronously
  const getClearBtn = () => document.getElementById('clearStorageBtn');
  const getDot      = () => document.getElementById('status-dot');
  const getTxt      = () => document.getElementById('status-text');

  /* ────────────────────────────────────────
     Visibility helpers
  ──────────────────────────────────────── */
  function updateVisibility() {
    const has       = !!localStorage.getItem('csvData');
    const clearBtn  = getClearBtn();
    const dot       = getDot();
    const txt       = getTxt();
    if (clearBtn) clearBtn.style.display = has ? 'inline-flex' : 'none';
    infoDiv.style.display  = has ? 'none'  : 'block';
    mainDiv.style.display  = has ? 'block' : 'none';
    if (has) {
      if (dot) dot.classList.add('green');
      const fname = localStorage.getItem('uploadedFileName') || 'File loaded';
      if (txt) txt.textContent = 'Uploaded - ' + fname;
      const fnEl = document.getElementById('loaded-filename');
      if (fnEl) fnEl.textContent = fname;
    } else {
      if (dot) dot.classList.remove('green');
      if (txt) txt.textContent = 'No file loaded — upload to begin';
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
  window._kmcUpdateVisibility = updateVisibility;

  updateVisibility();
  updateTabBar();

  /* ────────────────────────────────────────
     Clear storage button
     Bound via MutationObserver-friendly helper
     since the button is injected by feature-shell.js
  ──────────────────────────────────────── */
  function _bindClearBtn(btn) {
    if (!btn || btn._kmcHomeBound) return;
    btn._kmcHomeBound = true;
    btn.addEventListener('click', () => {
    if (typeof window._kmcClearData === 'function') { window._kmcClearData(); return; }
    localStorage.clear();
      // Strip ?uploadId= / ?view=1 from URL so auto-load doesn't re-fire
      if (window.location.search) {
        history.replaceState(null, '', window.location.pathname);
      }
      const dot = getDot(), txt = getTxt();
      if (dot) dot.classList.remove('green');
      if (txt) txt.textContent = 'No file loaded — upload to begin';
      const fnEl = document.getElementById('loaded-filename');
      if (fnEl) fnEl.textContent = '';
      _clearTable();
      const zone = document.getElementById('uploadZone');
      if (zone) zone.classList.remove('has-file', 'drag-over');
      fileInput.value = '';
      updateVisibility();
      if (typeof resetTabUnlocks === 'function') resetTabUnlocks();
      else updateTabBar();
      _clearMasterDOM();
      if (typeof switchTab === 'function') switchTab('section-home');
    });
  }

  // Try to bind immediately (shell may already be ready)
  _bindClearBtn(getClearBtn());

  // Also watch for it arriving later
  new MutationObserver(() => _bindClearBtn(getClearBtn()))
    .observe(document.body, { childList: true, subtree: true });

  /* ────────────────────────────────────────
     File input change
  ──────────────────────────────────────── */
  fileInput.addEventListener('change', () => {
    if (!fileInput.files[0]) return;
    const clearBtn = getClearBtn(), dot = getDot(), txt = getTxt();
    infoDiv.style.display  = 'none';
    if (clearBtn) clearBtn.style.display = 'inline-flex';
    mainDiv.style.display  = 'block';
    if (dot) dot.classList.add('green');
    const fname = fileInput.files[0].name;
    localStorage.setItem('uploadedFileName', fname);
    if (txt) txt.textContent = 'Uploaded - ' + fname;
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
     Wraps the original so we can:
     1. Unlock tabs after parse completes
     2. Re-call the active tab's generate function
        so data shows immediately on first tab click
        without needing a second click.
  ──────────────────────────────────────── */
  const KMC_TAB_FN = {
    'section-tables':    'generateTables',
    'section-filtered':  'generateFilteredTables',
    'section-sanction':  'generateSanctionTables',
    'section-parking':   'generateParkingTables',
    'section-occupancy': 'initOccupancy',
    'section-master':    'generateMasterTable'
  };

  const _origDD = window.displayData;
  window.displayData = function (csv) {
    if (typeof _origDD === 'function') _origDD(csv);
    // csvData is now in localStorage — unlock tabs
    _showTabs(true);
    // Re-call the active tab's generate function so data renders
    // immediately without needing a second click
    var activeBtn = document.querySelector('.tab-btn.active');
    if (activeBtn) {
      var activeTab = activeBtn.getAttribute('data-tab');
      var fn = KMC_TAB_FN[activeTab];
      if (fn && typeof window[fn] === 'function') {
        window[fn]();
      }
    }
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