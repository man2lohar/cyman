/* ══════════════════════════════════════════
   kmc_parking.js  —  Parking Calculation tab
   Lazy-loaded on first click of Parking tab.
   Ported from: tenement.js + parking.js + parking-provided.js
   Exposes: window.initParkingTables()
            window.generateParkingTables()  (called by Refresh button)
══════════════════════════════════════════ */

window.initParkingTables = function () {
  generateParkingTables();
};

function generateParkingTables() {
  const csv = localStorage.getItem('csvData');
  if (!csv) return;

  _resetParkingSection();
  _buildTenementTable(csv);
  _buildOtherLayersParking(csv);
  _buildProvidedParking(csv);
}

/* ──────────────────────────────────────────
   RESET — clear all three sub-sections
──────────────────────────────────────────*/
function _resetParkingSection() {
  // Tenement table
  ['p-tenement-header', 'p-common-area-header'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  ['p-tenement-table', 'p-common-area-table'].forEach(id => {
    const tbl = document.getElementById(id);
    if (!tbl) return;
    const tb = tbl.querySelector('tbody');
    const tf = tbl.querySelector('tfoot');
    if (tb) tb.innerHTML = '';
    if (tf) tf.innerHTML = '';
  });

  // Other layers container
  const otherContainer = document.getElementById('p-other-layers-container');
  if (otherContainer) otherContainer.innerHTML = '';

  // Provided parking table
  const ppHeader  = document.getElementById('p-parking-provided-header');
  const ppFooter  = document.getElementById('p-parking-provided-footer');
  const ppTable   = document.getElementById('p-parking-provided-table');
  if (ppHeader) ppHeader.innerHTML = '';
  if (ppFooter) ppFooter.innerHTML = '';
  if (ppTable) {
    const tb = ppTable.querySelector('tbody');
    if (tb) tb.innerHTML = '';
  }
}

/* ══════════════════════════════════════════
   SECTION 1: TENEMENT PARKING
   (ported from tenement.js)
══════════════════════════════════════════ */
function _buildTenementTable(csv) {
  const commonAreaData = _filterCommonAreaData(csv);
  const tenementData   = _filterTenementData(csv, commonAreaData);

  _displayTenementTable(tenementData, 'p-tenement-table', 'p-tenement-header');
  // Common area table hidden (same behaviour as original)
  _displayCommonAreaTable(commonAreaData, 'p-common-area-table', 'p-common-area-header');
}

function _filterCommonAreaData(csv) {
  const rows    = csv.split('\n');
  const headers = rows[0].split(',');

  const floorIndex    = headers.indexOf('Color');
  const linetypeIndex = headers.indexOf('Linetype');
  const areaIndex     = headers.indexOf('Area');
  const layerIndex    = headers.indexOf('Layer');

  const entries = new Map();

  rows.slice(1).forEach(row => {
    if (!row.trim()) return;
    const cells   = row.split(',');
    const layer   = cells[layerIndex];
    const linetype = cells[linetypeIndex];
    const area    = parseFloat(cells[areaIndex]) || 0;

    if (layer !== 'Common Area') return;
    const key = cells[floorIndex];
    if (!entries.has(key)) entries.set(key, { floor: cells[floorIndex], totalArea: 0, deductArea: 0 });
    const e = entries.get(key);
    if (linetype === 'DASHED') e.deductArea += area;
    else                       e.totalArea  += area;
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

  const floorIndex         = headers.indexOf('Color');
  const tenementTypeIndex  = headers.indexOf('Layer');
  const lineweightIndex    = headers.indexOf('Lineweight');
  const linetypeIndex      = headers.indexOf('Linetype');
  const areaIndex          = headers.indexOf('Area');

  // Build common area map
  const commonAreaRows = commonAreaData.split('\n').slice(1, -1);
  const commonAreaMap  = new Map();
  commonAreaRows.forEach(row => {
    const [floor, total] = row.split(',');
    commonAreaMap.set(floor, parseFloat(total));
  });

  const uniqueEntries = new Map();

  rows.slice(1).forEach(row => {
    if (!row.trim()) return;
    const cells        = row.split(',');
    const tenementType = cells[tenementTypeIndex];
    const linetype     = cells[linetypeIndex];
    const area         = parseFloat(cells[areaIndex]) || 0;

    if (['Tenement', 'Tenement_Ext_1'].includes(tenementType)) {
      const key = `${cells[floorIndex]},${cells[lineweightIndex]}`;
      if (!uniqueEntries.has(key)) {
        uniqueEntries.set(key, {
          floor: cells[floorIndex], tenementType, lineweight: cells[lineweightIndex],
          coveredArea: linetype === 'ByLayer' ? area : 0,
          deductArea:  linetype === 'DASHED'  ? area : 0,
          shareOfCommonArea: 0, tenementArea: 0, tenementRange: ''
        });
      } else {
        const e = uniqueEntries.get(key);
        if (linetype === 'ByLayer') e.coveredArea += area;
        else if (linetype === 'DASHED') e.deductArea += area;
      }
    } else if (['Tenement_Single', 'Tenement_Single_Ext_1'].includes(tenementType)) {
      const key = `${tenementType},${cells[lineweightIndex]}`;
      if (!uniqueEntries.has(key)) {
        uniqueEntries.set(key, {
          floor: cells[floorIndex], tenementType, lineweight: cells[lineweightIndex],
          coveredArea: linetype === 'ByLayer' ? area : 0,
          deductArea:  linetype === 'DASHED'  ? area : 0,
          shareOfCommonArea: 0, tenementArea: 0, tenementRange: ''
        });
      } else {
        const e = uniqueEntries.get(key);
        if (cells[floorIndex] < e.floor) e.floor = cells[floorIndex];
        if (linetype === 'ByLayer') e.coveredArea += area;
        else if (linetype === 'DASHED') e.deductArea += area;
      }
    }
  });

  // Covered area = covered - deduct; compute totals
  let totalCoveredArea = 0;
  uniqueEntries.forEach(e => {
    e.coveredArea -= e.deductArea;
    totalCoveredArea += e.coveredArea;
  });

  const commonAreaTotal = Array.from(commonAreaMap.values()).reduce((s, a) => s + a, 0);

  uniqueEntries.forEach(e => {
    e.shareOfCommonArea = totalCoveredArea > 0 ? (commonAreaTotal / totalCoveredArea) * e.coveredArea : 0;
    e.tenementArea = e.coveredArea + e.shareOfCommonArea;

    if (['Tenement', 'Tenement_Ext_1'].includes(e.tenementType)) {
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

  // Build CSV-style output (same format as original)
  const newHeaders = ['Floor','Flat Name','Tenement Type','Lineweight','Covered Area','Share of Common Area','Tenement Area','Tenement Range'];
  const out = [newHeaders.join(',')];
  let totalShareOfCommonArea = 0;
  let totalTenementArea      = 0;
  let totalCoveredAreaOut    = 0;

  const floorGroup = new Map();
  uniqueEntries.forEach(e => {
    if (!floorGroup.has(e.floor)) floorGroup.set(e.floor, []);
    floorGroup.get(e.floor).push(e);
  });

  floorGroup.forEach((entries, floor) => {
    entries.sort((a, b) => a.lineweight - b.lineweight);
    entries.forEach((e, i) => {
      const flatName = String.fromCharCode(65 + i) + floor.slice(-2);
      out.push([
        e.floor, flatName, e.tenementType, e.lineweight,
        e.coveredArea.toFixed(3), e.shareOfCommonArea.toFixed(3),
        e.tenementArea.toFixed(3), e.tenementRange
      ].join(','));
      totalShareOfCommonArea += e.shareOfCommonArea;
      totalTenementArea      += e.tenementArea;
      totalCoveredAreaOut    += e.coveredArea;
    });
  });

  out.push(['Total','','','', totalCoveredAreaOut.toFixed(3), totalShareOfCommonArea.toFixed(3), totalTenementArea.toFixed(3), ''].join(','));
  return out.join('\n');
}

function _displayCommonAreaTable(data, tableId, headerId) {
  const rows      = data.split('\n');
  const headers   = rows[0].split(',');
  const table     = document.getElementById(tableId);
  if (!table) return;
  const header    = document.getElementById(headerId);
  const tbody     = table.querySelector('tbody');
  const tfoot     = table.querySelector('tfoot');

  header.innerHTML = '';
  tbody.innerHTML  = '';
  tfoot.innerHTML  = '';

  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    header.appendChild(th);
  });

  rows.slice(1, -1).forEach(row => {
    if (!row.trim()) return;
    const cells = row.split(',');
    const tr = tbody.insertRow();
    cells.forEach(c => { tr.insertCell().textContent = c; });
  });

  // Total row (last line)
  const totalCells = rows[rows.length - 1].split(',');
  const totRow = document.createElement('tr');
  totalCells.forEach(c => { const td = document.createElement('td'); td.textContent = c; totRow.appendChild(td); });
  tfoot.appendChild(totRow);
}

function _displayTenementTable(data, tableId, headerId) {
  const rows    = data.split('\n');
  const headers = rows[0].split(',');

  const table  = document.getElementById(tableId);
  if (!table) return;
  const header = document.getElementById(headerId);
  const tbody  = table.querySelector('tbody');
  const tfoot  = table.querySelector('tfoot');

  header.innerHTML = '';
  tbody.innerHTML  = '';
  tfoot.innerHTML  = '';

  // Headers — exclude Floor and Lineweight (same as original)
  headers.forEach(h => {
    if (h === 'Floor' || h === 'Lineweight') return;
    const th = document.createElement('th');
    th.textContent = h;
    header.appendChild(th);
  });
  // Extra headers
  ['Nos. of Flats', 'Req. Car Parking'].forEach(h => {
    const th = document.createElement('th'); th.textContent = h; header.appendChild(th);
  });

  // Build unique entries map (mirrors displayTable in original)
  const uniqueEntries     = new Map();
  const tenementRangeTots = new Map();

  let totalCoveredArea       = 0;
  let totalShareOfCommonArea = 0;
  let totalTenementArea      = 0;
  let totalNosOfFlats        = 0;

  // Process all rows except header (row 0) and total (last row)
  rows.slice(1, -1).forEach(row => {
    if (!row.trim()) return;
    const cells          = row.split(',');
    const flatName       = cells[1];
    const tenementType   = cells[2];
    const coveredArea    = parseFloat(cells[4]);
    const shareOfCommon  = parseFloat(cells[5]);
    const tenementArea   = parseFloat(cells[6]);
    const tenementRange  = cells[7];
    const key = `${tenementType}-${tenementArea}-${tenementRange}`;

    // Track total flats per range
    tenementRangeTots.set(tenementRange, (tenementRangeTots.get(tenementRange) || 0) + 1);

    if (uniqueEntries.has(key)) {
      uniqueEntries.get(key).flatNames.push(flatName);
    } else {
      uniqueEntries.set(key, {
        floor: cells[0], flatNames: [flatName], tenementType,
        lineweight: cells[3], coveredArea, shareOfCommonArea: shareOfCommon,
        tenementArea, tenementRange, reqCarParking: 0
      });
    }
  });

  // Compute required parking
  uniqueEntries.forEach(e => {
    let totalFlatsForRange = 0;
    if (['BELOW 50','50 - 75','75 - 100'].includes(e.tenementRange)) {
      totalFlatsForRange = Array.from(uniqueEntries.values())
        .filter(x => x.tenementRange === e.tenementRange)
        .reduce((s, x) => s + x.flatNames.length, 0);
    } else {
      totalFlatsForRange = e.flatNames.length;
    }
    e.reqCarParking = _calcReqCarParking(e.tenementType, e.tenementArea, e.tenementRange, totalFlatsForRange);

    totalCoveredArea       += e.coveredArea       * e.flatNames.length;
    totalShareOfCommonArea += e.shareOfCommonArea * e.flatNames.length;
    totalTenementArea      += e.tenementArea      * e.flatNames.length;
    totalNosOfFlats        += e.flatNames.length;
  });

  // Sort by tenement area descending (same as original)
  const sortedEntries = Array.from(uniqueEntries.values()).sort((a, b) => b.tenementArea - a.tenementArea);

  let lastRange        = null;
  let rowspan          = 0;
  let firstRow         = null;
  const rangeFlatNames = new Set();
  let totalReqCarParking = 0;

  sortedEntries.forEach((e, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.flatNames.join(', ')}</td>
      <td>${e.tenementType}</td>
      <td>${e.coveredArea.toFixed(3)}</td>
      <td>${e.shareOfCommonArea.toFixed(3)}</td>
      <td>${e.tenementArea.toFixed(3)}</td>
      <td>${e.tenementRange}</td>
      <td>${e.flatNames.length}</td>
      <td>${e.reqCarParking}</td>
    `;
    tbody.appendChild(tr);

    if (['BELOW 50','50 - 75','75 - 100'].includes(e.tenementRange)) {
      if (e.tenementRange !== lastRange && lastRange !== null) {
        if (rowspan > 0 && firstRow) _mergeCells(firstRow, rowspan + 1, rangeFlatNames.size);
        rowspan = 0;
        rangeFlatNames.clear();
      }
      e.flatNames.forEach(f => rangeFlatNames.add(f));
      if (e.tenementRange === lastRange) {
        rowspan++;
        tr.children[5].style.display = 'none';
        tr.children[6].style.display = 'none';
        tr.children[7].style.display = 'none';
      } else {
        lastRange = e.tenementRange;
        firstRow  = tr;
      }
    } else {
      totalReqCarParking += e.reqCarParking;
    }

    if (index === sortedEntries.length - 1 && rowspan > 0 && firstRow) {
      _mergeCells(firstRow, rowspan + 1, rangeFlatNames.size);
    }
  });

  // Second pass — sum up range-based parking at last row of each range
  sortedEntries.forEach((e, index) => {
    const isLast = index === sortedEntries.length - 1 ||
                   sortedEntries[index + 1].tenementRange !== e.tenementRange;
    if (isLast && ['BELOW 50','50 - 75','75 - 100'].includes(e.tenementRange)) {
      totalReqCarParking += e.reqCarParking;
    }
  });

  if (totalReqCarParking > 0) {
    localStorage.setItem('totalReqCarParking', totalReqCarParking);
  }
  console.log('[kmc_parking] Tenement parking required:', totalReqCarParking);

  // Total footer row
  const totRow = document.createElement('tr');
  totRow.className = 'total-row';
  [
    { text: 'Total' }, { text: '' },
    { text: totalCoveredArea.toFixed(3) },
    { text: totalShareOfCommonArea.toFixed(3) },
    { text: totalTenementArea.toFixed(3) },
    { text: '' },
    { text: totalNosOfFlats },
    { text: totalReqCarParking },
  ].forEach(({ text }) => {
    const td = document.createElement('td'); td.textContent = text; totRow.appendChild(td);
  });
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
      case 'BELOW 50':   return Math.floor(totalNosOfFlats / 6);
      case '50 - 75':    return Math.floor(totalNosOfFlats / 4);
      case '75 - 100':   return Math.floor(totalNosOfFlats / 2);
      case 'ABOVE 100':  return Math.floor(tenementArea / 100) * totalNosOfFlats;
      default:           return 0;
    }
  }
  if (['Tenement_Single','Tenement_Single_Ext_1'].includes(tenementType)) {
    switch (tenementRange) {
      case 'BELOW 100':  return 0;
      case 'ABOVE 100':  return Math.floor(totalNosOfFlats / 1);
      case 'ABOVE 200':  return Math.floor(tenementArea / 200) * totalNosOfFlats;
      default:           return 0;
    }
  }
  return 0;
}

/* ══════════════════════════════════════════
   SECTION 2: OTHER USE-GROUPS PARKING
   (ported from parking.js)
══════════════════════════════════════════ */
function _buildOtherLayersParking(csv) {
  const layers = [
    'Mercantile_wholesale', 'Mercantile_retail', 'Business',
    'Institutional', 'Storage', 'Assembly', 'Hazardous', 'Industrial', 'Educational'
  ];

  const rows       = csv.split('\n');
  const parsedData = _parseCSV(csv);
  const container  = document.getElementById('p-other-layers-container');
  let totalParkingRequired = 0;

  layers.forEach(layer => {
    const layerData = _getLayerData(layer, rows, parsedData);
    if (layerData.length === 0) return;
    totalParkingRequired += _createLayerTable(layer, layerData, container);
  });

  _addTotalParkingRow(totalParkingRequired, container);
  localStorage.setItem('totalParkingRequired', totalParkingRequired);
  console.log('[kmc_parking] Other use-groups total parking:', totalParkingRequired);
}

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

  let totalNetArea    = 0;
  let totalCarpetArea = 0;

  layerData.forEach(d => {
    const tr = tbody.insertRow();
    [d.floor, d.netArea, d.carpetArea].forEach(v => { tr.insertCell().textContent = v; });
    totalNetArea    += parseFloat(d.netArea);
    totalCarpetArea += parseFloat(d.carpetArea);
  });

  // Total row
  const totRow = tbody.insertRow();
  totRow.className = 'total-row';
  ['Total', _pkgFmt(totalNetArea), _pkgFmt(totalCarpetArea)].forEach(v => { totRow.insertCell().textContent = v; });

  // Parking required footer row
  const parkingRequired = _calcCarParkingRequired(layerData);
  const footRow = tbody.insertRow();
  footRow.className = 'footer-row';
  const c1 = footRow.insertCell(); c1.textContent = 'Nos. of Car Parking Required:';
  c1.style.cssText = 'color:var(--green);font-weight:700;text-align:left;';
  const c2 = footRow.insertCell(); c2.textContent = parkingRequired;
  c2.colSpan = 2;
  c2.style.cssText = 'color:var(--green);font-weight:700;';

  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);
  container.appendChild(section);

  return parseFloat(parkingRequired) || 0;
}

function _calcCarParkingRequired(layerData) {
  if (!layerData.length) return 'N/A';
  const layer           = layerData[0].layer;
  const totalCarpetArea = layerData.reduce((s, d) => s + parseFloat(d.carpetArea), 0);

  if (layer === 'Business') {
    let spaces;
    if      (totalCarpetArea <= 1500) spaces = totalCarpetArea / 50;
    else if (totalCarpetArea <= 5000) spaces = (totalCarpetArea - 1500) / 75 + 30;
    else                              spaces = (totalCarpetArea - 5000) / 100 + 76;
    return Math.floor(spaces);
  }
  if (layer === 'Mercantile_retail') {
    let parkingSlots = 0;

    if (totalCarpetArea <= 5000) {
      // Rule 1: 1 slot per 50 for the first 5000
      parkingSlots = totalCarpetArea / 50;
    } else {
      // Rule 2: First 5000 at 1 per 50, PLUS excess at 1 per 75
      const baseParking = 5000 / 50; // This equals 100 slots
      const excessArea = totalCarpetArea - 5000;
      const excessParking = excessArea / 75;
      
      parkingSlots = baseParking + excessParking;
    }

    return Math.floor(parkingSlots);
  }
  if (layer === 'Assembly') {
    return totalCarpetArea > 35 ? Math.floor(totalCarpetArea / 35) : 0;
  }
  if (layer === 'Institutional') {
    return totalCarpetArea > 75 ? Math.floor(totalCarpetArea / 75) : 0;
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

/* ── Parking.js calculation helpers ── */
function _pkgCalcTotalFloorArea(filteredRow, parsedData) {
  const col3 = filteredRow[2], col4 = filteredRow[3];
  let sum = 0;
  parsedData.forEach(d => {
    if (d.column3 === col3 && d.column4 === col4 && d.column6 === 'ByLayer' && d.column7 === 'ByLayer')
      sum += d.column8;
  });
  return sum.toFixed(3);
}

function _pkgCalcDeductedArea(filteredRow, parsedData) {
  const col3 = filteredRow[2], col4 = filteredRow[3];
  let sum = 0;
  parsedData.forEach(d => {
    if (d.column3 === col3 && d.column4 === col4 && d.column6 === 'DASHED')
      sum += d.column8;
  });
  return sum.toFixed(3);
}

function _pkgCalcNetArea(total, deducted) {
  return (parseFloat(total) - parseFloat(deducted)).toFixed(3);
}

function _pkgCalcCarpetArea(filteredRow, parsedData) {
  const col3 = filteredRow[2], col4 = filteredRow[3];
  let sum = 0;
  parsedData.forEach(d => {
    if (d.column3 === col3 && d.column4 === col4 && d.column7 === '0.15 mm')
      sum += d.column8;
  });
  return sum.toFixed(3);
}

function _pkgFmt(value) {
  const n = parseFloat(value);
  return isNaN(n) ? '0.000' : n.toFixed(3);
}

/* ══════════════════════════════════════════
   SECTION 3: PROVIDED PARKING
   (ported from parking-provided.js)
══════════════════════════════════════════ */

const _COLOR_DISPLAY = {
  '20': 'Single', '30': 'Two Layer', '40': 'Three Layer', '50': 'Four Layer', '60': 'Five Layer'
};

const _LW_DISPLAY = {
  '0.20 mm': 'Cover at Ground', '0.25 mm': 'Open at Ground',
  '0.15 mm': 'at Basement 1',   '0.05 mm': 'at Basement 2',
  '0.00 mm': 'at Basement 3',   '0.30 mm': 'at 1st Floor',
  '0.35 mm': 'at 2nd Floor',    '0.40 mm': 'at 3rd Floor',
  '0.50 mm': 'at 4th Floor',    '0.60 mm': 'at 5th Floor',
  '0.70 mm': 'at 6th Floor',    '0.80 mm': 'at 7th Floor',
  '0.90 mm': 'at 8th Floor',    '1.00 mm': 'at 9th Floor',
  '2.00 mm': 'at 10th Floor'
};

function _calcParkingNos(color, count) {
  const map = { '20':1, '30':2, '40':3, '50':4, '60':5 };
  return (map[color] || 0) * count;
}

function _calcParkingArea(color, lineweight, count) {
  if (['20','30','40','50','60'].includes(color) && lineweight === '0.20 mm') return 25 * count;
  if (['20','30','40','50','60'].includes(color) && lineweight === '0.25 mm') return 0  * count;
  return 40 * count;
}

function _buildProvidedParking(csv) {
  const rows = csv.split('\n');

  const header = document.getElementById('p-parking-provided-header');
  const table  = document.getElementById('p-parking-provided-table');
  if (!table || !header) return;
  const tbody  = table.querySelector('tbody');
  const footer = document.getElementById('p-parking-provided-footer');

  header.innerHTML = '';
  tbody.innerHTML  = '';
  footer.innerHTML = '';

  let columnIndices = {};
  const parkingDataMap = {};
  let totalParkingNos  = 0;
  let totalParkingArea = 0;

  rows.forEach((row, index) => {
    const cells = row.split(',');

    if (index === 0) {
      // Find column indices
      cells.forEach((cell, ci) => {
        const c = cell.trim();
        if (c === 'Count')      columnIndices.count      = ci;
        if (c === 'Color')      columnIndices.color      = ci;
        if (c === 'Lineweight') columnIndices.lineweight = ci;
        if (c === 'Layer')      columnIndices.layer      = ci;
      });

      // Build header
      ['Count','Type','Level','Nos. of Parking','Parking Area'].forEach(h => {
        const th = document.createElement('th'); th.textContent = h; header.appendChild(th);
      });
      return;
    }

    if (!row.trim()) return;
    if ((cells[columnIndices.layer] || '').trim() !== 'Parking') return;

    const count      = parseInt(cells[columnIndices.count], 10) || 0;
    const color      = (cells[columnIndices.color] || '').trim();
    const lineweight = (cells[columnIndices.lineweight] || '').trim();
    const key        = `${color}-${lineweight}`;

    if (parkingDataMap[key]) {
      parkingDataMap[key].count += count;
    } else {
      parkingDataMap[key] = { count, color, lineweight };
    }
  });

  Object.values(parkingDataMap).forEach(({ count, color, lineweight }) => {
    const parkingNos  = _calcParkingNos(color, count);
    const parkingArea = _calcParkingArea(color, lineweight, count);

    const tr = tbody.insertRow();
    tr.insertCell().textContent = count;
    tr.insertCell().textContent = _COLOR_DISPLAY[color]     || color;
    tr.insertCell().textContent = _LW_DISPLAY[lineweight]   || lineweight;
    tr.insertCell().textContent = parkingNos;
    tr.insertCell().textContent = parkingArea;

    totalParkingNos  += parkingNos;
    totalParkingArea += parkingArea;
  });

  // Footer totals
  const tdLabel = document.createElement('td');
  tdLabel.colSpan = 3; tdLabel.textContent = 'Total:';
  footer.appendChild(tdLabel);
  const tdNos = document.createElement('td'); tdNos.textContent = totalParkingNos;
  footer.appendChild(tdNos);
  const tdArea = document.createElement('td'); tdArea.textContent = totalParkingArea;
  footer.appendChild(tdArea);

  localStorage.setItem('totalParkingNos', totalParkingNos);
  localStorage.setItem('totalParkingArea', totalParkingArea);
  console.log('[kmc_parking] Provided: Nos =', totalParkingNos, '| Area =', totalParkingArea);
}

/* ══════════════════════════════════════════
   SHARED CSV PARSER (uses real \n)
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
