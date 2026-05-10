/* ══════════════════════════════════════════
   kmc_sanction.js  —  Floor Area Table tab logic
   Lazy-loaded on first click of Floor Area Table tab.
   Ported from: sanction.js + check.js
   Exposes: window.initSanctionTables()
            window.generateSanctionTables()  (called by Refresh button)
══════════════════════════════════════════ */

/* ──────────────────────────────────────────
   INIT — called by kmc_core.js switchTab
   after this file is first loaded.
──────────────────────────────────────────*/
window.initSanctionTables = function () {
  generateSanctionTables();
};

/* ══════════════════════════════════════════
   MAIN ENTRY POINT
══════════════════════════════════════════ */
function generateSanctionTables() {
  const csv = localStorage.getItem('csvData');
  if (!csv) return;

  _resetFloorTable();
  _resetCompareTable();

  _buildFloorAreaTable(csv);
  _buildComparativeTable(csv);
}

/* ──────────────────────────────────────────
   RESET HELPERS — clear tbody & totals
   so Refresh produces a clean table
──────────────────────────────────────────*/
function _resetFloorTable() {
  const tbl = document.getElementById('sanction-floor-table');
  if (!tbl) return;
  tbl.querySelector('tbody').innerHTML = '';
  ['s-total-floor-area','s-total-stair-well','s-total-lift-well',
   's-total-duct-cutout','s-total-effective-floor-area',
   's-total-stairway','s-total-lift-lobby','s-total-net-floor-area'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '0.000';
  });
}

function _resetCompareTable() {
  const tbl = document.getElementById('sanction-compare-table');
  if (!tbl) return;
  tbl.querySelector('tbody').innerHTML = '';
  ['s-total-floor-area-secondary','s-total-common-parking-tenements','s-difference'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '0.000';
  });
  const container = document.getElementById('sanction-compare-container');
  if (container) container.style.display = 'none';
  const warnStrip = document.getElementById('sanction-warn-strip');
  if (warnStrip) warnStrip.style.display = 'none';
}

/* ══════════════════════════════════════════
   FLOOR AREA TABLE  (ported from sanction.js)
══════════════════════════════════════════ */
function _buildFloorAreaTable(csv) {
  const validLayers = [
    'Residential', 'Mercantile_wholesale', 'Mercantile_retail', 'Business',
    'Institutional', 'Storage', 'Assembly', 'Hazardous', 'Industrial', 'Educational'
  ];

  const rows          = csv.split('\n');
  const mainTableData = _parseCSV(csv);

  const tableBody                  = document.getElementById('sanction-floor-table').querySelector('tbody');
  const totalFloorAreaCell         = document.getElementById('s-total-floor-area');
  const totalStairWellCell         = document.getElementById('s-total-stair-well');
  const totalLiftWellCell          = document.getElementById('s-total-lift-well');
  const totalDuctCutoutCell        = document.getElementById('s-total-duct-cutout');
  const totalEffectiveFloorCell    = document.getElementById('s-total-effective-floor-area');
  const totalStairwayCell          = document.getElementById('s-total-stairway');
  const totalLiftLobbyCell         = document.getElementById('s-total-lift-lobby');
  const totalNetFloorAreaCell      = document.getElementById('s-total-net-floor-area');

  const uniqueColors      = new Set();
  const totalAreas        = {};
  const stairWellAreas    = {};
  const liftWellAreas     = {};
  const ductCutoutAreas   = {};
  const stairwayAreas     = {};
  const liftLobbyAreas    = {};

  /* ── Pass 1: Total Floor Area per colour ── */
  rows.forEach((row, index) => {
    if (index === 0 || !row.trim()) return;
    const cells = row.split(',');
    const color = cells[2];
    const layer = cells[3];

    if (!validLayers.includes(layer)) return;
    uniqueColors.add(color);
    if (!totalAreas[color]) totalAreas[color] = 0;
    if (cells[5] === 'ByLayer' && cells[6] === 'ByLayer' &&
        cells[1] === 'Polyline' && cells[8] === '-1') {
      totalAreas[color] += parseFloat(cells[7] || 0);
    }
  });

  /* ── Pass 2: Stair Well, Lift Well, Duct/Cutout, Stairway, Lift Lobby ── */
  mainTableData.forEach(row => {
    const name       = row.column2;
    const color      = row.column3;
    const layer      = row.column4;
    const linetype   = row.column6;
    const area       = row.column8;
    const closed     = row.column9;

    // Stair Well
    if (layer === 'Stair' && linetype === 'DASHED' && name === 'Polyline' && closed === '-1') {
      if (!stairWellAreas[color]) stairWellAreas[color] = 0;
      stairWellAreas[color] += area;
    }

    // Lift Well
    if (layer === 'Lift' && linetype === 'ByLayer' && name === 'Polyline' && closed === '-1') {
      if (!liftWellAreas[color]) liftWellAreas[color] = 0;
      liftWellAreas[color] += area;
    }

    // Duct/Cutout (DASHED rows of valid layers)
    if (validLayers.includes(layer) && linetype === 'DASHED' && name === 'Polyline' && closed === '-1') {
      if (!ductCutoutAreas[color]) ductCutoutAreas[color] = 0;
      ductCutoutAreas[color] += area;
    }

    // Stairway (non-DASHED Stair)
    if (layer === 'Stair' && linetype !== 'DASHED' && name === 'Polyline' && closed === '-1') {
      if (!stairwayAreas[color]) stairwayAreas[color] = 0;
      stairwayAreas[color] += area;
    }

    // Lift Lobby
    if (layer === 'Lift' && linetype === 'DASHED' && name === 'Polyline' && closed === '-1') {
      if (!liftLobbyAreas[color]) liftLobbyAreas[color] = 0;
      liftLobbyAreas[color] += area;
    }
  });

  /* ── Pass 3: Deduct DASHED Stair from Stairway ── */
  mainTableData.forEach(row => {
    const name     = row.column2;
    const color    = row.column3;
    const layer    = row.column4;
    const linetype = row.column6;
    const area     = row.column8;
    const closed   = row.column9;
    if (layer === 'Stair' && linetype === 'DASHED' && name === 'Polyline' && closed === '-1') {
      if (stairwayAreas[color]) stairwayAreas[color] -= area;
    }
  });

  /* ── Pass 4: Recalculate Duct/Cutout (subtract StairWell + LiftWell) ── */
  uniqueColors.forEach(color => {
    const totalDuct    = ductCutoutAreas[color] || 0;
    const stairWell    = stairWellAreas[color]  || 0;
    const liftWell     = liftWellAreas[color]   || 0;
    ductCutoutAreas[color] = totalDuct - stairWell - liftWell;
  });

  /* ── Pass 5: Adjust Stair Well / Lift Well for shared lineweights ── */
  const filteredData       = _filterAndFindMinColorByLineweight(mainTableData);
  const areasByCombination = _calculateAreasByCombination(filteredData, mainTableData);

  Object.entries(areasByCombination.Stair).forEach(([lineweight, colorAreas]) => {
    Object.entries(colorAreas).forEach(([color, area]) => {
      if (stairWellAreas[color]) {
        stairWellAreas[color]  -= area;
        ductCutoutAreas[color] += area;
      }
    });
  });

  Object.entries(areasByCombination.Lift).forEach(([lineweight, colorAreas]) => {
    Object.entries(colorAreas).forEach(([color, area]) => {
      if (liftWellAreas[color]) {
        liftWellAreas[color]   -= area;
        ductCutoutAreas[color] += area;
      }
    });
  });

  /* ── Build sorted data array & render rows ── */
  const sortedData = Array.from(uniqueColors).map(color => ({
    color,
    totalArea:      totalAreas[color]      || 0,
    stairWellArea:  stairWellAreas[color]  || 0,
    liftWellArea:   liftWellAreas[color]   || 0,
    ductCutoutArea: ductCutoutAreas[color] || 0,
    stairwayArea:   stairwayAreas[color]   || 0,
    liftLobbyArea:  liftLobbyAreas[color]  || 0,
  }));
  sortedData.sort((a, b) => a.color - b.color);

  let totalSum            = 0;
  let stairWellSum        = 0;
  let liftWellSum         = 0;
  let ductCutoutSum       = 0;
  let effectiveFloorSum   = 0;
  let stairwaySum         = 0;
  let liftLobbySum        = 0;
  let netFloorAreaSum     = 0;

  sortedData.forEach(d => {
    const effectiveFloor = d.totalArea - d.stairWellArea - d.liftWellArea - d.ductCutoutArea;
    const netFloorArea   = effectiveFloor - d.stairwayArea - d.liftLobbyArea;

    const tr = tableBody.insertRow();
    [
      d.color,
      _fmt(d.totalArea),
      _fmt(d.stairWellArea),
      _fmt(d.liftWellArea),
      _fmt(d.ductCutoutArea),
      _fmt(effectiveFloor),
      _fmt(d.stairwayArea),
      _fmt(d.liftLobbyArea),
      _fmt(netFloorArea),
    ].forEach(v => { tr.insertCell().textContent = v; });

    totalSum          += d.totalArea;
    stairWellSum      += d.stairWellArea;
    liftWellSum       += d.liftWellArea;
    ductCutoutSum     += d.ductCutoutArea;
    effectiveFloorSum += effectiveFloor;
    stairwaySum       += d.stairwayArea;
    liftLobbySum      += d.liftLobbyArea;
    netFloorAreaSum   += netFloorArea;
  });

  // Totals row
  totalFloorAreaCell.textContent      = _fmt(totalSum);
  totalStairWellCell.textContent      = _fmt(stairWellSum);
  totalLiftWellCell.textContent       = _fmt(liftWellSum);
  totalDuctCutoutCell.textContent     = _fmt(ductCutoutSum);
  totalEffectiveFloorCell.textContent = _fmt(effectiveFloorSum);
  totalStairwayCell.textContent       = _fmt(stairwaySum);
  totalLiftLobbyCell.textContent      = _fmt(liftLobbySum);
  totalNetFloorAreaCell.textContent   = _fmt(netFloorAreaSum);

  // Save to localStorage for downstream use
  localStorage.setItem('effectiveFloorAreaSum', effectiveFloorSum);
  localStorage.setItem('netFloorAreaSum', netFloorAreaSum);
}

/* ══════════════════════════════════════════
   COMPARATIVE TABLE  (ported from check.js)
══════════════════════════════════════════ */
function _buildComparativeTable(csv) {
  const validLayers = ['Residential'];
  const otherLayers = [
    'Common Area', 'Parking_Area',
    'Tenement', 'Tenement_Ext_1', 'Tenement_Single', 'Tenement_Single_Ext_1'
  ];

  const rows = csv.split('\n');

  const tableBody          = document.getElementById('sanction-compare-table').querySelector('tbody');
  const totalFloorCell     = document.getElementById('s-total-floor-area-secondary');
  const otherAreaCell      = document.getElementById('s-total-common-parking-tenements');
  const differenceCell     = document.getElementById('s-difference');

  const uniqueColors  = new Set();
  const totalAreas    = {};
  const otherAreas    = {};

  rows.forEach((row, index) => {
    if (index === 0 || !row.trim()) return;
    const cells = row.split(',');
    const color = cells[2];
    const layer = cells[3];

    /* ── Residential total area ── */
    if (validLayers.includes(layer)) {
      uniqueColors.add(color);
      if (!totalAreas[color]) totalAreas[color] = 0;

      // Add
      if (cells[5] === 'ByLayer' && cells[6] === 'ByLayer' &&
          cells[1] === 'Polyline' && (cells[8] === '-1' || cells[8] === 'TURE')) {
        totalAreas[color] += parseFloat(cells[7] || 0);
      }
      // Deduct
      if (cells[5] === 'DASHED' && cells[6] === 'ByLayer' &&
          cells[1] === 'Polyline' && (cells[8] === '-1' || cells[8] === 'TURE')) {
        totalAreas[color] -= parseFloat(cells[7] || 0);
      }
    }

    /* ── Other layers (Common Area, Parking, Tenements) ── */
    if (otherLayers.includes(layer)) {
      uniqueColors.add(color);
      if (!otherAreas[color]) otherAreas[color] = 0;

      switch (layer) {
        case 'Common Area':
          if (cells[5] === 'ByLayer' && cells[6] === 'ByLayer' &&
              cells[1] === 'Polyline' && cells[8] === '-1')
            otherAreas[color] += parseFloat(cells[7] || 0);
          if (cells[5] === 'DASHED' && cells[6] === 'ByLayer' &&
              cells[1] === 'Polyline' && cells[8] === '-1')
            otherAreas[color] -= parseFloat(cells[7] || 0);
          break;

        case 'Parking_Area':
        case 'Tenement':
        case 'Tenement_Ext_1':
        case 'Tenement_Single':
        case 'Tenement_Single_Ext_1':
          if (cells[5] === 'ByLayer' && cells[6] !== 'ByLayer' &&
              cells[1] === 'Polyline' && cells[8] === '-1')
            otherAreas[color] += parseFloat(cells[7] || 0);
          if (cells[5] === 'DASHED' && cells[6] !== 'ByLayer' &&
              cells[1] === 'Polyline' && cells[8] === '-1')
            otherAreas[color] -= parseFloat(cells[7] || 0);
          break;

        default:
          console.warn('[kmc_sanction] Unknown layer in comparative table:', layer);
      }
    }
  });

  /* ── Sort and render ── */
  const sortedData = Array.from(uniqueColors)
    .map(color => ({
      color,
      totalArea: totalAreas[color] || 0,
      otherArea: otherAreas[color] || 0,
    }))
    .sort((a, b) => a.color - b.color);

  let totalSum      = 0;
  let otherSum      = 0;
  let differenceSum = 0;

  sortedData.forEach(d => {
    const diff = d.totalArea - d.otherArea;
    const tr = tableBody.insertRow();
    tr.insertCell().textContent = d.color;
    tr.insertCell().textContent = _fmt(d.totalArea);
    tr.insertCell().textContent = _fmt(d.otherArea);
    tr.insertCell().textContent = _fmt(diff);
    totalSum      += d.totalArea;
    otherSum      += d.otherArea;
    differenceSum += diff;
  });

  totalFloorCell.textContent  = _fmt(totalSum);
  otherAreaCell.textContent   = _fmt(otherSum);
  differenceCell.textContent  = _fmt(differenceSum);

  /* ── Decide whether to show the comparative table ── */
  const validRowCount = sortedData.length;
  const threshold     = validRowCount / 1000;
  const container     = document.getElementById('sanction-compare-container');
  const warnStrip     = document.getElementById('sanction-warn-strip');

  if (Math.abs(differenceSum) <= threshold) {
    // Values match — hide comparative table
    if (container) container.style.display = 'none';
  } else {
    // Mismatch — show table + warning strip (no alert() — uses inline warning instead)
    if (container) container.style.display = 'block';
    if (warnStrip) warnStrip.style.display = 'flex';
  }

  console.log('[kmc_sanction] Comparative difference:', differenceSum.toFixed(3));
}

/* ══════════════════════════════════════════
   STAIR / LIFT LINEWEIGHT HELPERS
   (direct port from sanction.js)
══════════════════════════════════════════ */
function _filterAndFindMinColorByLineweight(data) {
  const stairMin = {};
  const liftMin  = {};

  data.forEach(row => {
    if (row.column2 !== 'Polyline' || row.column9 !== '-1') return;
    const layer      = row.column4;
    const lineweight = row.column7;
    const color      = parseInt(row.column3, 10);

    if (layer === 'Stair') {
      if (!stairMin[lineweight] || color < stairMin[lineweight]) stairMin[lineweight] = color;
    } else if (layer === 'Lift') {
      if (!liftMin[lineweight]  || color < liftMin[lineweight])  liftMin[lineweight]  = color;
    }
  });

  return { stairMinColorByLineweight: stairMin, liftMinColorByLineweight: liftMin };
}

function _calculateAreasByCombination({ stairMinColorByLineweight, liftMinColorByLineweight }, data) {
  const areas = { Stair: {}, Lift: {} };

  function accumulate(layer, minByLW, linetypeFilter, areasObj) {
    Object.entries(minByLW).forEach(([lineweight, minColor]) => {
      data.forEach(row => {
        const rowColor     = parseInt(row.column3, 10);
        const rowLineweight = row.column7;
        const rowLinetype  = row.column6;
        const rowLayer     = row.column4;
        const rowClosed    = row.column9;

        if (rowLayer      !== layer       ||
            rowLineweight !== lineweight  ||
            rowColor      !== minColor    ||
            rowLinetype   !== linetypeFilter ||
            rowClosed     !== '-1') return;

        const color = row.column3;
        const area  = row.column8;
        if (!areasObj[lineweight])        areasObj[lineweight]        = {};
        if (!areasObj[lineweight][color]) areasObj[lineweight][color] = 0;
        areasObj[lineweight][color] += area;
      });
    });
  }

  accumulate('Stair', stairMinColorByLineweight, 'DASHED',   areas.Stair);
  accumulate('Lift',  liftMinColorByLineweight,  'ByLayer',  areas.Lift);

  return areas;
}

/* ══════════════════════════════════════════
   CSV PARSER  (same format as sanction.js)
   Uses real \n — consistent with index_kmc.js storage
══════════════════════════════════════════ */
function _parseCSV(csv) {
  return csv.split('\n')
    .filter((row, i) => i !== 0 && row.trim())
    .map(row => {
      const c = row.split(',');
      return {
        column1: c[0],
        column2: c[1],
        column3: c[2],
        column4: c[3],
        column5: c[4],
        column6: c[5],
        column7: c[6],
        column8: parseFloat(c[7]) || 0,
        column9: (c[8] || '').trim(),
      };
    });
}

function _fmt(value) {
  const n = parseFloat(value);
  return isNaN(n) ? '0.000' : n.toFixed(3);
}
