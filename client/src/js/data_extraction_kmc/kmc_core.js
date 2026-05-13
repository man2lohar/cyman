/* ══════════════════════════════════════════
   kmc_core.js  —  Shared infrastructure
   • Sticky offset calculator
   • SVG background builder
   • Lazy-loading tab switcher
   • Sequential tab unlock system
   • Scroll-to-top button
══════════════════════════════════════════ */

/* ──────────────────────────────────────────
   STICKY OFFSET CALCULATOR
────────────────────────────────────────── */
function recalcStickyOffsets() {
  const root = document.documentElement;

  /* ── 1. Find the outer shell/frame header (fixed or sticky) ── */
  const shellSelectors = [
    /* CyManSquare feature-shell patterns */
    '.cym-header','#cym-header',
    '.feature-shell-header','[class*="shell-header"]','[class*="shellHeader"]',
    '.app-header','#app-header',
    '.site-header','#site-header',
    'header.shell','nav.shell',
    '[data-role="shell-header"]',
    /* generic top nav patterns */
    'header[class]','nav[class]',
  ];
  let shellH = 0;
  for (const sel of shellSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const pos = getComputedStyle(el).position;
      if (pos === 'fixed' || pos === 'sticky') {
        shellH = el.getBoundingClientRect().height;
        break;
      }
    }
  }

  /* ── 2. Fallback: measure how far .app-wrapper is from viewport top ── */
  if (shellH === 0) {
    const appWrapper = document.querySelector('.app-wrapper');
    if (appWrapper) {
      const rect = appWrapper.getBoundingClientRect();
      if (rect.top > 0) shellH = rect.top;
    }
  }

  root.style.setProperty('--shell-h', shellH + 'px');

  /* ── 3. Measure topbar and tab-bar ── */
  const topbar  = document.querySelector('.topbar');
  const tabbar  = document.querySelector('.tab-bar');
  const topbarH = topbar  ? topbar.getBoundingClientRect().height  : 0;
  const tabbarH = tabbar  ? tabbar.getBoundingClientRect().height  : 0;

  root.style.setProperty('--topbar-bottom', (shellH + topbarH) + 'px');
  root.style.setProperty('--thead-top',     (shellH + topbarH + tabbarH) + 'px');
}

window.addEventListener('DOMContentLoaded', () => {
  recalcStickyOffsets();
  setTimeout(recalcStickyOffsets, 80);
  setTimeout(recalcStickyOffsets, 300);
  setTimeout(recalcStickyOffsets, 800);

  // Watch topbar height changes (font load, reflow) for pixel-perfect gap fix
  const topbarEl = document.querySelector('.topbar');
  if (topbarEl && window.ResizeObserver) {
    new ResizeObserver(recalcStickyOffsets).observe(topbarEl);
  }
  // Also watch the shell header if it exists
  const shellEl = document.querySelector(
    '.cym-header,#cym-header,.feature-shell-header,[class*="shell-header"],header[class],nav[class]'
  );
  if (shellEl && window.ResizeObserver) {
    new ResizeObserver(recalcStickyOffsets).observe(shellEl);
  }
});
window.addEventListener('resize', recalcStickyOffsets);
window.addEventListener('load', recalcStickyOffsets);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(recalcStickyOffsets);
}

/* ──────────────────────────────────────────
   SVG BACKGROUND BUILDER
────────────────────────────────────────── */
(function buildBg() {
  const glg = document.getElementById('gridLines');
  const geo = document.getElementById('geoShapes');
  if (!glg || !geo) return;
  const W  = window.innerWidth;
  const H  = window.innerHeight;
  const ns = 'http://www.w3.org/2000/svg';

  function mkLine(x1, y1, x2, y2, op) {
    const l = document.createElementNS(ns, 'line');
    [['x1',x1],['y1',y1],['x2',x2],['y2',y2],
     ['stroke','#2d98fd'],['stroke-opacity',op]
    ].forEach(([k, v]) => l.setAttribute(k, v));
    return l;
  }
  for (let x = 0; x < W; x += 80) glg.appendChild(mkLine(x, 0, x, H, '.03'));
  for (let y = 0; y < H; y += 80) glg.appendChild(mkLine(0, y, W, y, '.03'));

  const shapes = [
    { t:'polygon', p:`${W*.15},${H*.2} ${W*.15+40},${H*.2-60} ${W*.15+80},${H*.2}`, op:.06 },
    { t:'polygon', p:`${W*.82},${H*.15} ${W*.82+50},${H*.15-70} ${W*.82+100},${H*.15}`, op:.05 },
    { t:'rect',    x:W*.4, y:H*.7, w:60, h:60, r:8, op:.04 },
    { t:'circle',  cx:W*.65, cy:H*.3, r:40, op:.05 },
    { t:'polygon', p:`${W*.05},${H*.75} ${W*.05+35},${H*.75-50} ${W*.05+70},${H*.75}`, op:.04 },
  ];
  shapes.forEach(s => {
    let c;
    if (s.t === 'polygon') {
      c = document.createElementNS(ns, 'polygon');
      c.setAttribute('points', s.p);
    } else if (s.t === 'rect') {
      c = document.createElementNS(ns, 'rect');
      [['x',s.x],['y',s.y],['width',s.w],['height',s.h],['rx',s.r]].forEach(([k,v]) => c.setAttribute(k,v));
    } else {
      c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', s.cx); c.setAttribute('cy', s.cy); c.setAttribute('r', s.r);
    }
    c.setAttribute('fill', 'none');
    c.setAttribute('stroke', '#2d98fd');
    c.setAttribute('stroke-opacity', s.op);
    if (Math.random() > .5) c.classList.add('geo-anim');
    geo.appendChild(c);
  });
})();

/* ──────────────────────────────────────────
   LAZY SCRIPT LOADER
────────────────────────────────────────── */
const _loadedScripts = {};
window._kmc_loadedScripts = _loadedScripts;

function loadScript(src, onload) {
  if (_loadedScripts[src] === true) { if (onload) onload(); return; }
  if (_loadedScripts[src] === 'loading') {
    _loadedScripts[src + '_q'] = _loadedScripts[src + '_q'] || [];
    _loadedScripts[src + '_q'].push(onload);
    return;
  }
  _loadedScripts[src] = 'loading';
  const s = document.createElement('script');
  s.setAttribute('data-kmc', src);
  s.src = src;
  s.onload = function() {
    _loadedScripts[src] = true;
    (_loadedScripts[src + '_q'] || []).forEach(function(fn) { if (fn) fn(); });
    _loadedScripts[src + '_q'] = [];
    if (onload) onload();
  };
  s.onerror = function() { delete _loadedScripts[src]; };
  document.body.appendChild(s);
}

function loadScriptsSequential(scripts, callback) {
  function next(i) {
    if (i >= scripts.length) { if (callback) callback(); return; }
    loadScript(scripts[i], () => next(i + 1));
  }
  next(0);
}

/* ──────────────────────────────────────────
   TAB SCRIPTS MAP
────────────────────────────────────────── */
const TAB_SCRIPTS = {
  'section-home':      ['../../../src/js/data_extraction_kmc/kmc_home.js'],
  'section-tables':    ['../../../src/js/data_extraction_kmc/kmc_tables.js'],
  'section-filtered':  ['../../../src/js/data_extraction_kmc/kmc_filtered.js'],
  'section-sanction':  ['../../../src/js/data_extraction_kmc/kmc_sanction.js'],
  'section-parking':   ['../../../src/js/data_extraction_kmc/kmc_parking.js'],
  'section-occupancy': ['../../../src/js/data_extraction_kmc/kmc_occupancy.js'],
  'section-master':    ['../../../src/js/data_extraction_kmc/kmc_master.js'],
};

/* ══════════════════════════════════════════════════════════
   SEQUENTIAL TAB UNLOCK SYSTEM
   ─────────────────────────────────────────────────────────
   Workflow order:
     Home → Layer Tables → Filtered Tables → Floor Area →
     Parking → Occupancy → Final Summary

   Simple rule:
   • No file loaded  → all tabs hidden except Home.
   • File loaded     → all tabs visible. Layer Tables is
                       enabled immediately. Every other tab
                       starts DISABLED (locked).
   • Clicking a tab  → automatically unlocks the NEXT tab
                       in the pipeline.
   • Visited tabs keep a ✓ badge; locked tabs show 🔒.
   • Unlock level persists in localStorage (survives reload).
   • Clearing data resets everything back to start.
══════════════════════════════════════════════════════════ */

const TAB_PIPELINE = [
  'section-home',
  'section-tables',
  'section-filtered',
  'section-sanction',
  'section-parking',
  'section-occupancy',
  'section-master',
];

const UNLOCK_KEY = 'kmcTabsUnlocked';

function getUnlockLevel() {
  // level = number of tabs unlocked from the start of the pipeline
  // minimum 2: Home + Layer Tables always unlocked once data is loaded
  return Math.max(2, parseInt(localStorage.getItem(UNLOCK_KEY) || '2', 10));
}

/** Unlock the next tab after the given one was clicked.
 *  Special case: section-master is NEVER auto-unlocked by tab click —
 *  it can only be unlocked explicitly via kmcProceedToFinalSummary().
 */
function _unlockNext(clickedId) {
  const idx     = TAB_PIPELINE.indexOf(clickedId);
  if (idx < 0) return;
  const nextId    = TAB_PIPELINE[idx + 1];
  // Final Summary must only be unlocked via the Proceed button — never automatically
  if (nextId === 'section-master') return;
  const nextLevel = idx + 2;
  if (nextLevel > getUnlockLevel()) {
    localStorage.setItem(UNLOCK_KEY, String(nextLevel));
  }
  applyTabStates();
}

/** Apply visual lock / unlock state to all tab buttons */
function applyTabStates(forceHasData) {
  if (forceHasData) localStorage.setItem('_tabsUnlocked', '1');
  const hasData = !!localStorage.getItem('csvData') || !!localStorage.getItem('_tabsUnlocked');
  const level   = getUnlockLevel();

  TAB_PIPELINE.forEach((sectionId, idx) => {
    const btn = document.querySelector(`.tab-btn[data-tab="${sectionId}"]`);
    if (!btn) return;

    // Home — always visible, always enabled, no badge
    if (sectionId === 'section-home') {
      btn.style.display = '';
      btn.disabled = false;
      btn.classList.remove('tab-locked');
      _removeBadge(btn);
      return;
    }

    if (!hasData) {
      // No file yet — hide all non-home tabs
      btn.style.display = 'none';
      btn.disabled = true;
      btn.classList.remove('tab-locked');
      _removeBadge(btn);
      return;
    }

    // Final Summary — ONLY unlocked via the Proceed button, never by sequential flow
    if (sectionId === 'section-master') {
      const masterUnlocked = localStorage.getItem('_masterUnlocked') === '1';
      btn.style.display = masterUnlocked ? '' : '';   // always show the tab slot
      btn.disabled      = !masterUnlocked;
      if (masterUnlocked) {
        btn.classList.remove('tab-locked');
        _removeBadge(btn);
      } else {
        btn.classList.add('tab-locked');
        _setBadge(btn, 'lock');
      }
      return;
    }

    // All other tabs — file loaded, show and apply sequential unlock
    btn.style.display = '';
    const isUnlocked = idx < level;

    if (isUnlocked) {
      btn.disabled = false;
      btn.classList.remove('tab-locked');
      if (idx < level - 1) {
        _setBadge(btn, 'done');
      } else {
        _removeBadge(btn);
      }
    } else {
      btn.disabled = true;
      btn.classList.add('tab-locked');
      _setBadge(btn, 'lock');
    }
  });
}

function _removeBadge(btn) {
  const old = btn.querySelector('.tab-status-badge');
  if (old) old.remove();
}

function _setBadge(btn, type) {
  _removeBadge(btn);
  const span = document.createElement('span');
  span.className = 'tab-status-badge ' + (type === 'lock' ? 'tab-badge-lock' : 'tab-badge-done');
  span.innerHTML = type === 'lock'
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"
         stroke-linecap="round" stroke-linejoin="round" width="10" height="10">
         <rect x="3" y="11" width="18" height="11" rx="2"/>
         <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
       </svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"
         stroke-linecap="round" stroke-linejoin="round" width="10" height="10">
         <polyline points="20 6 9 17 4 12"/>
       </svg>`;
  btn.appendChild(span);
}

/** Reset to start — called when CSV data is cleared */
function resetTabUnlocks() {
  localStorage.setItem(UNLOCK_KEY, '2');
  localStorage.removeItem('_tabsUnlocked');
  localStorage.removeItem('_masterUnlocked'); // Final Summary re-locks on clear
  applyTabStates();
}
window.resetTabUnlocks = resetTabUnlocks;

// Apply on page load (restores state from localStorage)
window.addEventListener('DOMContentLoaded', () => {
  applyTabStates();
  // Load kmc_home.js immediately so updateVisibility runs on page load
  loadScriptsSequential(TAB_SCRIPTS['section-home'] || [], function() {
    if (typeof window.initHome === 'function') window.initHome();
  });
});

/* ──────────────────────────────────────────
   TAB SWITCHER
────────────────────────────────────────── */
/* ── Logo loader overlay (created once, reused) ── */
function _showTabLoader() {
  let overlay = document.getElementById('_kmc-tab-loader');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = '_kmc-tab-loader';
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:99999',
      'display:flex;flex-direction:column;align-items:center;justify-content:center',
      'background:rgba(0,0,0,0.45);backdrop-filter:blur(4px)',
      'transition:opacity 0.25s'
    ].join(';');
    overlay.innerHTML =
      '<img src="../../assets/images/cymansquare_logo.svg"' +
      ' style="width:90px;height:90px;animation:_kmcSpin 1s linear infinite;filter:drop-shadow(0 0 18px #2d98fd88)"/>' +
      '<style>' +
      '@keyframes _kmcSpin{0%{transform:scale(1) rotate(0deg)}50%{transform:scale(1.12) rotate(180deg)}100%{transform:scale(1) rotate(360deg)}}' +
      '</style>';
    document.body.appendChild(overlay);
  }
  overlay.style.opacity = '1';
  overlay.style.display = 'flex';
}

function _hideTabLoader() {
  const overlay = document.getElementById('_kmc-tab-loader');
  if (!overlay) return;
  overlay.style.opacity = '0';
  setTimeout(() => { overlay.style.display = 'none'; }, 250);
}

function switchTab(id) {
  // Block if tab is locked
  const btn = document.querySelector(`.tab-btn[data-tab="${id}"]`);
  if (btn && (btn.disabled || btn.classList.contains('tab-locked'))) return;

  // Switch active section
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === id)
  );
  document.querySelectorAll('.tab-section').forEach(s =>
    s.classList.toggle('active', s.id === id)
  );

  // Clicking this tab unlocks the next one
  _unlockNext(id);

  // Show logo loader before lazy-loading scripts
  const scripts = TAB_SCRIPTS[id] || [];
  const alreadyLoaded = scripts.every(s => _loadedScripts[s]);
  if (!alreadyLoaded) _showTabLoader();

  loadScriptsSequential(scripts, () => {
    if (id === 'kmc_home'          && typeof window.initMainTables    === 'function') window.initMainTables();
    if (id === 'section-tables'    && typeof window.initLayerTables    === 'function') window.initLayerTables();
    if (id === 'section-filtered'  && typeof window.initFilteredTables  === 'function') window.initFilteredTables();
    if (id === 'section-sanction'  && typeof window.initSanctionTables  === 'function') window.initSanctionTables();
    if (id === 'section-parking'   && typeof window.initParkingTables   === 'function') window.initParkingTables();
    if (id === 'section-occupancy' && typeof window.initOccupancy       === 'function') window.initOccupancy();
    if (id === 'section-master'    && typeof window.initMasterTab       === 'function') window.initMasterTab();
    _hideTabLoader();
  });
}



/* ──────────────────────────────────────────
   SCROLL TO TOP BUTTON
────────────────────────────────────────── */
(function initScrollTop() {
  function setup() {
    const btn = document.getElementById('scrollTopBtn');
    if (!btn) return;

    function onScroll() {
      btn.classList.toggle('visible', window.scrollY > 200);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    // Run once immediately in case page is already scrolled
    onScroll();
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // Try immediately, and also on load (covers cases where DOM is not ready)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();