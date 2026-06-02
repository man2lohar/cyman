/* ══════════════════════════════════════════
   kmc_parking.js  —  Parking Calculation tab
   Exposes: window.initParkingTables()
            window.generateParkingTables()

   ASSEMBLY sub-tables (KMC Rule 78 Cl.IV):
     1. General (ByLayer/ByLayer)       → 1 per 65 sqm, min 1
     2. Star Hotel (PHANTOM/ByLayer)    → 1 per 120 sqm, min 2
     3. Hotel+Banquet (PHANTOM2/ByLayer)→ 1 per 60 sqm (full net area)
     4. Boarding & Guest House          → combined with General table
        (indistinguishable in CAD)
   EDUCATIONAL (KMC Rule 78 Cl.II):
     Car: 1 per 400 sqm, min 1 if >100 sqm
     Bus: 1 per 1000 sqm (separate footer row, excluded from grand total)
   BUS & TRUCK PROVIDED (Color 10 / 15):
     Separate table, 50 sqm per slot
══════════════════════════════════════════ */

window.initParkingTables = function () { generateParkingTables(); };

function generateParkingTables() {
  const csv = localStorage.getItem('csvData');
  if (!csv) return;
  _resetParkingSection();
  _buildTenementTable(csv);
  _buildOtherLayersParking(csv);
  _buildProvidedParking(csv);
}

/* ──────────────────────────────────────────
   RESET
──────────────────────────────────────────*/
function _resetParkingSection() {
  ['p-tenement-header','p-common-area-header'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = '';
  });
  ['p-tenement-table','p-common-area-table'].forEach(id => {
    const tbl = document.getElementById(id); if (!tbl) return;
    const tb = tbl.querySelector('tbody'); const tf = tbl.querySelector('tfoot');
    if (tb) tb.innerHTML = ''; if (tf) tf.innerHTML = '';
  });
  const oc = document.getElementById('p-other-layers-container');
  if (oc) oc.innerHTML = '';
  const ppHeader = document.getElementById('p-parking-provided-header');
  const ppFooter = document.getElementById('p-parking-provided-footer');
  const ppTable  = document.getElementById('p-parking-provided-table');
  if (ppHeader) ppHeader.innerHTML = '';
  if (ppFooter) ppFooter.innerHTML = '';
  if (ppTable)  { const tb = ppTable.querySelector('tbody'); if (tb) tb.innerHTML = ''; }
  ['totalParkingNos','totalParkingArea','totalReqCarParking',
   'totalParkingRequired','reqParkingArea','totalBusTruckNos','totalBusTruckArea'
  ].forEach(k => localStorage.removeItem(k));
}

/* ══════════════════════════════════════════
   SECTION 1 — TENEMENT PARKING
══════════════════════════════════════════ */
function _buildTenementTable(csv) {
  const commonAreaData = _filterCommonAreaData(csv);
  const tenementData   = _filterTenementData(csv, commonAreaData);
  _displayTenementTable(tenementData, 'p-tenement-table', 'p-tenement-header');
  _displayCommonAreaTable(commonAreaData, 'p-common-area-table', 'p-common-area-header');
}

function _filterCommonAreaData(csv) {
  const rows    = csv.split('\n');
  const headers = rows[0].split(',');
  const floorIdx    = headers.indexOf('Color');
  const linetypeIdx = headers.indexOf('Linetype');
  const areaIdx     = headers.indexOf('Area');
  const layerIdx    = headers.indexOf('Layer');
  const entries = new Map();
  rows.slice(1).forEach(row => {
    if (!row.trim()) return;
    const cells = row.split(',');
    if (cells[layerIdx] !== 'Common Area') return;
    const key = cells[floorIdx];
    if (!entries.has(key)) entries.set(key, { floor: cells[floorIdx], totalArea: 0, deductArea: 0 });
    const e = entries.get(key);
    if (cells[linetypeIdx] === 'DASHED') e.deductArea += parseFloat(cells[areaIdx]) || 0;
    else                                 e.totalArea  += parseFloat(cells[areaIdx]) || 0;
  });
  let totalArea = 0;
  const out = ['Floor,Total Area'];
  entries.forEach(e => {
    const final = e.totalArea - e.deductArea;
    out.push(`${e.floor},${final.toFixed(3)}`);
    totalArea += final;
  });
  out.push(`Total,${totalArea.toFixed(3)}`);
  return out.join('\n');
}

function _filterTenementData(csv, commonAreaData) {
  const rows    = csv.split('\n');
  const headers = rows[0].split(',');
  const floorIdx    = headers.indexOf('Color');
  const typeIdx     = headers.indexOf('Layer');
  const lwIdx       = headers.indexOf('Lineweight');
  const ltIdx       = headers.indexOf('Linetype');
  const areaIdx     = headers.indexOf('Area');
  const commonAreaRows = commonAreaData.split('\n').slice(1, -1);
  const commonAreaMap  = new Map();
  commonAreaRows.forEach(row => {
    const [floor, total] = row.split(',');
    commonAreaMap.set(floor, parseFloat(total));
  });
  const uniqueEntries = new Map();
  rows.slice(1).forEach(row => {
    if (!row.trim()) return;
    const cells = row.split(',');
    const type  = cells[typeIdx];
    const lt    = cells[ltIdx];
    const area  = parseFloat(cells[areaIdx]) || 0;
    if (['Tenement','Tenement_Ext_1'].includes(type)) {
      const key = `${cells[floorIdx]},${cells[lwIdx]}`;
      if (!uniqueEntries.has(key)) {
        uniqueEntries.set(key, { floor: cells[floorIdx], tenementType: type, lineweight: cells[lwIdx],
          coveredArea: lt === 'ByLayer' ? area : 0, deductArea: lt === 'DASHED' ? area : 0,
          shareOfCommonArea: 0, tenementArea: 0, tenementRange: '' });
      } else {
        const e = uniqueEntries.get(key);
        if (lt === 'ByLayer') e.coveredArea += area;
        else if (lt === 'DASHED') e.deductArea += area;
      }
    } else if (['Tenement_Single','Tenement_Single_Ext_1'].includes(type)) {
      const key = `${type},${cells[lwIdx]}`;
      if (!uniqueEntries.has(key)) {
        uniqueEntries.set(key, { floor: cells[floorIdx], tenementType: type, lineweight: cells[lwIdx],
          coveredArea: lt === 'ByLayer' ? area : 0, deductArea: lt === 'DASHED' ? area : 0,
          shareOfCommonArea: 0, tenementArea: 0, tenementRange: '' });
      } else {
        const e = uniqueEntries.get(key);
        if (cells[floorIdx] < e.floor) e.floor = cells[floorIdx];
        if (lt === 'ByLayer') e.coveredArea += area;
        else if (lt === 'DASHED') e.deductArea += area;
      }
    }
  });
  let totalCoveredArea = 0;
  uniqueEntries.forEach(e => { e.coveredArea -= e.deductArea; totalCoveredArea += e.coveredArea; });
  const commonAreaTotal = Array.from(commonAreaMap.values()).reduce((s, a) => s + a, 0);
  uniqueEntries.forEach(e => {
    e.shareOfCommonArea = totalCoveredArea > 0 ? (commonAreaTotal / totalCoveredArea) * e.coveredArea : 0;
    e.tenementArea = e.coveredArea + e.shareOfCommonArea;
    if (['Tenement','Tenement_Ext_1'].includes(e.tenementType)) {
      if      (e.tenementArea < 50)  e.tenementRange = 'BELOW 50';
      else if (e.tenementArea < 75)  e.tenementRange = '50 - 75';
      else if (e.tenementArea < 100) e.tenementRange = '75 - 100';
      else                           e.tenementRange = 'ABOVE 100';
    } else {
      if      (e.tenementArea < 100) e.tenementRange = 'BELOW 100';
      else if (e.tenementArea < 200) e.tenementRange = 'ABOVE 100';
      else                           e.tenementRange = 'ABOVE 200';
    }
  });
  const newHeaders = ['Floor','Flat Name','Tenement Type','Lineweight','Covered Area','Share of Common Area','Tenement Area','Tenement Range'];
  const out = [newHeaders.join(',')];
  let totShare = 0, totTenement = 0, totCovered = 0;
  const floorGroup = new Map();
  uniqueEntries.forEach(e => {
    if (!floorGroup.has(e.floor)) floorGroup.set(e.floor, []);
    floorGroup.get(e.floor).push(e);
  });
  floorGroup.forEach((entries, floor) => {
    entries.sort((a, b) => a.lineweight - b.lineweight);
    entries.forEach((e, i) => {
      const flatName = String.fromCharCode(65 + i) + floor.slice(-2);
      out.push([e.floor, flatName, e.tenementType, e.lineweight,
        e.coveredArea.toFixed(3), e.shareOfCommonArea.toFixed(3),
        e.tenementArea.toFixed(3), e.tenementRange].join(','));
      totShare    += e.shareOfCommonArea;
      totTenement += e.tenementArea;
      totCovered  += e.coveredArea;
    });
  });
  out.push(['Total','','','', totCovered.toFixed(3), totShare.toFixed(3), totTenement.toFixed(3), ''].join(','));
  return out.join('\n');
}

function _displayCommonAreaTable(data, tableId, headerId) {
  const rows   = data.split('\n');
  const table  = document.getElementById(tableId); if (!table) return;
  const header = document.getElementById(headerId);
  const tbody  = table.querySelector('tbody');
  const tfoot  = table.querySelector('tfoot');
  header.innerHTML = ''; tbody.innerHTML = ''; tfoot.innerHTML = '';
  rows[0].split(',').forEach(h => { const th = document.createElement('th'); th.textContent = h; header.appendChild(th); });
  rows.slice(1, -1).forEach(row => {
    if (!row.trim()) return;
    const tr = tbody.insertRow();
    row.split(',').forEach(c => { tr.insertCell().textContent = c; });
  });
  const totRow = document.createElement('tr');
  rows[rows.length - 1].split(',').forEach(c => {
    const td = document.createElement('td'); td.textContent = c; totRow.appendChild(td);
  });
  tfoot.appendChild(totRow);
}

function _displayTenementTable(data, tableId, headerId) {
  const rows   = data.split('\n');
  const table  = document.getElementById(tableId); if (!table) return;
  const header = document.getElementById(headerId);
  const tbody  = table.querySelector('tbody');
  const tfoot  = table.querySelector('tfoot');
  header.innerHTML = ''; tbody.innerHTML = ''; tfoot.innerHTML = '';
  rows[0].split(',').forEach(h => {
    if (h === 'Floor' || h === 'Lineweight') return;
    const th = document.createElement('th'); th.textContent = h; header.appendChild(th);
  });
  ['Nos. of Flats','Req. Car Parking'].forEach(h => {
    const th = document.createElement('th'); th.textContent = h; header.appendChild(th);
  });
  const uniqueEntries = new Map();
  let totCovered = 0, totShare = 0, totTenement = 0, totFlats = 0;
  rows.slice(1, -1).forEach(row => {
    if (!row.trim()) return;
    const cells = row.split(',');
    const key   = `${cells[2]}-${cells[6]}-${cells[7]}`;
    if (uniqueEntries.has(key)) { uniqueEntries.get(key).flatNames.push(cells[1]); }
    else {
      uniqueEntries.set(key, {
        floor: cells[0], flatNames: [cells[1]], tenementType: cells[2],
        lineweight: cells[3], coveredArea: parseFloat(cells[4]),
        shareOfCommonArea: parseFloat(cells[5]), tenementArea: parseFloat(cells[6]),
        tenementRange: cells[7], reqCarParking: 0
      });
    }
  });
  uniqueEntries.forEach(e => {
    let flatsForRange = 0;
    if (['BELOW 50','50 - 75','75 - 100'].includes(e.tenementRange)) {
      flatsForRange = Array.from(uniqueEntries.values())
        .filter(x => x.tenementRange === e.tenementRange)
        .reduce((s, x) => s + x.flatNames.length, 0);
    } else { flatsForRange = e.flatNames.length; }
    e.reqCarParking = _calcReqCarParking(e.tenementType, e.tenementArea, e.tenementRange, flatsForRange);
    totCovered  += e.coveredArea       * e.flatNames.length;
    totShare    += e.shareOfCommonArea * e.flatNames.length;
    totTenement += e.tenementArea      * e.flatNames.length;
    totFlats    += e.flatNames.length;
  });
  const sorted = Array.from(uniqueEntries.values()).sort((a, b) => b.tenementArea - a.tenementArea);
  let lastRange = null, rowspan = 0, firstRow = null;
  const rangeFlatNames = new Set();
  let totalReqCarParking = 0;
  sorted.forEach((e, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e.flatNames.join(', ')}</td><td>${e.tenementType}</td>
      <td>${e.coveredArea.toFixed(3)}</td><td>${e.shareOfCommonArea.toFixed(3)}</td>
      <td>${e.tenementArea.toFixed(3)}</td><td>${e.tenementRange}</td>
      <td>${e.flatNames.length}</td><td>${e.reqCarParking}</td>`;
    tbody.appendChild(tr);
    if (['BELOW 50','50 - 75','75 - 100'].includes(e.tenementRange)) {
      if (e.tenementRange !== lastRange && lastRange !== null) {
        if (rowspan > 0 && firstRow) _mergeCells(firstRow, rowspan + 1, rangeFlatNames.size);
        rowspan = 0; rangeFlatNames.clear();
      }
      e.flatNames.forEach(f => rangeFlatNames.add(f));
      if (e.tenementRange === lastRange) {
        rowspan++;
        tr.children[5].style.display = 'none';
        tr.children[6].style.display = 'none';
        tr.children[7].style.display = 'none';
      } else { lastRange = e.tenementRange; firstRow = tr; }
    } else { totalReqCarParking += e.reqCarParking; }
    if (index === sorted.length - 1 && rowspan > 0 && firstRow)
      _mergeCells(firstRow, rowspan + 1, rangeFlatNames.size);
  });
  sorted.forEach((e, index) => {
    const isLast = index === sorted.length - 1 || sorted[index + 1].tenementRange !== e.tenementRange;
    if (isLast && ['BELOW 50','50 - 75','75 - 100'].includes(e.tenementRange))
      totalReqCarParking += e.reqCarParking;
  });
  if (totalReqCarParking > 0) localStorage.setItem('totalReqCarParking', totalReqCarParking);
  console.log('[kmc_parking] Tenement parking required:', totalReqCarParking);
  const totRow = document.createElement('tr');
  totRow.className = 'total-row';
  ['Total','', totCovered.toFixed(3), totShare.toFixed(3), totTenement.toFixed(3), '', totFlats, totalReqCarParking]
    .forEach(v => { const td = document.createElement('td'); td.textContent = v; totRow.appendChild(td); });
  tfoot.appendChild(totRow);
}

function _mergeCells(row, rowSpan, totalFlats) {
  row.children[5].rowSpan = rowSpan;
  row.children[6].rowSpan = rowSpan;
  row.children[7].rowSpan = rowSpan;
  row.children[6].textContent = totalFlats;
}

function _calcReqCarParking(tenementType, tenementArea, tenementRange, totalNosOfFlats) {
  if (['Tenement','Tenement_Ext_1'].includes(tenementType)) {
    switch (tenementRange) {
      case 'BELOW 50':  return Math.floor(totalNosOfFlats / 6);
      case '50 - 75':   return Math.floor(totalNosOfFlats / 4);
      case '75 - 100':  return Math.floor(totalNosOfFlats / 2);
      case 'ABOVE 100': return Math.floor(tenementArea / 100) * totalNosOfFlats;
      default: return 0;
    }
  }
  if (['Tenement_Single','Tenement_Single_Ext_1'].includes(tenementType)) {
    switch (tenementRange) {
      case 'BELOW 100': return 0;
      case 'ABOVE 100': return Math.floor(totalNosOfFlats / 1);
      case 'ABOVE 200': return Math.floor(tenementArea / 200) * totalNosOfFlats;
      default: return 0;
    }
  }
  return 0;
}

/* ══════════════════════════════════════════
   SECTION 2 — OTHER USE-GROUPS PARKING
══════════════════════════════════════════ */
function _buildOtherLayersParking(csv) {
  const nonAssemblyLayers = [
    'Mercantile_wholesale','Mercantile_retail','Business',
    'Institutional','Storage','Hazardous','Industrial','Educational'
  ];
  const rows       = csv.split('\n');
  const parsedData = _parseCSV(csv);
  const container  = document.getElementById('p-other-layers-container');
  let totalParkingRequired = 0;

  // Non-assembly layers — single table each
  nonAssemblyLayers.forEach(layer => {
    const layerData = _getLayerData(layer, rows, parsedData);
    if (layerData.length === 0) return;
    totalParkingRequired += _createLayerTable(layer, layerData, container);
  });

  // Assembly — 3 separate sub-tables + combined total row
  const assemblyTotal = _buildAssemblyTables(rows, parsedData, container);
  totalParkingRequired += assemblyTotal;

  _addTotalParkingRow(totalParkingRequired, container);
  localStorage.setItem('totalParkingRequired', totalParkingRequired);
  console.log('[kmc_parking] Other use-groups total parking:', totalParkingRequired);
}

/* ══════════════════════════════════════════
   ASSEMBLY — 3 SEPARATE SUB-TABLES
   KMC Rule 78 Cl.IV

   Table 1: General + Boarding & Guest House
            Linetype = ByLayer, LW = ByLayer
            Rule: 1 per 65 sqm, min 1

   Table 2: Star Hotel
            Linetype = PHANTOM, LW = ByLayer
            Rule: 1 per 120 sqm, min 2

   Table 3: Hotel with Banquet Hall
            Linetype = PHANTOM2, LW = ByLayer
            Rule: 1 per 60 sqm (full net area)

   Combined total row shown after all 3 tables.
══════════════════════════════════════════ */
function _buildAssemblyTables(rows, parsedData, container) {

  // Collect all Assembly rows grouped by linetype
  const subGroups = {
    general:  [],   // ByLayer
    hotel:    [],   // PHANTOM
    banquet:  [],   // PHANTOM2
  };

  const seen = { general: new Set(), hotel: new Set(), banquet: new Set() };

  rows.forEach((row, index) => {
    if (index === 0 || !row.trim()) return;
    const cells = row.split(',');
    if (cells[3] !== 'Assembly') return;

    const floor    = cells[2];
    const linetype = (cells[5] || '').trim().toUpperCase();

    let group, key;
    if (linetype === 'PHANTOM2') {
      group = 'banquet'; key = floor + '-PHANTOM2';
    } else if (linetype === 'PHANTOM') {
      group = 'hotel';   key = floor + '-PHANTOM';
    } else {
      group = 'general'; key = floor + '-ByLayer';
    }

    if (seen[group].has(key)) return;
    seen[group].add(key);

    const tfa = _pkgCalcTotalFloorAreaByLinetype(floor, 'Assembly', linetype, parsedData);
    const da  = _pkgCalcDeductedAreaByLinetype(floor, 'Assembly', linetype, parsedData);
    const net = (parseFloat(tfa) - parseFloat(da));

    subGroups[group].push({
      floor,
      layer:    'Assembly',
      linetype: cells[5] || 'ByLayer',
      totalFloorArea: _pkgFmt(tfa),
      deductedArea:   _pkgFmt(da),
      netArea:        _pkgFmt(net),
      carpetArea:     _pkgFmt(_pkgCalcCarpetAreaByLinetype(floor, 'Assembly', linetype, parsedData)),
    });
  });

  let grandTotal = 0;

  // ── Table 1: General + Boarding & Guest House ──
  if (subGroups.general.length > 0) {
    const totalNet = subGroups.general.reduce((s, d) => s + parseFloat(d.netArea), 0);
    const parking  = totalNet > 0 ? (totalNet >= 65 ? Math.floor(totalNet / 65) : 1) : 0;
    _createAssemblySubTable(
      'Assembly — General / Boarding & Guest House',
      'KMC Rule 78 Cl.IV(a)(c) — 1 per 65 Sq.M, min 1',
      subGroups.general, parking, container
    );
    grandTotal += parking;
  }

  // ── Table 2: Star Hotel ──
  if (subGroups.hotel.length > 0) {
    const totalNet = subGroups.hotel.reduce((s, d) => s + parseFloat(d.netArea), 0);
    const parking  = totalNet > 0 ? Math.max(Math.floor(totalNet / 120), 2) : 0;
    _createAssemblySubTable(
      'Assembly — Star Hotel',
      'KMC Rule 78 Cl.IV(b)(i) — 1 per 120 Sq.M, min 2',
      subGroups.hotel, parking, container
    );
    grandTotal += parking;
  }

  // ── Table 3: Hotel with Banquet Hall ──
  if (subGroups.banquet.length > 0) {
    const totalNet = subGroups.banquet.reduce((s, d) => s + parseFloat(d.netArea), 0);
    const parking  = totalNet > 0 ? Math.floor(totalNet / 60) : 0;
    _createAssemblySubTable(
      'Assembly — Hotel with Banquet Hall',
      'KMC Rule 78 Cl.IV(b)(ii) — 1 per 60 Sq.M of Banquet Hall area',
      subGroups.banquet, parking, container
    );
    grandTotal += parking;
  }

  // ── Combined Assembly Total row ──
  if (subGroups.general.length + subGroups.hotel.length + subGroups.banquet.length > 0) {
    _addAssemblyCombinedRow(grandTotal, container);
  }

  return grandTotal;
}

/* Build one Assembly sub-table */
function _createAssemblySubTable(title, ruleNote, data, parkingRequired, container) {
  const section = document.createElement('div');
  section.className = 'filtered-block';

  const heading = document.createElement('h2');
  heading.className = 'filtered-table-title';
  heading.textContent = title;
  section.appendChild(heading);

  const ruleEl = document.createElement('p');
  ruleEl.className = 'rule-note';
  ruleEl.textContent = ruleNote;
  ruleEl.style.cssText = 'font-size:0.8em;color:var(--muted,#888);margin:2px 0 6px 0;';
  section.appendChild(ruleEl);

  const wrap  = document.createElement('div');
  wrap.className = 'table-wrap';

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  const hRow = document.createElement('tr');
  ['Floor','Net Area','Carpet Area'].forEach(h => {
    const th = document.createElement('th'); th.textContent = h; hRow.appendChild(th);
  });
  thead.appendChild(hRow);
  table.appendChild(thead);

  let totalNet = 0, totalCarpet = 0;
  data.forEach(d => {
    const tr = tbody.insertRow();
    [d.floor, d.netArea, d.carpetArea].forEach(v => { tr.insertCell().textContent = v; });
    totalNet    += parseFloat(d.netArea);
    totalCarpet += parseFloat(d.carpetArea);
  });

  // Total row
  const totRow = tbody.insertRow();
  totRow.className = 'total-row';
  ['Total', _pkgFmt(totalNet), _pkgFmt(totalCarpet)].forEach(v => {
    totRow.insertCell().textContent = v;
  });

  // Parking required footer row
  const footRow = tbody.insertRow();
  footRow.className = 'footer-row';
  const c1 = footRow.insertCell();
  c1.textContent = 'Nos. of Car Parking Required:';
  c1.style.cssText = 'color:var(--green);font-weight:700;text-align:left;';
  const c2 = footRow.insertCell();
  c2.textContent = parkingRequired;
  c2.colSpan = 2;
  c2.style.cssText = 'color:var(--green);font-weight:700;';

  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);
  container.appendChild(section);
}

/* Combined Assembly total row after all 3 sub-tables */
function _addAssemblyCombinedRow(total, container) {
  const section = document.createElement('div');
  section.className = 'filtered-block';

  const wrap  = document.createElement('div');
  wrap.className = 'table-wrap';

  const table = document.createElement('table');
  const tbody = document.createElement('tbody');

  const tr = document.createElement('tr');
  tr.className = 'total-row';
  const c1 = document.createElement('td');
  c1.textContent = 'Total Nos. of Car Parking Required For Assembly (All Sub-Types):';
  c1.style.cssText = 'width:57.4%;text-align:left;font-weight:700;';
  const c2 = document.createElement('td');
  c2.colSpan = 2;
  c2.textContent = total;
  c2.style.fontWeight = '700';
  tr.appendChild(c1); tr.appendChild(c2);
  tbody.appendChild(tr);

  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);
  container.appendChild(section);
}

/* ── Assembly linetype-aware area helpers ──────────────────────────────────
   Net Area    : Lineweight = ByLayer,  Linetype ≠ DASHED, matching group
   Deducted    : Lineweight = ByLayer,  Linetype = DASHED,  matching group
   Carpet Area : Lineweight = 0.15 mm,                      matching group
   "General" group excludes rows whose Linetype is PHANTOM or PHANTOM2.
──────────────────────────────────────────────────────────────────────────*/

// Total floor area for one Assembly sub-type (LW=ByLayer, non-DASHED rows)
function _pkgCalcTotalFloorAreaByLinetype(floor, layer, linetype, parsedData) {
  let sum = 0;
  const lt = linetype.toUpperCase();
  parsedData.forEach(d => {
    if (d.column3 !== floor || d.column4 !== layer) return;
    if (d.column7 !== 'ByLayer') return;           // Net Area → LW must be ByLayer
    if (d.column6 === 'DASHED')  return;           // exclude deduct rows
    const dlt = (d.column6 || '').trim().toUpperCase();
    if (lt === 'BYLAYER' || lt === '') {
      if (dlt === 'PHANTOM' || dlt === 'PHANTOM2') return; // General excludes hotel rows
    } else {
      if (dlt !== lt) return;
    }
    sum += d.column8;
  });
  return sum.toFixed(3);
}

// Deducted area for one Assembly sub-type (LW=ByLayer, Linetype=DASHED)
function _pkgCalcDeductedAreaByLinetype(floor, layer, linetype, parsedData) {
  let sum = 0;
  parsedData.forEach(d => {
    if (d.column3 !== floor || d.column4 !== layer) return;
    if (d.column6 !== 'DASHED')  return;           // only DASHED rows
    if (d.column7 !== 'ByLayer') return;           // Lineweight must be ByLayer
    sum += d.column8;
    // Note: DASHED rows don't carry a sub-type linetype in CAD,
    // so all DASHED ByLayer rows on this floor+layer are shared deductions.
  });
  return sum.toFixed(3);
}

// Carpet area for one Assembly sub-type (LW=0.15 mm)
function _pkgCalcCarpetAreaByLinetype(floor, layer, linetype, parsedData) {
  let sum = 0;
  const lt = linetype.toUpperCase();
  parsedData.forEach(d => {
    if (d.column3 !== floor || d.column4 !== layer) return;
    if (d.column7 !== '0.15 mm') return;           // Carpet Area → LW must be 0.15 mm
    const dlt = (d.column6 || '').trim().toUpperCase();
    if (lt === 'BYLAYER' || lt === '') {
      if (dlt === 'PHANTOM' || dlt === 'PHANTOM2') return;
    } else {
      if (dlt !== lt) return;
    }
    sum += d.column8;
  });
  return sum.toFixed(3);
}

/* ══════════════════════════════════════════
   NON-ASSEMBLY LAYER TABLE
══════════════════════════════════════════ */
function _getLayerData(layer, rows, parsedData) {
  const layerData = [];
  const seen      = new Set();
  rows.forEach((row, index) => {
    if (index === 0 || !row.trim()) return;
    const cells    = row.split(',');
    const rowLayer = cells[3];
    const key      = cells[2] + ',' + cells[3];
    if (rowLayer !== layer || seen.has(key)) return;
    seen.add(key);
    const tfa = _pkgCalcTotalFloorArea(cells, parsedData);
    const da  = _pkgCalcDeductedArea(cells, parsedData);
    layerData.push({
      floor:          cells[2],
      layer:          cells[3],
      totalFloorArea: _pkgFmt(tfa),
      deductedArea:   _pkgFmt(da),
      netArea:        _pkgFmt(_pkgCalcNetArea(tfa, da)),
      carpetArea:     _pkgFmt(_pkgCalcCarpetArea(cells, parsedData)),
    });
  });
  return layerData;
}

function _createLayerTable(layer, layerData, container) {
  const section = document.createElement('div');
  section.className = 'filtered-block';

  const heading = document.createElement('h2');
  heading.className = 'filtered-table-title';
  heading.textContent = layer;
  section.appendChild(heading);

  const wrap  = document.createElement('div');
  wrap.className = 'table-wrap';

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  const hRow = document.createElement('tr');
  ['Floor','Net Area','Carpet Area'].forEach(h => {
    const th = document.createElement('th'); th.textContent = h; hRow.appendChild(th);
  });
  thead.appendChild(hRow);
  table.appendChild(thead);

  let totalNetArea = 0, totalCarpetArea = 0;
  layerData.forEach(d => {
    const tr = tbody.insertRow();
    [d.floor, d.netArea, d.carpetArea].forEach(v => { tr.insertCell().textContent = v; });
    totalNetArea    += parseFloat(d.netArea);
    totalCarpetArea += parseFloat(d.carpetArea);
  });

  const totRow = tbody.insertRow();
  totRow.className = 'total-row';
  ['Total', _pkgFmt(totalNetArea), _pkgFmt(totalCarpetArea)].forEach(v => {
    totRow.insertCell().textContent = v;
  });

  const parkingRequired = _calcCarParkingRequired(layerData);
  const footRow = tbody.insertRow();
  footRow.className = 'footer-row';
  const c1 = footRow.insertCell();
  c1.textContent = 'Nos. of Car Parking Required:';
  c1.style.cssText = 'color:var(--green);font-weight:700;text-align:left;';
  const c2 = footRow.insertCell();
  c2.textContent = parkingRequired;
  c2.colSpan = 2;
  c2.style.cssText = 'color:var(--green);font-weight:700;';

  // Educational — extra Bus Parking row (KMC Rule 78 Cl.II)
  if (layer === 'Educational') {
    const busParking = totalNetArea > 0 ? Math.floor(totalNetArea / 1000) : 0;
    const busRow = tbody.insertRow();
    busRow.className = 'footer-row';
    const b1 = busRow.insertCell();
    b1.textContent = 'Nos. of Bus Parking Required:';
    b1.style.cssText = 'color:var(--green);font-weight:700;text-align:left;';
    const b2 = busRow.insertCell();
    b2.textContent = busParking;
    b2.colSpan = 2;
    b2.style.cssText = 'color:var(--green);font-weight:700;';
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);
  container.appendChild(section);

  return parseFloat(parkingRequired) || 0;
}

function _calcCarParkingRequired(layerData) {
  if (!layerData.length) return 'N/A';
  const layer        = layerData[0].layer;
  const totalNetArea = layerData.reduce((s, d) => s + parseFloat(d.netArea), 0);

  //-------BUSINESS KMC Rule 78 Cl.V-------//
  if (layer === 'Business') {
    if (totalNetArea <= 50) return 0;
    if (totalNetArea <= 70) return 1;
    return Math.floor(totalNetArea / 70);
  }

  //-------MERCANTILE RETAIL KMC Rule 78 Cl.VI-------//
  if (layer === 'Mercantile_retail') {
    if (totalNetArea <= 5000) return Math.floor(totalNetArea / 50);
    return Math.floor(5000 / 50 + (totalNetArea - 5000) / 75);
  }

  //-------INSTITUTIONAL KMC Rule 78 Cl.III-------//
  if (layer === 'Institutional') {
    return totalNetArea > 75 ? Math.floor(totalNetArea / 90) : 0;
  }

  //-------EDUCATIONAL KMC Rule 78 Cl.II-------//
  // Bus parking handled separately in _createLayerTable — not in grand total
  if (layer === 'Educational') {
    if (totalNetArea <= 100) return 0;
    return Math.max(1, Math.floor(totalNetArea / 400));
  }

  //-------INDUSTRIAL / STORAGE / HAZARDOUS / MERCANTILE WHOLESALE KMC Rule 78 Cl.VII-------//
  if (['Industrial','Storage','Hazardous','Mercantile_wholesale'].includes(layer)) {
    if (totalNetArea <= 200) return 0;
    return Math.floor(totalNetArea / 200);
  }

  return 'N/A';
}

function _addTotalParkingRow(total, container) {
  const section = document.createElement('div');
  section.className = 'filtered-block';
  const wrap  = document.createElement('div');
  wrap.className = 'table-wrap';
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  const tr = document.createElement('tr');
  tr.className = 'total-row';
  const c1 = document.createElement('td');
  c1.textContent = 'Total Nos. of Car Parking Required For Other Use-Groups:';
  c1.style.cssText = 'width:57.4%;text-align:left;font-weight:700;';
  const c2 = document.createElement('td');
  c2.colSpan = 2; c2.textContent = total; c2.style.fontWeight = '700';
  tr.appendChild(c1); tr.appendChild(c2);
  tbody.appendChild(tr);
  table.appendChild(tbody); wrap.appendChild(table);
  section.appendChild(wrap); container.appendChild(section);
}

/* ── Standard area helpers (non-Assembly) ── */
/* ── Net Area = rows where Lineweight = ByLayer (total) minus DASHED (deduct) ──
   ── Carpet Area = rows where Lineweight = 0.15 mm                           ── */

// Total floor area: Linetype=ByLayer AND Lineweight=ByLayer
function _pkgCalcTotalFloorArea(filteredRow, parsedData) {
  const col3 = filteredRow[2], col4 = filteredRow[3];
  let sum = 0;
  parsedData.forEach(d => {
    if (d.column3 === col3 && d.column4 === col4
        && d.column7 === 'ByLayer'   // Lineweight = ByLayer  ← Net Area condition
        && d.column6 !== 'DASHED')   // exclude deduct rows
      sum += d.column8;
  });
  return sum.toFixed(3);
}

// Deducted area: Linetype=DASHED AND Lineweight=ByLayer
function _pkgCalcDeductedArea(filteredRow, parsedData) {
  const col3 = filteredRow[2], col4 = filteredRow[3];
  let sum = 0;
  parsedData.forEach(d => {
    if (d.column3 === col3 && d.column4 === col4
        && d.column6 === 'DASHED'    // Linetype = DASHED
        && d.column7 === 'ByLayer')  // Lineweight = ByLayer
      sum += d.column8;
  });
  return sum.toFixed(3);
}

// Net area = Total − Deducted
function _pkgCalcNetArea(total, deducted) {
  return (parseFloat(total) - parseFloat(deducted)).toFixed(3);
}

// Carpet area: Lineweight = 0.15 mm (any linetype)
function _pkgCalcCarpetArea(filteredRow, parsedData) {
  const col3 = filteredRow[2], col4 = filteredRow[3];
  let sum = 0;
  parsedData.forEach(d => {
    if (d.column3 === col3 && d.column4 === col4
        && d.column7 === '0.15 mm')  // Lineweight = 0.15 mm  ← Carpet Area condition
      sum += d.column8;
  });
  return sum.toFixed(3);
}

function _pkgFmt(value) {
  const n = parseFloat(value);
  return isNaN(n) ? '0.000' : n.toFixed(3);
}

/* ══════════════════════════════════════════
   SECTION 3 — PROVIDED PARKING
   Car: Color 20-60
   Bus: Color 10  (50 sqm/slot)
   Truck: Color 15 (50 sqm/slot)
   Bus & Truck → separate table
══════════════════════════════════════════ */
const _COLOR_DISPLAY = {
  '20':'Single','30':'Two Layer','40':'Three Layer','50':'Four Layer','60':'Five Layer'
};
const _LW_DISPLAY = {
  '0.20 mm':'Cover at Ground','0.25 mm':'Open at Ground','0.30 mm':'Other than Ground'
};
const _BT_COLOR_DISPLAY = { '10':'Bus', '15':'Truck' };

function _calcParkingNos(color, count) {
  const map = { '20':1,'30':2,'40':3,'50':4,'60':5 };
  return (map[color] || 0) * count;
}

function _calcParkingArea(color, lineweight, count) {
  if (['20','30','40','50','60'].includes(color) && lineweight === '0.20 mm') return 25 * count;
  if (['20','30','40','50','60'].includes(color) && lineweight === '0.25 mm') return 0  * count;
  return 40 * count;
}

function _buildProvidedParking(csv) {
  const rows   = csv.split('\n');
  const header = document.getElementById('p-parking-provided-header');
  const table  = document.getElementById('p-parking-provided-table');
  if (!table || !header) return;
  const tbody  = table.querySelector('tbody');
  const footer = document.getElementById('p-parking-provided-footer');
  header.innerHTML = ''; tbody.innerHTML = ''; footer.innerHTML = '';

  let colIdx = {};
  const carMap = {}, btMap = {};
  let totalNos = 0, totalArea = 0;

  rows.forEach((row, index) => {
    const cells = row.split(',');
    if (index === 0) {
      cells.forEach((c, ci) => {
        const t = c.trim();
        if (t === 'Count')      colIdx.count      = ci;
        if (t === 'Color')      colIdx.color      = ci;
        if (t === 'Lineweight') colIdx.lineweight = ci;
        if (t === 'Layer')      colIdx.layer      = ci;
      });
      ['Count','Type','Level','Nos. of Parking','Parking Area'].forEach(h => {
        const th = document.createElement('th'); th.textContent = h; header.appendChild(th);
      });
      return;
    }
    if (!row.trim()) return;
    if ((cells[colIdx.layer] || '').trim() !== 'Parking') return;

    const count = parseInt(cells[colIdx.count], 10) || 0;
    const color = (cells[colIdx.color] || '').trim();
    const lw    = (cells[colIdx.lineweight] || '').trim();
    const key   = `${color}-${lw}`;

    if (color === '10' || color === '15') {
      if (btMap[key]) btMap[key].count += count;
      else btMap[key] = { count, color, lw };
    } else {
      if (carMap[key]) carMap[key].count += count;
      else carMap[key] = { count, color, lw };
    }
  });

  // Car parking rows
  Object.values(carMap).forEach(({ count, color, lw }) => {
    const nos  = _calcParkingNos(color, count);
    const area = _calcParkingArea(color, lw, count);
    const tr = tbody.insertRow();
    tr.insertCell().textContent = count;
    tr.insertCell().textContent = _COLOR_DISPLAY[color] || color;
    tr.insertCell().textContent = _LW_DISPLAY[lw]       || lw;
    tr.insertCell().textContent = nos;
    tr.insertCell().textContent = area;
    totalNos  += nos;
    totalArea += area;
  });

  // Car footer
  const tdL = document.createElement('td'); tdL.colSpan = 3; tdL.textContent = 'Total:'; footer.appendChild(tdL);
  const tdN = document.createElement('td'); tdN.textContent = totalNos;  footer.appendChild(tdN);
  const tdA = document.createElement('td'); tdA.textContent = totalArea; footer.appendChild(tdA);

  // reqParkingArea
  let maxNosRow = null, maxNos = 0;
  Object.values(carMap).forEach(({ count, color, lw }) => {
    const nos = _calcParkingNos(color, count);
    if (nos > maxNos) { maxNos = nos; maxNosRow = { color, lw }; }
  });
  const areaPerSlot  = maxNosRow ? _calcParkingArea(maxNosRow.color, maxNosRow.lw, 1) : 25;
  const totalRequired = (parseInt(localStorage.getItem('totalReqCarParking'))  || 0)
                      + (parseInt(localStorage.getItem('totalParkingRequired')) || 0);
  const reqParkArea = totalNos > totalRequired ? totalRequired * areaPerSlot : totalArea;

  localStorage.setItem('totalParkingNos',  totalNos);
  localStorage.setItem('totalParkingArea', totalArea);
  localStorage.setItem('reqParkingArea',   reqParkArea);
  console.log('[kmc_parking] Provided Car: Nos =', totalNos, '| Area =', totalArea);

  // Bus & Truck separate table
  if (Object.keys(btMap).length > 0) _buildBusTruckTable(btMap);
}

function _buildBusTruckTable(btMap) {
  const container = document.getElementById('p-other-layers-container');
  if (!container) return;

  const section = document.createElement('div');
  section.className = 'filtered-block';
  const heading = document.createElement('h2');
  heading.className = 'filtered-table-title';
  heading.textContent = 'Bus & Truck Parking (Provided)';
  section.appendChild(heading);

  const wrap  = document.createElement('div'); wrap.className = 'table-wrap';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  const tfoot = document.createElement('tfoot');

  const hRow = document.createElement('tr');
  ['Count','Type','Level','Nos. of Parking','Parking Area'].forEach(h => {
    const th = document.createElement('th'); th.textContent = h; hRow.appendChild(th);
  });
  thead.appendChild(hRow);

  let totalBTNos = 0, totalBTArea = 0;
  Object.values(btMap).forEach(({ count, color, lw }) => {
    const nos  = count;
    const area = 50 * count;
    const tr = tbody.insertRow();
    tr.insertCell().textContent = count;
    tr.insertCell().textContent = _BT_COLOR_DISPLAY[color] || color;
    tr.insertCell().textContent = _LW_DISPLAY[lw]          || lw;
    tr.insertCell().textContent = nos;
    tr.insertCell().textContent = area;
    totalBTNos  += nos;
    totalBTArea += area;
  });

  const fRow = document.createElement('tr'); fRow.className = 'total-row';
  const fL = document.createElement('td'); fL.colSpan = 3; fL.textContent = 'Total:'; fRow.appendChild(fL);
  const fN = document.createElement('td'); fN.textContent = totalBTNos;  fRow.appendChild(fN);
  const fA = document.createElement('td'); fA.textContent = totalBTArea; fRow.appendChild(fA);
  tfoot.appendChild(fRow);

  localStorage.setItem('totalBusTruckNos',  totalBTNos);
  localStorage.setItem('totalBusTruckArea', totalBTArea);

  table.appendChild(thead); table.appendChild(tbody); table.appendChild(tfoot);
  wrap.appendChild(table); section.appendChild(wrap); container.appendChild(section);
  console.log('[kmc_parking] Provided Bus/Truck: Nos =', totalBTNos, '| Area =', totalBTArea);
}

/* ══════════════════════════════════════════
   SHARED CSV PARSER
══════════════════════════════════════════ */
function _parseCSV(csv) {
  return csv.split('\n')
    .filter((row, i) => i !== 0 && row.trim())
    .map(row => {
      const c = row.split(',');
      return {
        column1: c[0], column2: c[1], column3: c[2],
        column4: c[3], column5: c[4], column6: c[5],
        column7: c[6], column8: parseFloat(c[7]) || 0,
        column9: (c[8] || '').trim(),
      };
    });
}
