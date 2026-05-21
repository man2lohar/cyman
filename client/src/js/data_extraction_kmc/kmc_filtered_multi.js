/* ══════════════════════════════════════════
   kmc_filtered_multi.js  —  Filtered Tables for multi-block buildings
   Lazy-loaded by mRefreshFiltered() in index_kmc_multi.html.

   Multi-block colour/lineweight rules (from spec):
   ┌─────────────────┬──────────────────────────────────────────────────┐
   │ Ground Coverage │ Colour = 53 + blockIndex  (A=53, B=54, C=55 …)  │
   │ Open Space      │ Colour range: blockIndex*10+53 … +62             │
   │                 │ Layer: Open Space / _Ext_1…5 by block count      │
   │ Height          │ Lineweight = LW_LIST[blockIndex] (Lines only)    │
   │                 │ Layer: Height / Height_Ext_1 if >24 blocks       │
   │ Floor Height    │ Same LW scheme; colour = floor number (1,2,3…)   │
   │                 │ Layer: Floor Height / FloorHeight_Ext_1 if >24   │
   └─────────────────┴──────────────────────────────────────────────────┘

   Reads:
     localStorage.csvData               — block-only or master CSV
     localStorage.MB_currentBlockIndex  — 0=Block A, 1=Block B, -1=Master
     localStorage.MB_blockCount         — total number of blocks
   Exposes: window.generateFilteredTablesMulti()
══════════════════════════════════════════ */

/* ── Error state (reset on each call) ── */
let _mfErrors   = [];
let _mfErrCount = 1;

/* ── Lineweight list for block index → LW mapping ── */
const _MF_LW_LIST = [
  '0.15 mm','0.20 mm','0.25 mm','0.30 mm','0.35 mm','0.40 mm','0.50 mm',
  '0.60 mm','0.70 mm','0.80 mm','0.90 mm',
];

/* ── Layer name helpers ── */
function _mfOpenSpaceLayer(blockCount) {
  if (blockCount >= 50) return 'Open Space_Ext_5';
  if (blockCount >= 40) return 'Open Space_Ext_4';
  if (blockCount >= 30) return 'Open Space_Ext_3';
  if (blockCount >= 20) return 'Open Space_Ext_2';
  if (blockCount >= 10) return 'Open Space_Ext_1';
  return 'Open Space';
}
function _mfHeightLayer(blockCount)      { return blockCount > 24 ? 'Height_Ext_1'      : 'Height';       }
function _mfFloorHeightLayer(blockCount) { return blockCount > 24 ? 'FloorHeight_Ext_1' : 'Floor Height'; }

/* ══════════════════════════════════════════
   MAIN ENTRY
══════════════════════════════════════════ */
function generateFilteredTablesMulti() {
  _mfErrors   = [];
  _mfErrCount = 1;

  const container = document.getElementById('filtered-section-container');
  if (!container) return;
  container.innerHTML = '';

  const csv = localStorage.getItem('csvData');
  if (!csv) {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px 0">No CSV data. Select a block or Master above.</p>';
    return;
  }

  const blockIndex = parseInt(localStorage.getItem('MB_currentBlockIndex') || '0', 10);
  const blockCount = parseInt(localStorage.getItem('MB_blockCount') || '1', 10);
  const isMaster   = blockIndex === -1;

  /* For Master: fall back to the same logic as single-building filtered */
  if (isMaster) {
    _generateMasterFiltered(container, csv);
    return;
  }

  /* ── Block-specific config ── */
  const gcColour  = 53 + blockIndex;                    // e.g. Block A=53, B=54
  const osMin     = 53 + blockIndex * 10;               // Open Space colour range min
  const osMax     = osMin + 9;                          // Open Space colour range max
  const blockLW   = _MF_LW_LIST[blockIndex] || null;   // Height / Floor Height lineweight
  const osLayer   = _mfOpenSpaceLayer(blockCount);
  const htLayer   = _mfHeightLayer(blockCount);
  const fhLayer   = _mfFloorHeightLayer(blockCount);
  const blockLabel= String.fromCharCode(65 + blockIndex); // 'A','B','C'...

  /* ── Show block config banner ── */
  const banner = document.createElement('div');
  banner.style.cssText = [
    'background:rgba(26,153,212,.07)','border:1px solid rgba(26,153,212,.25)',
    'border-radius:8px','padding:10px 16px','margin-bottom:18px',
    'font-family:var(--font-mono)','font-size:.75rem','color:var(--accent)',
    'line-height:1.8',
  ].join(';');
  banner.innerHTML =
    `<strong>Block ${blockLabel} filters applied:</strong><br>` +
    `Ground Coverage → Colour <strong>${gcColour}</strong> &nbsp;|&nbsp; ` +
    `Open Space (${osLayer}) → Colour <strong>${osMin}–${osMax}</strong> &nbsp;|&nbsp; ` +
    `${htLayer} / ${fhLayer} → Lineweight <strong>${blockLW || 'N/A'}</strong> (Lines only)`;
  container.appendChild(banner);

  const parsedData = _mfParseCSV(csv);

  /* ── Filter parsedData per multi-block rules ── */
  const filteredData = parsedData.filter(row => {
    const layer  = (row.column4 || '').trim();
    const colour = parseInt(row.column3, 10);
    const lw     = (row.column7 || '').trim();
    const nm     = (row.column2 || '').trim();

    if (layer === 'Ground Coverage') {
      return isNaN(colour) || colour === gcColour;
    }
    if (layer === osLayer) {
      return isNaN(colour) || (colour >= osMin && colour <= osMax);
    }
    if (layer === htLayer && nm === 'Line') {
      return !blockLW || lw === blockLW;
    }
    if (layer === fhLayer && nm === 'Line') {
      return !blockLW || lw === blockLW;
    }
    return true; // all other layers pass through unfiltered
  });

  /* ── Save computed values for downstream tabs ── */
  localStorage.setItem('treeCoverNetArea', _mfNetAreaForLayer(filteredData, 'Tree Cover'));
  localStorage.setItem('cbLoftNetArea',    _mfNetAreaForLayers(filteredData, ['Cupboard','Loft']));
  localStorage.setItem('layerSumTotal',    _mfLayerSum(['Cupboard','Loft','Roof_Structure'], filteredData));

  /* ── Ground Coverage vs Terrace check (filtered GC) ── */
  const gc = _mfTotalAreaForLayer(filteredData, 'Ground Coverage');
  const tr = _mfTotalAreaForLayer(filteredData, 'Terrace');
  if (parseFloat(gc) !== parseFloat(tr)) {
    _mfErrors.push(
      `${_mfErrCount++}. Ground Coverage (Block ${blockLabel}, Colour ${gcColour}): ${gc} ≠ Terrace: ${tr}.`
    );
  }

  /* ── Rebuild a filtered CSV string for building tables ── */
  const filteredCSV = _mfRebuildCSV(csv, filteredData);

  /* ── Build sections ── */
  container.appendChild(_mfBuildMainTable(filteredCSV, filteredData, fhLayer));
  container.appendChild(_mfBuildOtherTables(filteredCSV, filteredData, osLayer, htLayer, fhLayer));

  if (_mfErrors.length) _mfShowAlert(_mfErrors.join('<br>'));
}

/* ══════════════════════════════════════════
   MASTER VIEW — same as single-building logic
══════════════════════════════════════════ */
function _generateMasterFiltered(container, csv) {
  const parsedData = _mfParseCSV(csv);

  localStorage.setItem('treeCoverNetArea', _mfNetAreaForLayer(parsedData, 'Tree Cover'));
  localStorage.setItem('cbLoftNetArea',    _mfNetAreaForLayers(parsedData, ['Cupboard','Loft']));
  localStorage.setItem('layerSumTotal',    _mfLayerSum(['Cupboard','Loft','Roof_Structure'], parsedData));

  /* No GC vs Terrace check for Master — master sheet spans all blocks so
     comparison is meaningless at this level */

  container.appendChild(_mfBuildMainTable(csv, parsedData, 'Floor Height'));
  container.appendChild(_mfBuildOtherTables(csv, parsedData, 'Open Space', 'Height', 'Floor Height'));
  if (_mfErrors.length) _mfShowAlert(_mfErrors.join('<br>'));
}

/* ══════════════════════════════════════════
   BUILD: Main Table
   Uses colour as floor identifier — for multi-block
   the colour col is the floor number (1, 2, 3…) in
   Floor Height rows.  For occupancy layers the colour
   is already the floor number in block-only CSV.
══════════════════════════════════════════ */
function _mfBuildMainTable(csv, parsedData, fhLayer) {
  const MAIN_LAYERS = [
    'Residential','Mercantile_wholesale','Mercantile_retail','Business',
    'Institutional','Storage','Assembly','Hazardous','Industrial','Educational',
  ];

  const wrapper = document.createElement('div');
  wrapper.className = 'filtered-block';

  const heading = document.createElement('h2');
  heading.className = 'filtered-table-title';
  heading.textContent = 'Main Table';
  wrapper.appendChild(heading);

  const wrap  = document.createElement('div'); wrap.className = 'table-wrap';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  const tfoot = document.createElement('tfoot');

  const hRow = document.createElement('tr');
  ['Floor','Layer','Total Area','Deducted Area','Net Area','Carpet Area'].forEach(h => {
    const th = document.createElement('th'); th.textContent = h; hRow.appendChild(th);
  });
  thead.appendChild(hRow);
  table.appendChild(thead);

  const rows      = csv.split('\n');
  const seen      = new Set();
  const tableData = [];

  rows.forEach((row, i) => {
    if (!i || !row.trim()) return;
    const cells = row.split(',');
    const layer = (cells[3] || '').trim();
    const key   = cells[2] + ',' + cells[3];
    if (!MAIN_LAYERS.includes(layer) || seen.has(key)) return;
    seen.add(key);
    const tfa = _mfFmt(_mfCalcTotalFloorArea(cells, parsedData));
    const da  = _mfFmt(_mfCalcDeductedArea(cells, parsedData));
    tableData.push({
      floor:          cells[2],
      layer,
      totalFloorArea: tfa,
      deductedArea:   da,
      netArea:        _mfFmt(_mfNetAreaCalc(tfa, da)),
      carpetArea:     _mfFmt(_mfCalcCarpetArea(cells, parsedData)),
    });
  });

  tableData.sort((a, b) => parseFloat(a.floor) - parseFloat(b.floor));

  const totals = { tfa:0, da:0, na:0, ca:0 };
  tableData.forEach(d => {
    const tr = document.createElement('tr');
    [d.floor, d.layer, d.totalFloorArea, d.deductedArea, d.netArea, d.carpetArea].forEach(v => {
      const td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
    });
    tbody.appendChild(tr);
    totals.tfa += parseFloat(d.totalFloorArea) || 0;
    totals.da  += parseFloat(d.deductedArea)   || 0;
    totals.na  += parseFloat(d.netArea)         || 0;
    totals.ca  += parseFloat(d.carpetArea)      || 0;
  });

  /* Save EFA/NFA for Occupancy tab */
  localStorage.setItem('effectiveFloorAreaSum', totals.tfa.toFixed(3));
  localStorage.setItem('netFloorAreaSum',        totals.na.toFixed(3));

  const totRow = document.createElement('tr');
  ['','Total', totals.tfa.toFixed(3), totals.da.toFixed(3), totals.na.toFixed(3), totals.ca.toFixed(3)].forEach(v => {
    const td = document.createElement('td'); td.textContent = v; totRow.appendChild(td);
  });
  tfoot.appendChild(totRow);
  table.appendChild(tbody); table.appendChild(tfoot);
  wrap.appendChild(table); wrapper.appendChild(wrap);
  return wrapper;
}

/* ══════════════════════════════════════════
   BUILD: Other Tables
══════════════════════════════════════════ */
function _mfBuildOtherTables(csv, parsedData, osLayer, htLayer, fhLayer) {
  const MAIN_LAYERS   = [
    'Residential','Mercantile_wholesale','Mercantile_retail','Business',
    'Institutional','Storage','Assembly','Hazardous','Industrial','Educational',
  ];
  const SPECIAL_LAYERS = [fhLayer, htLayer, osLayer, 'Road', 'Corridor'];
  const HIDDEN_LAYERS  = [
    'Plot','Parking','Tenement','Tenement_Ext_1','Tenement_Single','Tenement_Single_Ext_1',
  ];

  const rows         = csv.split('\n');
  const seenPerLayer = {};
  const layerData    = {};

  rows.forEach((row, i) => {
    if (!i || !row.trim()) return;
    const cells = row.split(',');
    const layer = (cells[3] || '').trim();
    const key   = cells[2] + ',' + cells[3];
    if (MAIN_LAYERS.includes(layer) || HIDDEN_LAYERS.includes(layer)) return;
    if (!seenPerLayer[layer]) seenPerLayer[layer] = new Set();
    if (seenPerLayer[layer].has(key)) return;
    seenPerLayer[layer].add(key);
    if (!layerData[layer]) layerData[layer] = [];
    const tfa = _mfFmt(_mfCalcTotalFloorArea(cells, parsedData));
    const da  = _mfFmt(_mfCalcDeductedArea(cells, parsedData));
    layerData[layer].push({
      floor:          cells[2],
      layer,
      totalFloorArea: tfa,
      deductedArea:   da,
      netArea:        _mfFmt(_mfNetAreaCalc(tfa, da)),
      length:         parseFloat(cells[4]) || 0,
      linetype:       cells[5] || '',
      lineweight:     cells[6] || '',
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

    const wrap  = document.createElement('div'); wrap.className = 'table-wrap';
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    const tfoot = document.createElement('tfoot');

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

    const totals = { length:0, tfa:0, da:0, na:0 };

    layerData[layer].forEach(d => {
      const tr = tbody.insertRow();
      tr.insertCell().textContent = d.floor;
      tr.insertCell().textContent = d.layer;

      if (layer === 'Lift') {
        tr.insertCell().textContent = d.totalFloorArea;
        tr.insertCell().textContent = d.deductedArea;
        /* Check each individual DASHED Lift polyline — report lineweight not colour */
        parsedData.forEach(p => {
          if ((p.column4 || '').trim() === 'Lift' &&
              p.column3 === d.floor &&
              p.column6 === 'DASHED' &&
              p.column8 > 5) {
            const lw = (p.column7 || '').trim() || 'unknown';
            _mfErrors.push(
              `${_mfErrCount++}. Lift Lobby Area (Lineweight: ${lw}) exceeds limit of 5 sq.m (Value: ${p.column8.toFixed(3)} sq.m)`
            );
          }
        });
        totals.tfa += parseFloat(d.totalFloorArea) || 0;
        totals.da  += parseFloat(d.deductedArea) || 0;
      } else if (SPECIAL_LAYERS.includes(layer)) {
        tr.insertCell().textContent = d.length;
        tr.insertCell().textContent = d.linetype;
        tr.insertCell().textContent = d.lineweight;
        totals.length += d.length;
      } else {
        tr.insertCell().textContent = d.totalFloorArea;
        tr.insertCell().textContent = d.deductedArea;
        tr.insertCell().textContent = d.netArea;
        totals.tfa += parseFloat(d.totalFloorArea) || 0;
        totals.da  += parseFloat(d.deductedArea)   || 0;
        totals.na  += parseFloat(d.netArea)         || 0;
      }
    });

    const totRow = tfoot.insertRow();
    totRow.insertCell().textContent = '';
    totRow.insertCell().textContent = 'Total';
    if (layer === 'Lift') {
      totRow.insertCell().textContent = totals.tfa.toFixed(3);
      totRow.insertCell().textContent = totals.da.toFixed(3);
    } else if (SPECIAL_LAYERS.includes(layer)) {
      totRow.insertCell().textContent = totals.length.toFixed(3);
      totRow.insertCell().textContent = '';
      totRow.insertCell().textContent = '';
    } else {
      totRow.insertCell().textContent = totals.tfa.toFixed(3);
      totRow.insertCell().textContent = totals.da.toFixed(3);
      totRow.insertCell().textContent = totals.na.toFixed(3);
    }

    table.appendChild(tbody); table.appendChild(tfoot);
    wrap.appendChild(table); block.appendChild(wrap);
    frag.appendChild(block);
  }

  return frag;
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function _mfParseCSV(csv) {
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

/* Rebuild CSV string from filteredData (keeps original header) */
function _mfRebuildCSV(originalCSV, filteredData) {
  const header = originalCSV.split('\n')[0];
  const dataLines = filteredData.map(r =>
    [r.column1,r.column2,r.column3,r.column4,r.column5,r.column6,r.column7,r.column8,r.column9].join(',')
  );
  return [header, ...dataLines].join('\n');
}

function _mfNetAreaForLayer(data, layerName) {
  let total = 0, deducted = 0;
  data.forEach(r => {
    if (r.column4 !== layerName) return;
    total += r.column8;
    if (r.column6 === 'DASHED') deducted += r.column8;
  });
  return (total - deducted).toFixed(3);
}

function _mfNetAreaForLayers(data, layerNames) {
  let total = 0, deducted = 0;
  data.forEach(r => {
    if (!layerNames.includes(r.column4)) return;
    total += r.column8;
    if (r.column6 === 'DASHED') deducted += r.column8;
  });
  return (total - deducted).toFixed(3);
}

function _mfLayerSum(layers, data) {
  let sum = 0;
  data.forEach(r => {
    const lyr = (r.column4 || '').trim();
    const clr = (r.column3 || '').trim().toLowerCase();
    if (!layers.includes(lyr)) return;
    if (lyr === 'Roof_Structure' && clr === 'cyan') return;
    sum += r.column8;
  });
  return sum.toFixed(3);
}

function _mfTotalAreaForLayer(data, layerName) {
  let total = 0, deducted = 0;
  data.forEach(r => {
    if (r.column4 !== layerName) return;
    total += r.column8;
    if (r.column6 === 'DASHED') deducted += r.column8;
  });
  return (total - deducted).toFixed(3);
}

function _mfCalcTotalFloorArea(cells, parsedData) {
  const VALID_LW = [
    '0.00 mm','0.05 mm','0.09 mm','0.13 mm','0.15 mm','0.18 mm','0.20 mm',
    '0.25 mm','0.30 mm','0.35 mm','0.40 mm','0.50 mm','0.60 mm','0.70 mm',
    '0.80 mm','0.90 mm','1.00 mm','1.06 mm','1.20 mm','1.40 mm','1.58 mm','2.11 mm',
  ];
  const SPECIAL = ['Splay','Tree Cover','Road','Stair','Lift','Existing','Parking_Area','Plot','Shaft','Strip','Waterbody'];
  const floorVal = cells[2], layerVal = (cells[3] || '').trim();
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

function _mfCalcDeductedArea(cells, parsedData) {
  const floorVal = cells[2], layerVal = (cells[3] || '').trim();
  let sum = 0;
  parsedData.forEach(d => {
    if (d.column3 === floorVal && d.column4 === layerVal && d.column6 === 'DASHED') sum += d.column8;
  });
  return sum.toFixed(3);
}

function _mfNetAreaCalc(total, deducted) {
  return (parseFloat(total) - parseFloat(deducted)).toFixed(3);
}

function _mfCalcCarpetArea(cells, parsedData) {
  const floorVal = cells[2], layerVal = (cells[3] || '').trim();
  let sum = 0;
  parsedData.forEach(d => {
    if (d.column3 === floorVal && d.column4 === layerVal && d.column7 === '0.15 mm') sum += d.column8;
  });
  return sum.toFixed(3);
}

function _mfFmt(v) {
  const n = parseFloat(v);
  return isNaN(n) ? '0.000' : n.toFixed(3);
}

/* ── Alert modal (reuses the same filteredAlertModal element) ── */
function _mfShowAlert(message) {
  const modal = document.getElementById('filteredAlertModal');
  const msgEl = document.getElementById('filteredAlertBody');
  if (!modal || !msgEl) return;
  msgEl.innerHTML = message;
  modal.classList.add('show');
  /* Wire close buttons */
  const close = () => modal.classList.remove('show');
  const cx = document.getElementById('filteredAlertClose');
  const cb = document.getElementById('filteredAlertCloseBtn');
  if (cx) cx.onclick = close;
  if (cb) cb.onclick = close;
}

/* ── Expose ── */
window.generateFilteredTablesMulti = generateFilteredTablesMulti;
window.initFilteredTables = function () { generateFilteredTablesMulti(); };
