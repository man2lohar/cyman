/* ══════════════════════════════════════════
   kmc_page.js  —  All page-level logic for index_kmc.html
   (extracted from inline <script> blocks)
══════════════════════════════════════════ */

/* ──────────────────────────────────────────
   STICKY OFFSET CALCULATOR
   Measures feature-shell header + topbar
   + tab-bar at runtime and sets CSS vars.
────────────────────────────────────────── */
function recalcStickyOffsets() {
  const root = document.documentElement;
  const shellSelectors = [
    '.cym-header','#cym-header','.site-header','#site-header',
    '.app-header','header.shell','nav.shell',
    '[data-role="shell-header"]'
  ];
  let shellH = 0;
  for (const sel of shellSelectors) {
    const el = document.querySelector(sel);
    if (el) { shellH = el.getBoundingClientRect().height; break; }
  }
  const appWrapper = document.querySelector('.app-wrapper');
  if (shellH === 0 && appWrapper) {
    shellH = appWrapper.getBoundingClientRect().top + window.scrollY;
    if (window.scrollY > 0) shellH = appWrapper.offsetTop;
  }
  root.style.setProperty('--shell-h', shellH + 'px');
  const topbar  = document.querySelector('.topbar');
  const tabbar  = document.querySelector('.tab-bar');
  const topbarH = topbar ? topbar.getBoundingClientRect().height : 0;
  const tabbarH = tabbar ? tabbar.getBoundingClientRect().height : 0;
  root.style.setProperty('--topbar-bottom', (shellH + topbarH) + 'px');
  root.style.setProperty('--thead-top',     (shellH + topbarH + tabbarH) + 'px');
  console.log('[StickyCalc] shell:' + shellH + ' topbar:' + topbarH + ' tabbar:' + tabbarH);
}

window.addEventListener('DOMContentLoaded', () => { setTimeout(recalcStickyOffsets, 120); });
window.addEventListener('resize', recalcStickyOffsets);
window.addEventListener('load', () => {
  recalcStickyOffsets();
  const appWrapper = document.querySelector('.app-wrapper');
  const shellSelectors = [
    '.cym-header','#cym-header','.site-header','#site-header',
    '.app-header','header.shell','nav.shell','[data-role="shell-header"]'
  ];
  let fixedShellH = 0;
  for (const sel of shellSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const pos = getComputedStyle(el).position;
      if (pos === 'fixed' || pos === 'sticky') fixedShellH = el.getBoundingClientRect().height;
      break;
    }
  }
  if (fixedShellH > 0 && appWrapper) {
    const existing = parseInt(getComputedStyle(appWrapper).paddingTop) || 0;
    if (existing < fixedShellH) {
      appWrapper.style.paddingTop = fixedShellH + 'px';
      setTimeout(recalcStickyOffsets, 50);
    }
  }
});

/* ──────────────────────────────────────────
   SVG BACKGROUND BUILDER
────────────────────────────────────────── */
(function buildBg() {
  const glg = document.getElementById('gridLines');
  const geo = document.getElementById('geoShapes');
  if (!glg || !geo) return;
  const W = window.innerWidth, H = window.innerHeight;
  const ns = 'http://www.w3.org/2000/svg';
  function line(x1,y1,x2,y2,op){
    const l=document.createElementNS(ns,'line');
    [['x1',x1],['y1',y1],['x2',x2],['y2',y2],
     ['stroke','#2d98fd'],['stroke-opacity',op]].forEach(([k,v])=>l.setAttribute(k,v));
    return l;
  }
  for(let x=0;x<W;x+=80) glg.appendChild(line(x,0,x,H,'.03'));
  for(let y=0;y<H;y+=80) glg.appendChild(line(0,y,W,y,'.03'));
  const shapes=[
    {t:'polygon',p:`${W*.15},${H*.2} ${W*.15+40},${H*.2-60} ${W*.15+80},${H*.2}`,op:.06},
    {t:'polygon',p:`${W*.82},${H*.15} ${W*.82+50},${H*.15-70} ${W*.82+100},${H*.15}`,op:.05},
    {t:'rect',x:W*.4,y:H*.7,w:60,h:60,r:8,op:.04},
    {t:'circle',cx:W*.65,cy:H*.3,r:40,op:.05},
    {t:'polygon',p:`${W*.05},${H*.75} ${W*.05+35},${H*.75-50} ${W*.05+70},${H*.75}`,op:.04},
  ];
  shapes.forEach(s=>{
    let c;
    if(s.t==='polygon'){ c=document.createElementNS(ns,'polygon'); c.setAttribute('points',s.p); }
    else if(s.t==='rect'){ c=document.createElementNS(ns,'rect'); ['x','y','width','height','rx'].forEach((a,i)=>c.setAttribute(a,[s.x,s.y,s.w,s.h,s.r][i])); }
    else { c=document.createElementNS(ns,'circle'); c.setAttribute('cx',s.cx); c.setAttribute('cy',s.cy); c.setAttribute('r',s.r); }
    c.setAttribute('fill','none'); c.setAttribute('stroke','#2d98fd'); c.setAttribute('stroke-opacity',s.op);
    if(Math.random()>.5) c.classList.add('geo-anim');
    geo.appendChild(c);
  });
})();

/* ──────────────────────────────────────────
   LAZY SCRIPT LOADER
────────────────────────────────────────── */
const _loaded = {};

function loadScript(src, onload) {
  if (_loaded[src]) { if (onload) onload(); return; }
  _loaded[src] = true;
  const s = document.createElement('script');
  s.src = src;
  s.onload = onload || null;
  document.body.appendChild(s);
}

const TAB_SCRIPTS = {
  'section-home': []
};

function loadTabScripts(tabId, callback) {
  const scripts = TAB_SCRIPTS[tabId] || [];
  function loadNext(i) {
    if (i >= scripts.length) { if (callback) callback(); return; }
    loadScript(scripts[i], () => loadNext(i + 1));
  }
  loadNext(0);
}

/* ──────────────────────────────────────────
   TAB SWITCHING (with lazy loading)
────────────────────────────────────────── */
function switchTab(id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  document.querySelectorAll('.tab-section').forEach(s => s.classList.toggle('active', s.id === id));
  loadTabScripts(id, () => {
    if (id === 'section-tables')   generateTables();
    if (id === 'section-filtered') generateFilteredTables();
  });
}

document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

/* ──────────────────────────────────────────
   ERROR MODAL — manual open via Check button
────────────────────────────────────────── */
(function interceptErrorModal() {
  const modal = document.getElementById('errorModal');
  if (!modal) return;
  const observer = new MutationObserver(() => {
    if (modal.style.display && modal.style.display !== 'none' && !modal.classList.contains('show')) {
      modal.style.display = 'none';
    }
  });
  observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
})();

document.getElementById('modalClose').addEventListener('click', () => {
  const modal = document.getElementById('errorModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
});

document.addEventListener('DOMContentLoaded', () => {
  const checkBtn = document.getElementById('checkErrorsBtn');
  if (checkBtn) {
    checkBtn.addEventListener('click', () => {
      const modal = document.getElementById('errorModal');
      const body  = document.getElementById('modalBody');
      if (body && body.innerHTML.trim() !== '') {
        modal.classList.add('show');
      } else {
        body.innerHTML = '<span style="color:var(--green);font-weight:600;">✔ No errors detected in uploaded data.</span>';
        modal.classList.add('show');
      }
    });
  }
});

/* ──────────────────────────────────────────
   PATCH scrollToTableRowAndBlink
────────────────────────────────────────── */
(function patchScrollBlink() {
  const _orig = window.scrollToTableRowAndBlink;
  window.scrollToTableRowAndBlink = function (rowNumber) {
    const em = document.getElementById('errorModal');
    if (em) { em.classList.remove('show'); em.style.removeProperty('display'); }
    if (typeof switchTab === 'function') switchTab('section-home');
    if (typeof _orig === 'function') {
      setTimeout(() => _orig(rowNumber), 120);
    }
  };
})();

/* ──────────────────────────────────────────
   PATCH displayData
────────────────────────────────────────── */
(function patchDisplayData() {
  const _origDD = window.displayData;
  window.displayData = function (csv) {
    if (typeof _origDD === 'function') _origDD(csv);
    if (typeof window._kmcTabRefresh === 'function') window._kmcTabRefresh();
  };
})();

/* ──────────────────────────────────────────
   HOME: FILE UPLOAD & STORAGE VISIBILITY
────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  const clearBtn  = document.getElementById('clearStorageBtn');
  const infoDiv   = document.getElementById('info-container');
  const mainDiv   = document.getElementById('main-container');
  const fileInput = document.getElementById('file-input');
  const dot       = document.getElementById('status-dot');
  const txt       = document.getElementById('status-text');

  function updateVisibility() {
    const has = !!localStorage.getItem('csvData');
    clearBtn.style.display = has ? 'inline-flex' : 'none';
    infoDiv.style.display  = has ? 'none'        : 'block';
    mainDiv.style.display  = has ? 'block'       : 'none';
    if (has) {
      dot.classList.add('green');
      const storedFname = localStorage.getItem('uploadedFileName') || 'File loaded';
      txt.textContent = storedFname;
      const fnEl2 = document.getElementById('loaded-filename');
      if (fnEl2) fnEl2.textContent = storedFname;
    } else {
      dot.classList.remove('green');
      txt.textContent = 'No file loaded — upload to begin';
      const tbl = document.getElementById('data-table');
      if (tbl) {
        const hdr  = tbl.querySelector('#table-header');
        const body = tbl.querySelector('tbody');
        if (hdr)  hdr.innerHTML  = '';
        if (body) body.innerHTML = '';
      }
    }
  }

  function updateTabBar() {
    const has = !!localStorage.getItem('csvData');
    const layerTab    = document.getElementById('tabLayerTables');
    const filteredTab = document.getElementById('filteredTables');
    if (layerTab)    layerTab.style.display    = has ? '' : 'none';
    if (filteredTab) filteredTab.style.display = has ? '' : 'none';
    if (!has) {
      const tablesSection   = document.getElementById('section-tables');
      const filteredSection = document.getElementById('section-filtered');
      if (tablesSection   && tablesSection.classList.contains('active'))   switchTab('section-home');
      if (filteredSection && filteredSection.classList.contains('active')) switchTab('section-home');
    }
  }

  window._kmcTabRefresh = updateTabBar;
  updateVisibility();
  updateTabBar();

  clearBtn.addEventListener('click', () => {
    if (confirm('Clear all local data? This cannot be undone.')) {
      localStorage.clear();
      dot.classList.remove('green');
      txt.textContent = 'No file loaded — upload to begin';
      const fnEl3 = document.getElementById('loaded-filename');
      if (fnEl3) fnEl3.textContent = '';
      const tbl = document.getElementById('data-table');
      if (tbl) {
        const hdr  = tbl.querySelector('#table-header');
        const body = tbl.querySelector('tbody');
        if (hdr)  hdr.innerHTML  = '';
        if (body) body.innerHTML = '';
      }
      const zone2 = document.getElementById('uploadZone');
      if (zone2) { zone2.classList.remove('has-file'); zone2.classList.remove('drag-over'); }
      fileInput.value = '';
      updateVisibility();
      updateTabBar();
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) {
      infoDiv.style.display  = 'none';
      clearBtn.style.display = 'inline-flex';
      mainDiv.style.display  = 'block';
      dot.classList.add('green');
      const fname = fileInput.files[0].name;
      localStorage.setItem('uploadedFileName', fname);
      updateTabBar();
      txt.textContent = fname;
      const fnEl = document.getElementById('loaded-filename');
      if (fnEl) fnEl.textContent = fname;
      document.getElementById('uploadZone').classList.add('has-file');
    }
  });

  /* Upload zone — click & drag-drop */
  const zone = document.getElementById('uploadZone');
  if (zone) {
    zone.addEventListener('click', e => { if (e.target.id !== 'file-input') fileInput.click(); });
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) {
        if (typeof window.processFile === 'function') {
          window.processFile(f);
        } else {
          const dt = new DataTransfer();
          dt.items.add(f);
          fileInput.files = dt.files;
          fileInput.dispatchEvent(new Event('change'));
        }
      }
    });
  }
});

/* ──────────────────────────────────────────
   INSTRUCTION OVERLAY
────────────────────────────────────────── */
function handleOverlayClick(e) {
  if (e.target === document.getElementById('instrOverlay'))
    document.getElementById('instrOverlay').classList.remove('active');
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('instrOverlay').classList.remove('active');
});

/* ══════════════════════════════════════════
   LAYER TABLES — generateTables()
══════════════════════════════════════════ */
function generateTables() {
  const container = document.getElementById('tables-container');
  if (!container) return;
  container.innerHTML = '';

  const csv = localStorage.getItem('csvData');
  if (!csv) {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px 0">No CSV data found. Upload a file on the Home tab first.</p>';
    return;
  }

  const rows = csv.split('\n').filter(r => r.trim());
  if (rows.length < 2) {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px 0">File appears to be empty.</p>';
    return;
  }

  const headers = rows[0].split(',');
  const categoryIndex = 3;
  const categories = {};

  rows.slice(1).forEach(row => {
    const cells = row.split(',');
    if (cells.length > 0) {
      const category = cells[categoryIndex] || '(none)';
      if (!categories[category]) categories[category] = [];
      categories[category].push(cells);
    }
  });

  Object.keys(categories).sort().forEach(category => {
    const title = document.createElement('h2');
    title.textContent = category;
    title.style.cssText = 'font-family:var(--font-mono);font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin:28px 0 10px;padding:8px 14px;background:rgba(212,80,26,.06);border-left:3px solid var(--accent);border-radius:0 6px 6px 0;';
    container.appendChild(title);

    const wrap  = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.style.marginBottom = '10px';

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    const headerRow = document.createElement('tr');
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h.trim();
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    categories[category].forEach(cells => {
      const tr = document.createElement('tr');
      cells.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell.trim();
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
  });
}

/* ══════════════════════════════════════════
   FILTERED TABLES — generateFilteredTables()
   (ported from filtered.html)
══════════════════════════════════════════ */

// Global error state for filtered section
let _filteredErrors = [];
let _filteredErrCount = 1;

function generateFilteredTables() {
  // Reset error state each time
  _filteredErrors = [];
  _filteredErrCount = 1;

  const container = document.getElementById('filtered-section-container');
  if (!container) return;
  container.innerHTML = '';

  const csv = localStorage.getItem('csvData');
  if (!csv) {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px 0">No CSV data found. Upload a file on the Home tab first.</p>';
    return;
  }

  const parsedData = parseCSVToArray(csv);

  // Save computed values to localStorage (same as filtered.html)
  const treeCoverNetArea = calculateNetAreaForLayer(parsedData, 'Tree Cover');
  localStorage.setItem('treeCoverNetArea', treeCoverNetArea);

  const cbLoftNetArea = calculateNetAreaForcbloft(parsedData, ['Cupboard', 'Loft']);
  localStorage.setItem('cbLoftNetArea', cbLoftNetArea);

  const totalSum = calculateLayerSum(['Cupboard', 'Loft', 'Roof_Structure'], csv);
  localStorage.setItem('layerSumTotal', totalSum);

  const totalGroundCoverage = calculateTotalAreaForLayer(parsedData, 'Ground Coverage');
  const totalTerrace        = calculateTotalAreaForLayer(parsedData, 'Terrace');
  if (totalGroundCoverage !== totalTerrace) {
    _filteredErrors.push(`${_filteredErrCount++}. Total Area of Ground Coverage: ${totalGroundCoverage} is not equal to Total Area of Terrace: ${totalTerrace}.`);
  }

  // Build the Main Table
  const mainTable = _buildFilteredMainTable(csv, parsedData);
  container.appendChild(mainTable);

  // Build other tables
  const otherSection = _buildFilteredOtherTables(csv, parsedData);
  container.appendChild(otherSection);

  // Show alert if needed
  if (_filteredErrors.length > 0) {
    _showFilteredAlert(_filteredErrors.join('<br>'));
  }
}

function _buildFilteredMainTable(csv, parsedData) {
  const mainTableLayers = [
    'Residential','Mercantile_wholesale','Mercantile_retail','Business',
    'Institutional','Storage','Assembly','Hazardous','Industrial','Educational'
  ];
  const hiddenLayers = ['Plot','Parking','Tenement','Tenement_Ext_1','Tenement_Single','Tenement_Single_Ext_1'];
  const rows = csv.split('/n');

  const wrapper = document.createElement('div');
  wrapper.className = 'filtered-block';

  const heading = document.createElement('h2');
  heading.className = 'filtered-table-title';
  heading.textContent = 'Main Table';
  wrapper.appendChild(heading);

  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';

  const table = document.createElement('table');
  table.id = 'filtered-table-inline';

  // thead
  const thead = document.createElement('thead');
  const hRow  = document.createElement('tr');
  ['Floor','Layer','Total Area','Deducted Area','Net Area','Carpet Area'].forEach(h => {
    const th = document.createElement('th'); th.textContent = h; hRow.appendChild(th);
  });
  thead.appendChild(hRow);
  table.appendChild(thead);

  // tbody
  const tbody   = document.createElement('tbody');
  const tfoot   = document.createElement('tfoot');
  const seenMain = new Set();
  const mainTableData = [];

  rows.forEach((row, index) => {
    const cells = row.split(',');
    if (index !== 0 && row.trim() !== '') {
      const layer = cells[3];
      const key   = cells[2] + ',' + cells[3];
      if (mainTableLayers.includes(layer) && !seenMain.has(key)) {
        seenMain.add(key);
        mainTableData.push({
          column3: cells[2],
          column4: cells[3],
          totalFloorArea: formatNumber(calculateTotalFloorArea(cells, parsedData)),
          deductedArea:   formatNumber(calculateDeductedArea(cells, parsedData)),
          netArea:        formatNumber(calculateNetArea(
            formatNumber(calculateTotalFloorArea(cells, parsedData)),
            formatNumber(calculateDeductedArea(cells, parsedData))
          )),
          carpetArea: formatNumber(calculateCarpetArea(cells, parsedData)),
        });
      }
    }
  });

  mainTableData.sort((a, b) => parseFloat(a.column3) - parseFloat(b.column3));
  let totals = { totalFloorArea: 0, deductedArea: 0, netArea: 0, carpetArea: 0 };

  mainTableData.forEach(d => {
    const tr = document.createElement('tr');
    [d.column3, d.column4, d.totalFloorArea, d.deductedArea, d.netArea, d.carpetArea].forEach(v => {
      const td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
    });
    tbody.appendChild(tr);
    totals.totalFloorArea += parseFloat(d.totalFloorArea);
    totals.deductedArea   += parseFloat(d.deductedArea);
    totals.netArea        += parseFloat(d.netArea);
    totals.carpetArea     += parseFloat(d.carpetArea);
  });

  // tfoot totals row
  const totRow = document.createElement('tr');
  ['', 'Total',
    totals.totalFloorArea.toFixed(3),
    totals.deductedArea.toFixed(3),
    totals.netArea.toFixed(3),
    totals.carpetArea.toFixed(3)
  ].forEach(v => {
    const td = document.createElement('td'); td.textContent = v; totRow.appendChild(td);
  });
  tfoot.appendChild(totRow);

  table.appendChild(tbody);
  table.appendChild(tfoot);
  wrap.appendChild(table);
  wrapper.appendChild(wrap);
  return wrapper;
}

function _buildFilteredOtherTables(csv, parsedData) {
  const mainTableLayers = [
    'Residential','Mercantile_wholesale','Mercantile_retail','Business',
    'Institutional','Storage','Assembly','Hazardous','Industrial','Educational'
  ];
  const specialLayerGroups = ['Floor Height','Height','Open Space','Road','Corridor'];
  const hiddenLayers = ['Plot','Parking','Tenement','Tenement_Ext_1','Tenement_Single','Tenement_Single_Ext_1'];

  const rows = csv.split('/n');
  const frag = document.createDocumentFragment();
  const seenOtherTables = {};
  const otherTableData  = {};

  rows.forEach((row, index) => {
    const cells = row.split(',');
    if (index !== 0 && row.trim() !== '') {
      const layer = cells[3];
      const key   = cells[2] + ',' + cells[3];
      if (!mainTableLayers.includes(layer) && !hiddenLayers.includes(layer)) {
        if (!seenOtherTables[layer]) seenOtherTables[layer] = new Set();
        if (!seenOtherTables[layer].has(key)) {
          seenOtherTables[layer].add(key);
          if (!otherTableData[layer]) otherTableData[layer] = [];
          otherTableData[layer].push({
            column3: cells[2],
            column4: cells[3],
            totalFloorArea: formatNumber(calculateTotalFloorArea(cells, parsedData)),
            deductedArea:   formatNumber(calculateDeductedArea(cells, parsedData)),
            netArea:        formatNumber(calculateNetArea(
              formatNumber(calculateTotalFloorArea(cells, parsedData)),
              formatNumber(calculateDeductedArea(cells, parsedData))
            )),
            length:     parseFloat(cells[4]) || 0,
            linetype:   cells[5],
            lineweight: cells[6],
          });
        }
      }
    }
  });

  for (const layer in otherTableData) {
    const block = document.createElement('div');
    block.className = 'filtered-block';

    const heading = document.createElement('h2');
    heading.className = 'filtered-table-title';
    heading.textContent = layer;
    block.appendChild(heading);

    const wrap  = document.createElement('div');
    wrap.className = 'table-wrap';
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tfoot = document.createElement('tfoot');
    const tbody = document.createElement('tbody');

    let headers;
    if (layer === 'Lift') {
      headers = ['Floor','Layer','Lift Well Area','Lift Lobby Area'];
    } else {
      headers = specialLayerGroups.includes(layer)
        ? ['Floor','Layer','Length','Linetype','Lineweight']
        : ['Floor','Layer','Total Area','Deducted Area','Net Area'];
    }

    const hRow = document.createElement('tr');
    headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; hRow.appendChild(th); });
    thead.appendChild(hRow);
    table.appendChild(thead);

    let otherTotals = { length: 0, totalFloorArea: 0, deductedArea: 0, netArea: 0 };

    otherTableData[layer].forEach(d => {
      const tr = tbody.insertRow();
      tr.insertCell().textContent = d.column3;
      tr.insertCell().textContent = d.column4;

      if (layer === 'Lift') {
        tr.insertCell().textContent = d.totalFloorArea;
        tr.insertCell().textContent = d.deductedArea;
        const liftLobby = parseFloat(d.deductedArea) || 0;
        if (liftLobby > 3) {
          _filteredErrors.push(`${_filteredErrCount++}. Lift Lobby Area exceeds the limit of 3 (Value: ${liftLobby})`);
        }
        otherTotals.totalFloorArea += parseFloat(d.totalFloorArea) || 0;
        otherTotals.deductedArea   += liftLobby;
      } else if (specialLayerGroups.includes(layer)) {
        tr.insertCell().textContent = d.length;
        tr.insertCell().textContent = d.linetype;
        tr.insertCell().textContent = d.lineweight;
        otherTotals.length += d.length;
      } else {
        tr.insertCell().textContent = d.totalFloorArea;
        tr.insertCell().textContent = d.deductedArea;
        tr.insertCell().textContent = d.netArea;
        otherTotals.totalFloorArea += parseFloat(d.totalFloorArea) || 0;
        otherTotals.deductedArea   += parseFloat(d.deductedArea)   || 0;
        otherTotals.netArea        += parseFloat(d.netArea)        || 0;
      }
    });

    // Total row
    const totRow = tfoot.insertRow();
    totRow.insertCell().textContent = '';
    totRow.insertCell().textContent = 'Total';
    if (layer === 'Lift') {
      totRow.insertCell().textContent = otherTotals.totalFloorArea.toFixed(3);
      totRow.insertCell().textContent = otherTotals.deductedArea.toFixed(3);
    } else if (specialLayerGroups.includes(layer)) {
      totRow.insertCell().textContent = otherTotals.length.toFixed(3);
      totRow.insertCell().textContent = '';
      totRow.insertCell().textContent = '';
    } else {
      totRow.insertCell().textContent = otherTotals.totalFloorArea.toFixed(3);
      totRow.insertCell().textContent = otherTotals.deductedArea.toFixed(3);
      totRow.insertCell().textContent = otherTotals.netArea.toFixed(3);
    }

    table.appendChild(tbody);
    table.appendChild(tfoot);
    wrap.appendChild(table);
    block.appendChild(wrap);
    frag.appendChild(block);
  }

  return frag;
}

/* ── Filtered section alert ── */
function _showFilteredAlert(message) {
  const modal = document.getElementById('filteredAlertModal');
  const msgEl = document.getElementById('filteredAlertBody');
  if (!modal || !msgEl) return;
  msgEl.innerHTML = message;
  modal.classList.add('show');
}

/* ──────────────────────────────────────────
   HELPER FUNCTIONS (shared with filtered logic)
────────────────────────────────────────── */
function parseCSVToArray(csv) {
  const rows = csv.split('/n');
  const data = [];
  rows.forEach((row, index) => {
    if (index !== 0 && row.trim() !== '') {
      const cells = row.split(',');
      data.push({
        column1: cells[0], column2: cells[1], column3: cells[2],
        column4: cells[3], column5: cells[4], column6: cells[5],
        column7: cells[6], column8: parseFloat(cells[7]) || 0, column9: cells[8],
      });
    }
  });
  return data;
}

function calculateNetAreaForLayer(parsedData, layerName) {
  let totalArea = 0, deductedArea = 0;
  parsedData.forEach(row => {
    if (row.column4 === layerName) {
      totalArea += parseFloat(row.column8) || 0;
      if (row.column6 === 'DASHED') deductedArea += parseFloat(row.column8) || 0;
    }
  });
  return (totalArea - deductedArea).toFixed(3);
}

function calculateNetAreaForcbloft(parsedData, layerNames) {
  let totalArea = 0, deductedArea = 0;
  parsedData.forEach(row => {
    if (layerNames.includes(row.column4)) {
      totalArea += parseFloat(row.column8) || 0;
      if (row.column6 === 'DASHED') deductedArea += parseFloat(row.column8) || 0;
    }
  });
  return (totalArea - deductedArea).toFixed(3);
}

function calculateLayerSum(layers, csv) {
  let totalSum = 0;
  if (!csv) csv = localStorage.getItem('csvData');
  if (csv) {
    const parsedData = parseCSVToArray(csv);
    parsedData.forEach(row => {
      const floor = row.column3 ? row.column3.trim().toLowerCase() : '';
      const layer = row.column4 ? row.column4.trim() : '';
      const value = parseFloat(row.column8);
      if (layers.includes(layer)) {
        if (layer === 'Roof_Structure' && floor === 'cyan') return;
        if (!isNaN(value)) totalSum += value;
      }
    });
  }
  return totalSum.toFixed(3);
}

function calculateTotalAreaForLayer(parsedData, layerName) {
  let totalArea = 0, deductedArea = 0;
  parsedData.forEach(row => {
    if (row.column4 === layerName) {
      totalArea += parseFloat(row.column8) || 0;
      if (row.column6 === 'DASHED') deductedArea += parseFloat(row.column8) || 0;
    }
  });
  return (totalArea - deductedArea).toFixed(3);
}

function calculateTotalFloorArea(filteredRow, mainTableData) {
  const Lineweights = [
    '0.00 mm','0.05 mm','0.09 mm','0.13 mm','0.15 mm','0.18 mm','0.20 mm',
    '0.25 mm','0.30 mm','0.35 mm','0.40 mm','0.50 mm','0.60 mm','0.70 mm',
    '0.80 mm','0.90 mm','1.00 mm','1.06 mm','1.20 mm','1.40 mm','1.58 mm','2.11 mm'
  ];
  const column3Value = filteredRow[2];
  const column4Value = filteredRow[3];
  const specialLayers = ['Splay','Tree Cover','Road','Stair','Lift','Existing',
    'Parking_Area','Plot','Shaft','Strip','Waterbody'];
  let sum = 0;
  mainTableData.forEach(data => {
    if (data.column3 === column3Value && data.column4 === column4Value) {
      if (specialLayers.includes(column4Value) && Lineweights.includes(data.column7) && data.column6 === 'ByLayer') {
        sum += data.column8;
      } else if (data.column6 === 'ByLayer' && data.column7 === 'ByLayer') {
        sum += data.column8;
      }
    }
  });
  return sum.toFixed(3);
}

function calculateDeductedArea(filteredRow, mainTableData) {
  const column3Value = filteredRow[2];
  const column4Value = filteredRow[3];
  let sum = 0;
  mainTableData.forEach(data => {
    if (data.column3 === column3Value && data.column4 === column4Value && data.column6 === 'DASHED')
      sum += data.column8;
  });
  return sum.toFixed(3);
}

function calculateNetArea(totalFloorArea, deductedArea) {
  return (parseFloat(totalFloorArea) - parseFloat(deductedArea)).toFixed(3);
}

function calculateCarpetArea(filteredRow, mainTableData) {
  const column3Value = filteredRow[2];
  const column4Value = filteredRow[3];
  let sum = 0;
  mainTableData.forEach(data => {
    if (data.column3 === column3Value && data.column4 === column4Value && data.column7 === '0.15 mm')
      sum += data.column8;
  });
  return sum.toFixed(3);
}

function formatNumber(value) {
  const number = parseFloat(value);
  return isNaN(number) ? '0.000' : number.toFixed(3);
}

/* ──────────────────────────────────────────
   SCROLL TO TOP BUTTON
────────────────────────────────────────── */
(function () {
  const btn = document.getElementById('scrollTopBtn');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 300);
  }, { passive: true });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
