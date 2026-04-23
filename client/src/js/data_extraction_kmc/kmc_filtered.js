/* ══════════════════════════════════════════
   kmc_filtered.js  —  Filtered Tables tab logic
   Lazy-loaded on first click of Filtered Tables tab.
   Exposes: window.initFilteredTables()
            window.generateFilteredTables()  (called by Refresh button)
   Ported from: filtered.html
══════════════════════════════════════════ */

/* ────────────────────────────────────────
   Module-level error state
   (reset on every generateFilteredTables call)
──────────────────────────────────────── */
let _filteredErrors   = [];
let _filteredErrCount = 1;

/* ══════════════════════════════════════════
   MAIN ENTRY POINT
══════════════════════════════════════════ */
function generateFilteredTables() {
  _filteredErrors   = [];
  _filteredErrCount = 1;

  const container = document.getElementById('filtered-section-container');
  if (!container) return;
  container.innerHTML = '';

  const csv = localStorage.getItem('csvData');
  if (!csv) {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px 0">No CSV data found. Upload a file on the Home tab first.</p>';
    return;
  }

  const parsedData = _parseCSVToArray(csv);

  /* ── Save computed values to localStorage (same as original filtered.html) ── */
  localStorage.setItem('treeCoverNetArea', _calcNetAreaForLayer(parsedData, 'Tree Cover'));
  localStorage.setItem('cbLoftNetArea',    _calcNetAreaForcbloft(parsedData, ['Cupboard', 'Loft']));
  localStorage.setItem('layerSumTotal',    _calcLayerSum(['Cupboard', 'Loft', 'Roof_Structure'], parsedData));

  /* ── Ground Coverage vs Terrace check ── */
  const gc = _calcTotalAreaForLayer(parsedData, 'Ground Coverage');
  const tr = _calcTotalAreaForLayer(parsedData, 'Terrace');
  if (gc !== tr) {
    _filteredErrors.push(
      `${_filteredErrCount++}. Total Area of Ground Coverage: ${gc} is not equal to Total Area of Terrace: ${tr}.`
    );
  }

  /* ── Build & append sections ── */
  container.appendChild(_buildMainTable(csv, parsedData));
  container.appendChild(_buildOtherTables(csv, parsedData));

  /* ── Show alert if any errors found ── */
  if (_filteredErrors.length > 0) {
    _showAlert(_filteredErrors.join('<br>'));
  }
}

/* ──────────────────────────────────────────
   BUILD: Main Table
   Layers: Residential, Mercantile_*, Business…
──────────────────────────────────────────*/
function _buildMainTable(csv, parsedData) {
  const MAIN_LAYERS = [
    'Residential', 'Mercantile_wholesale', 'Mercantile_retail', 'Business',
    'Institutional', 'Storage', 'Assembly', 'Hazardous', 'Industrial', 'Educational'
  ];

  const wrapper = document.createElement('div');
  wrapper.className = 'filtered-block';

  const heading = document.createElement('h2');
  heading.className = 'filtered-table-title';
  heading.textContent = 'Main Table';
  wrapper.appendChild(heading);

  const wrap  = document.createElement('div');
  wrap.className = 'table-wrap';

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  const tfoot = document.createElement('tfoot');

  // Header
  const hRow = document.createElement('tr');
  ['Floor','Layer','Total Area','Deducted Area','Net Area','Carpet Area'].forEach(h => {
    const th = document.createElement('th'); th.textContent = h; hRow.appendChild(th);
  });
  thead.appendChild(hRow);
  table.appendChild(thead);

  // Collect unique main-table rows
  const rows      = csv.split('\n');
  const seen      = new Set();
  const tableData = [];

  rows.forEach((row, i) => {
    if (i === 0 || !row.trim()) return;
    const cells = row.split(',');
    const layer = cells[3];
    const key   = cells[2] + ',' + cells[3];
    if (!MAIN_LAYERS.includes(layer) || seen.has(key)) return;
    seen.add(key);
    tableData.push({
      floor:          cells[2],
      layer:          cells[3],
      totalFloorArea: _fmt(_calcTotalFloorArea(cells, parsedData)),
      deductedArea:   _fmt(_calcDeductedArea(cells, parsedData)),
      netArea:        _fmt(_calcNetArea(
                        _fmt(_calcTotalFloorArea(cells, parsedData)),
                        _fmt(_calcDeductedArea(cells, parsedData))
                      )),
      carpetArea:     _fmt(_calcCarpetArea(cells, parsedData)),
    });
  });

  // Sort by floor number
  tableData.sort((a, b) => parseFloat(a.floor) - parseFloat(b.floor));

  let totals = { totalFloorArea:0, deductedArea:0, netArea:0, carpetArea:0 };

  tableData.forEach(d => {
    const tr = document.createElement('tr');
    [d.floor, d.layer, d.totalFloorArea, d.deductedArea, d.netArea, d.carpetArea].forEach(v => {
      const td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
    });
    tbody.appendChild(tr);
    totals.totalFloorArea += parseFloat(d.totalFloorArea) || 0;
    totals.deductedArea   += parseFloat(d.deductedArea)   || 0;
    totals.netArea        += parseFloat(d.netArea)        || 0;
    totals.carpetArea     += parseFloat(d.carpetArea)     || 0;
  });

  // Totals row
  const totRow = document.createElement('tr');
  ['', 'Total',
    totals.totalFloorArea.toFixed(3),
    totals.deductedArea.toFixed(3),
    totals.netArea.toFixed(3),
    totals.carpetArea.toFixed(3),
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

/* ──────────────────────────────────────────
   BUILD: Other Tables (one per non-main layer)
──────────────────────────────────────────*/
function _buildOtherTables(csv, parsedData) {
  const MAIN_LAYERS = [
    'Residential', 'Mercantile_wholesale', 'Mercantile_retail', 'Business',
    'Institutional', 'Storage', 'Assembly', 'Hazardous', 'Industrial', 'Educational'
  ];
  const SPECIAL_LAYERS = ['Floor Height','Height','Open Space','Road','Corridor'];
  const HIDDEN_LAYERS  = [
    'Plot','Parking','Tenement','Tenement_Ext_1','Tenement_Single','Tenement_Single_Ext_1'
  ];

  // Collect data per layer
  const rows         = csv.split('\n');
  const seenPerLayer = {};
  const layerData    = {};

  rows.forEach((row, i) => {
    if (i === 0 || !row.trim()) return;
    const cells = row.split(',');
    const layer = cells[3];
    const key   = cells[2] + ',' + cells[3];

    if (MAIN_LAYERS.includes(layer) || HIDDEN_LAYERS.includes(layer)) return;
    if (!seenPerLayer[layer]) seenPerLayer[layer] = new Set();
    if (seenPerLayer[layer].has(key)) return;
    seenPerLayer[layer].add(key);
    if (!layerData[layer]) layerData[layer] = [];
    layerData[layer].push({
      floor:          cells[2],
      layer:          cells[3],
      totalFloorArea: _fmt(_calcTotalFloorArea(cells, parsedData)),
      deductedArea:   _fmt(_calcDeductedArea(cells, parsedData)),
      netArea:        _fmt(_calcNetArea(
                        _fmt(_calcTotalFloorArea(cells, parsedData)),
                        _fmt(_calcDeductedArea(cells, parsedData))
                      )),
      length:     parseFloat(cells[4]) || 0,
      linetype:   cells[5] || '',
      lineweight: cells[6] || '',
    });
  });

  const frag = document.createDocumentFragment();

  for (const layer in layerData) {
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
    const tbody = document.createElement('tbody');
    const tfoot = document.createElement('tfoot');

    // Choose headers based on layer type
    let headers;
    if (layer === 'Lift') {
      headers = ['Floor','Layer','Lift Well Area','Lift Lobby Area'];
    } else if (SPECIAL_LAYERS.includes(layer)) {
      headers = ['Floor','Layer','Length','Linetype','Lineweight'];
    } else {
      headers = ['Floor','Layer','Total Area','Deducted Area','Net Area'];
    }

    const hRow = document.createElement('tr');
    headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; hRow.appendChild(th); });
    thead.appendChild(hRow);
    table.appendChild(thead);

    let totals = { length:0, totalFloorArea:0, deductedArea:0, netArea:0 };

    layerData[layer].forEach(d => {
      const tr = tbody.insertRow();
      tr.insertCell().textContent = d.floor;
      tr.insertCell().textContent = d.layer;

      if (layer === 'Lift') {
        tr.insertCell().textContent = d.totalFloorArea;
        tr.insertCell().textContent = d.deductedArea;
        const lobby = parseFloat(d.deductedArea) || 0;
        if (lobby > 5) {
          _filteredErrors.push(
            `${_filteredErrCount++}. Lift Lobby Area exceeds the limit of 5 (Value: ${lobby})`
          );
        }
        totals.totalFloorArea += parseFloat(d.totalFloorArea) || 0;
        totals.deductedArea   += lobby;
      } else if (SPECIAL_LAYERS.includes(layer)) {
        tr.insertCell().textContent = d.length;
        tr.insertCell().textContent = d.linetype;
        tr.insertCell().textContent = d.lineweight;
        totals.length += d.length;
      } else {
        tr.insertCell().textContent = d.totalFloorArea;
        tr.insertCell().textContent = d.deductedArea;
        tr.insertCell().textContent = d.netArea;
        totals.totalFloorArea += parseFloat(d.totalFloorArea) || 0;
        totals.deductedArea   += parseFloat(d.deductedArea)   || 0;
        totals.netArea        += parseFloat(d.netArea)        || 0;
      }
    });

    // Totals row
    const totRow = tfoot.insertRow();
    totRow.insertCell().textContent = '';
    totRow.insertCell().textContent = 'Total';
    if (layer === 'Lift') {
      totRow.insertCell().textContent = totals.totalFloorArea.toFixed(3);
      totRow.insertCell().textContent = totals.deductedArea.toFixed(3);
    } else if (SPECIAL_LAYERS.includes(layer)) {
      totRow.insertCell().textContent = totals.length.toFixed(3);
      totRow.insertCell().textContent = '';
      totRow.insertCell().textContent = '';
    } else {
      totRow.insertCell().textContent = totals.totalFloorArea.toFixed(3);
      totRow.insertCell().textContent = totals.deductedArea.toFixed(3);
      totRow.insertCell().textContent = totals.netArea.toFixed(3);
    }

    table.appendChild(tbody);
    table.appendChild(tfoot);
    wrap.appendChild(table);
    block.appendChild(wrap);
    frag.appendChild(block);
  }

  return frag;
}



/* ══════════════════════════════════════════
   CALCULATION HELPERS  (private, prefixed _)
══════════════════════════════════════════ */
function _parseCSVToArray(csv) {
  return csv.split('\n')
    .filter((row, i) => i !== 0 && row.trim())
    .map(row => {
      const c = row.split(',');
      return {
        column1: c[0], column2: c[1], column3: c[2],
        column4: c[3], column5: c[4], column6: c[5],
        column7: c[6], column8: parseFloat(c[7]) || 0, column9: c[8],
      };
    });
}

function _calcNetAreaForLayer(parsedData, layerName) {
  let total = 0, deducted = 0;
  parsedData.forEach(row => {
    if (row.column4 !== layerName) return;
    total += row.column8;
    if (row.column6 === 'DASHED') deducted += row.column8;
  });
  return (total - deducted).toFixed(3);
}

function _calcNetAreaForcbloft(parsedData, layerNames) {
  let total = 0, deducted = 0;
  parsedData.forEach(row => {
    if (!layerNames.includes(row.column4)) return;
    total += row.column8;
    if (row.column6 === 'DASHED') deducted += row.column8;
  });
  return (total - deducted).toFixed(3);
}

function _calcLayerSum(layers, parsedData) {
  let sum = 0;
  parsedData.forEach(row => {
    const floor = (row.column3 || '').trim().toLowerCase();
    const layer = (row.column4 || '').trim();
    if (!layers.includes(layer)) return;
    if (layer === 'Roof_Structure' && floor === 'cyan') return;
    if (!isNaN(row.column8)) sum += row.column8;
  });
  return sum.toFixed(3);
}

function _calcTotalAreaForLayer(parsedData, layerName) {
  let total = 0, deducted = 0;
  parsedData.forEach(row => {
    if (row.column4 !== layerName) return;
    total += row.column8;
    if (row.column6 === 'DASHED') deducted += row.column8;
  });
  return (total - deducted).toFixed(3);
}

function _calcTotalFloorArea(cells, parsedData) {
  const VALID_LW = [
    '0.00 mm','0.05 mm','0.09 mm','0.13 mm','0.15 mm','0.18 mm','0.20 mm',
    '0.25 mm','0.30 mm','0.35 mm','0.40 mm','0.50 mm','0.60 mm','0.70 mm',
    '0.80 mm','0.90 mm','1.00 mm','1.06 mm','1.20 mm','1.40 mm','1.58 mm','2.11 mm',
  ];
  const SPECIAL = [
    'Splay','Tree Cover','Road','Stair','Lift','Existing',
    'Parking_Area','Plot','Shaft','Strip','Waterbody',
  ];
  const floorVal = cells[2];
  const layerVal = cells[3];
  let sum = 0;
  parsedData.forEach(d => {
    if (d.column3 !== floorVal || d.column4 !== layerVal) return;
    if (SPECIAL.includes(layerVal) && VALID_LW.includes(d.column7) && d.column6 === 'ByLayer') {
      sum += d.column8;
    } else if (d.column6 === 'ByLayer' && d.column7 === 'ByLayer') {
      sum += d.column8;
    }
  });
  return sum.toFixed(3);
}

function _calcDeductedArea(cells, parsedData) {
  const floorVal = cells[2];
  const layerVal = cells[3];
  let sum = 0;
  parsedData.forEach(d => {
    if (d.column3 === floorVal && d.column4 === layerVal && d.column6 === 'DASHED')
      sum += d.column8;
  });
  return sum.toFixed(3);
}

function _calcNetArea(total, deducted) {
  return (parseFloat(total) - parseFloat(deducted)).toFixed(3);
}

function _calcCarpetArea(cells, parsedData) {
  const floorVal = cells[2];
  const layerVal = cells[3];
  let sum = 0;
  parsedData.forEach(d => {
    if (d.column3 === floorVal && d.column4 === layerVal && d.column7 === '0.15 mm')
      sum += d.column8;
  });
  return sum.toFixed(3);
}

function _fmt(value) {
  const n = parseFloat(value);
  return isNaN(n) ? '0.000' : n.toFixed(3);
}

/* ──────────────────────────────────────────
   INIT — called by kmc_core switchTab
──────────────────────────────────────────*/
window.initFilteredTables = function () {
  generateFilteredTables();
};

/* ──────────────────────────────────────────
   ALERT MODAL
──────────────────────────────────────────*/
function _showAlert(message) {
  const modal = document.getElementById('filteredAlertModal');
  const msgEl = document.getElementById('filteredAlertBody');
  if (!modal || !msgEl) return;
  msgEl.innerHTML = message;
  modal.classList.add('show');
}

// Wire close buttons (safe to call multiple times — addEventListener is idempotent)
document.addEventListener('DOMContentLoaded', function () {
  const modal     = document.getElementById('filteredAlertModal');
  const closeX    = document.getElementById('filteredAlertClose');
  const closeBtn  = document.getElementById('filteredAlertCloseBtn');
  const closeAny  = () => { if (modal) modal.classList.remove('show'); };


  if (closeX)   closeX.addEventListener('click', closeAny);
  if (closeBtn) closeBtn.addEventListener('click', closeAny);
});
/* ──────────────────────────────────────────
   INIT — called by kmc_core switchTab
──────────────────────────────────────────*/
window.initFilteredTables = function () {
  // 1. Manually wire up the buttons because DOMContentLoaded has already passed
  _setupModalListeners();

  // 2. Proceed with table generation
  generateFilteredTables();
};

function _setupModalListeners() {
  const modal     = document.getElementById('filteredAlertModal');
  const closeX    = document.getElementById('filteredAlertClose');
  const closeBtn  = document.getElementById('filteredAlertCloseBtn');
  
  const closeAny  = () => { 
    if (modal) modal.classList.remove('show'); 
  };

  if (closeX)   closeX.onclick = closeAny;
  if (closeBtn) closeBtn.onclick = closeAny;
}