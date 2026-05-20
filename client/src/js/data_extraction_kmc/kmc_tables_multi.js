/* ══════════════════════════════════════════
   kmc_tables_multi.js  —  Layer Tables for multi-block buildings
   Lazy-loaded by mRefreshTables() in index_kmc_multi.html.
   Reads:
     localStorage.csvData              — block-only or master CSV
     localStorage.MB_currentBlockIndex — 0=Block A, 1=Block B, -1=Master
     localStorage.MB_blockCount        — total number of blocks
   Exposes: window.generateTablesMulti()
══════════════════════════════════════════ */

/* ──────────────────────────────────────────
   BLOCK → COLOUR MAPPINGS  (from spec)
   Ground Coverage : block 0 (A) = colour 53, block 1 (B) = 54, ...
   Open Space      : block 0 = 53–62, block 1 = 63–72, ...
   Height          : block 0 = 0.15 mm, block 1 = 0.20 mm, ...
   Floor Height    : same lineweight scheme as Height
──────────────────────────────────────────*/
const _MB_LW_LIST = [
  '0.15 mm','0.20 mm','0.25 mm','0.30 mm','0.35 mm','0.40 mm','0.50 mm',
  '0.60 mm','0.70 mm','0.80 mm','0.90 mm',
];

/* Which Open Space layer name to use based on block count */
function _mbOpenSpaceLayer(blockCount) {
  if (blockCount >= 50) return 'Open Space_Ext_5';
  if (blockCount >= 40) return 'Open Space_Ext_4';
  if (blockCount >= 30) return 'Open Space_Ext_3';
  if (blockCount >= 20) return 'Open Space_Ext_2';
  if (blockCount >= 10) return 'Open Space_Ext_1';
  return 'Open Space';
}

/* Height/FloorHeight layer name based on block count */
function _mbHeightLayer(blockCount) {
  return blockCount > 24 ? 'Height_Ext_1' : 'Height';
}
function _mbFloorHeightLayer(blockCount) {
  return blockCount > 24 ? 'FloorHeight_Ext_1' : 'Floor Height';
}

/* Ground Coverage colour for this block index */
function _mbGCColour(blockIndex) {
  return 53 + blockIndex; // Block A=53, B=54, C=55...
}

/* Open Space colour range for this block index */
function _mbOSRange(blockIndex) {
  const base = 53 + blockIndex * 10;
  return { min: base, max: base + 9 };
}

/* Lineweight for this block's Height / Floor Height lines */
function _mbBlockLW(blockIndex) {
  return _MB_LW_LIST[blockIndex] || null;
}

/* ──────────────────────────────────────────
   MAIN ENTRY
──────────────────────────────────────────*/
function generateTablesMulti() {
  const container = document.getElementById('tables-container');
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

  const rows    = csv.split('\n').filter(r => r.trim());
  if (rows.length < 2) {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px 0">File appears to be empty.</p>';
    return;
  }

  const headers    = rows[0].split(',');
  const dataRows   = rows.slice(1);

  /* For Master view — group by layer exactly like single-building kmc_tables.js */
  if (isMaster) {
    _renderSimpleTables(container, headers, dataRows);
    return;
  }

  /* For block view — group by layer, with block-aware colour/lineweight annotation */
  const gcColour  = _mbGCColour(blockIndex);
  const osRange   = _mbOSRange(blockIndex);
  const blockLW   = _mbBlockLW(blockIndex);
  const osLayer   = _mbOpenSpaceLayer(blockCount);
  const htLayer   = _mbHeightLayer(blockCount);
  const fhLayer   = _mbFloorHeightLayer(blockCount);

  const categories = {};
  dataRows.forEach(row => {
    const cells    = row.split(',');
    const layer    = (cells[3] || '(none)').trim();
    const colour   = parseInt(cells[2], 10);
    const lw       = (cells[6] || '').trim();
    const nm       = (cells[1] || '').trim();

    /* ── Colour / lineweight filters for multi-block layers ── */
    if (!isMaster) {
      /* Ground Coverage: only rows matching this block's colour */
      if (layer === 'Ground Coverage' && !isNaN(colour) && colour !== gcColour) return;

      /* Open Space / Ext layers: only rows in this block's colour range */
      if (layer === osLayer) {
        if (!isNaN(colour) && (colour < osRange.min || colour > osRange.max)) return;
      }

      /* Height: only rows matching this block's lineweight (Lines only) */
      if (layer === htLayer && nm === 'Line' && blockLW && lw !== blockLW) return;

      /* Floor Height: only rows matching this block's lineweight (Lines only) */
      if (layer === fhLayer && nm === 'Line' && blockLW && lw !== blockLW) return;
    }

    if (!categories[layer]) categories[layer] = [];
    categories[layer].push(cells);
  });

  if (!Object.keys(categories).length) {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px 0">No data found for this block\'s colour/lineweight filters.</p>';
    return;
  }

  /* Render a table per layer */
  Object.keys(categories).sort().forEach(layer => {
    const title = document.createElement('h2');
    title.textContent = layer;
    title.style.cssText = [
      'font-family:var(--font-mono)',
      'font-size:.85rem','font-weight:700','text-transform:uppercase',
      'letter-spacing:.08em','color:var(--accent)',
      'margin:28px 0 10px','padding:8px 14px',
      'background:rgba(212,80,26,.06)',
      'border-left:3px solid var(--accent)',
      'border-radius:0 6px 6px 0',
    ].join(';');
    container.appendChild(title);

    /* Annotation badge for block-specific rules */
    const badge = _mbLayerBadge(layer, blockIndex, blockLW, gcColour, osRange, osLayer, htLayer, fhLayer);
    if (badge) container.appendChild(badge);

    const wrap  = document.createElement('div');
    wrap.className    = 'table-wrap';
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

    categories[layer].forEach(cells => {
      const tr = document.createElement('tr');
      cells.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = (cell || '').trim();
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

/* Render unfiltered layer tables (Master view or no block index) */
function _renderSimpleTables(container, headers, dataRows) {
  const categories = {};
  dataRows.forEach(row => {
    const cells    = row.split(',');
    const category = (cells[3] || '(none)').trim();
    if (!categories[category]) categories[category] = [];
    categories[category].push(cells);
  });

  Object.keys(categories).sort().forEach(category => {
    const title = document.createElement('h2');
    title.textContent = category;
    title.style.cssText = [
      'font-family:var(--font-mono)','font-size:.85rem','font-weight:700',
      'text-transform:uppercase','letter-spacing:.08em','color:var(--accent)',
      'margin:28px 0 10px','padding:8px 14px',
      'background:rgba(212,80,26,.06)',
      'border-left:3px solid var(--accent)',
      'border-radius:0 6px 6px 0',
    ].join(';');
    container.appendChild(title);

    const wrap  = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.style.marginBottom = '10px';

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    const hRow = document.createElement('tr');
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h.trim();
      hRow.appendChild(th);
    });
    thead.appendChild(hRow);

    categories[category].forEach(cells => {
      const tr = document.createElement('tr');
      cells.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = (cell || '').trim();
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

/* Small info badge showing which colour / lineweight filter was applied */
function _mbLayerBadge(layer, blockIndex, blockLW, gcColour, osRange, osLayer, htLayer, fhLayer) {
  let text = null;
  const blockLabel = String.fromCharCode(65 + blockIndex); // A, B, C...

  if (layer === 'Ground Coverage') {
    text = `Block ${blockLabel}: Colour ${gcColour} only`;
  } else if (layer === osLayer) {
    text = `Block ${blockLabel}: Colour ${osRange.min}–${osRange.max} only`;
  } else if ((layer === htLayer || layer === fhLayer) && blockLW) {
    text = `Block ${blockLabel}: Lineweight ${blockLW} (Lines) only`;
  }

  if (!text) return null;

  const div = document.createElement('div');
  div.style.cssText = [
    'display:inline-block','margin:-6px 0 10px',
    'padding:3px 10px','border-radius:12px',
    'font-family:var(--font-mono)','font-size:.7rem','font-weight:600',
    'background:rgba(26,153,212,.1)','color:var(--accent)',
    'border:1px solid rgba(26,153,212,.25)',
  ].join(';');
  div.textContent = '⚙ ' + text;
  return div;
}

/* ── Expose ── */
window.generateTablesMulti = generateTablesMulti;
window.initLayerTables     = function () { generateTablesMulti(); };
