/* ══════════════════════════════════════════
   kmc_parking.js  —  Parking Calculation tab
   Lazy-loaded on first click of Parking tab.
   Ported from: tenement.js + parking.js + parking-provided.js
   Exposes: window.initParkingTables()
            window.generateParkingTables()  (called by Refresh button)

   UPDATES:
   - Assembly  : KMC Rule 78 Cl.IV — sub-typed by Linetype
                 ByLayer/Continuous → General (1 per 65 sqm, min 1)
                 Phantom            → Star Hotel (1 per 120 sqm, min 2)
                 Phantom2           → Other Hotel/Boarding (1 per 250 sqm, min 1)
   - Educational: KMC Rule 78 Cl.II — 1 car per 400 sqm (min 1 if >100 sqm)
                  + 1 bus per 1000 sqm shown as separate footer row
   - Bus & Truck Provided Parking: Color 10 = Bus, Color 15 = Truck
                  Separate table below car parking; 50 sqm per slot
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

  const otherContainer = document.getElementById('p-other-layers-container');
  if (otherContainer) otherContainer.innerHTML = '';

  const ppHeader = document.getElementById('p-parking-provided-header');
  const ppFooter = document.getElementById('p-parking-provided-footer');
  const ppTable  = document.getElementById('p-parking-provided-table');
  if (ppHeader) ppHeader.innerHTML = '';
  if (ppFooter) ppFooter.innerHTML = '';
  if (ppTable) {
    const tb = ppTable.querySelector('tbody');
    if (tb) tb.innerHTML = '';
  }

  /* Clear all parking localStorage keys to prevent stale data */
  localStorage.removeItem('totalParkingNos');
  localStorage.removeItem('totalParkingArea');
  localStorage.removeItem('totalReqCarParking');
  localStorage.removeItem('totalParkingRequired');
  localStorage.removeItem('reqParkingArea');
  localStorage.removeItem('totalBusTruckNos');
  localStorage.removeItem('totalBusTruckArea');
}

/* ══════════════════════════════════════════
   SECTION 1: TENEMENT PARKING
   (ported from tenement.js)
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

  const floorIndex    = headers.indexOf('Color');
  const linetypeIndex = headers.indexOf('Linetype');
  const areaIndex     = headers.indexOf('Area');
  const layerIndex    = headers.indexOf('Layer');

  const entries = new Map();

  rows.slice(1).forEach(row => {
    if (!row.trim()) return;
    const cells    = row.split(',');
    const layer    = cells[layerIndex];
    const linetype = cells[linetypeIndex];
    const area     = parseFloat(cells[areaIndex]) || 0;

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

  const floorIndex        = headers.indexOf('Color');
  const tenementTypeIndex = headers.indexOf('Layer');
  const lineweightIndex   = headers.indexOf('Lineweight');
  const linetypeIndex     = headers.indexOf('Linetype');
  const areaIndex         = headers.indexOf('Area');

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

  floorGroup.forEach((entries) => {
    entries.sort((a, b) => a.lineweight - b.lineweight);
    entries.forEach((e, i) => {
      const flatName = String.fromCharCode(65 + i) + e.floor.slice(-2);
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
  const rows    = data.split('\n');
  const headers = rows[0].split(',');
  const table   = document.getElementById(tableId);
  if (!table) return;
  const header  = document.getElementById(headerId);
  const tbody   = table.querySelector('tbody');
  const tfoot   = table.querySelector('tfoot');

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

  const totalCells = rows[rows.length - 1].split(',');
  const totRow = document.createElement('tr');
  totalCells.forEach(c => {
    const td = document.createElement('td'); td.textContent = c; totRow.appendChild(td);
  });
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

  headers.forEach(h => {
    if (h === 'Floor' || h === 'Lineweight') return;
    const th = document.createElement('th');
    th.textContent = h;
    header.appendChild(th);
  });
  ['Nos. of Flats', 'Req. Car Parking'].forEach(h => {
    const th = document.createElement('th'); th.textContent = h; header.appendChild(th);
  });

  const uniqueEntries     = new Map();
  const tenementRangeTots = new Map();

  let totalCoveredArea       = 0;
  let totalShareOfCommonArea = 0;
  let totalTenementArea      = 0;
  let totalNosOfFlats        = 0;

  rows.slice(1, -1).forEach(row => {
    if (!row.trim()) return;
    const cells         = row.split(',');
    const flatName      = cells[1];
    const tenementType  = cells[2];
    const coveredArea   = parseFloat(cells[4]);
    const shareOfCommon = parseFloat(cells[5]);
    const tenementArea  = parseFloat(cells[6]);
    const tenementRange = cells[7];
    const key = `${tenementType}-${tenementArea}-${tenementRange}`;

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
      case 'BELOW 50':  return Math.floor(totalNosOfFlats / 6);
      case '50 - 75':   return Math.floor(totalNosOfFlats / 4);
      case '75 - 100':  return Math.floor(totalNosOfFlats / 2);
      case 'ABOVE 100': return Math.floor(tenementArea / 100) * totalNosOfFlats;
      default:          return 0;
    }
  }
  if (['Tenement_Single','Tenement_Single_Ext_1'].includes(tenementType)) {
    switch (tenementRange) {
      case 'BELOW 100': return 0;
      case 'ABOVE 100': return Math.floor(totalNosOfFlats / 1);
      case 'ABOVE 200': return Math.floor(tenementArea / 200) * totalNosOfFlats;
      default:          return 0;
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

/* ── Updated _getLayerData: includes linetype for Assembly sub-typing ── */
function _getLayerData(layer, rows, parsedData) {
  const layerData = [];
  const seen      = new Set();

  rows.forEach((row, index) => {
    if (index === 0 || !row.trim()) return;
    const cells    = row.split(',');
    const rowLayer = cells[3];

    // For Assembly: key includes linetype so each sub-type gets its own row
    const key = layer === 'Assembly'
      ? `${cells[2]},${cells[3]},${(cells[5] || '').trim()}`
      : `${cells[2]},${cells[3]}`;

    if (rowLayer !== layer || seen.has(key)) return;
    seen.add(key);

    const tfa = _pkgCalcTotalFloorArea(cells, parsedData);
    const da  = _pkgCalcDeductedArea(cells, parsedData);
    layerData.push({
      floor:          cells[2],
      layer:          cells[3],
      linetype:       (cells[5] || '').trim(),   // used by Assembly sub-typing
      totalFloorArea: _pkgFmt(tfa),
      deductedArea:   _pkgFmt(da),
      netArea:        _pkgFmt(_pkgCalcNetArea(tfa, da)),
      carpetArea:     _pkgFmt(_pkgCalcCarpetArea(cells, parsedData)),
    });
  });

  return layerData;
}

/* ── Updated _createLayerTable: adds Bus row for Educational ── */
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
  ['Floor', 'Net Area', 'Carpet Area'].forEach(h => {
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
  ['Total', _pkgFmt(totalNetArea), _pkgFmt(totalCarpetArea)].forEach(v => {
    totRow.insertCell().textContent = v;
  });

  // Car Parking required footer row
  const parkingRequired = _calcCarParkingRequired(layerData);
  const footRow = tbody.insertRow();
  footRow.className = 'footer-row';
  const c1 = footRow.insertCell(); c1.textContent = 'Nos. of Car Parking Required:';
  c1.style.cssText = 'color:var(--green);font-weight:700;text-align:left;';
  const c2 = footRow.insertCell(); c2.textContent = parkingRequired;
  c2.colSpan = 2;
  c2.style.cssText = 'color:var(--green);font-weight:700;';

  // ── Bus Parking row — Educational only (KMC Rule 78 Cl.II) ──
  if (layer === 'Educational') {
    const busParking = totalNetArea > 0 ? Math.floor(totalNetArea / 1000) : 0;
    const busRow = tbody.insertRow();
    busRow.className = 'footer-row';
    const b1 = busRow.insertCell(); b1.textContent = 'Nos. of Bus Parking Required:';
    b1.style.cssText = 'color:var(--green);font-weight:700;text-align:left;';
    const b2 = busRow.insertCell(); b2.textContent = busParking;
    b2.colSpan = 2;
    b2.style.cssText = 'color:var(--green);font-weight:700;';
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);
  container.appendChild(section);

  // Only car parking counts toward the grand total
  return parseFloat(parkingRequired) || 0;
}

/* ── Updated _calcCarParkingRequired — Assembly, Educational, all others ── */
function _calcCarParkingRequired(layerData) {
  if (!layerData.length) return 'N/A';
  const layer         = layerData[0].layer;
  const totalNetArea  = layerData.reduce((s, d) => s + parseFloat(d.netArea),    0);
  const totalCarpetArea = layerData.reduce((s, d) => s + parseFloat(d.carpetArea), 0);

  //-------CAR PARKING CALCULATION FOR BUSINESS-------// KMC Rule 78 Cl.V — ALL OK
  if (layer === 'Business') {
    if (totalNetArea <= 50) return 0;
    if (totalNetArea <= 70) return 1;
    return Math.floor(totalNetArea / 70);
  }

  //-------CAR PARKING CALCULATION FOR MERCANTILE RETAIL-------// KMC Rule 78 Cl.VI — ALL OK
  if (layer === 'Mercantile_retail') {
    let parkingSlots = 0;
    if (totalNetArea <= 5000) {
      parkingSlots = totalNetArea / 50;
    } else {
      const baseParking   = 5000 / 50;                   // 100 slots
      const excessParking = (totalNetArea - 5000) / 75;
      parkingSlots = baseParking + excessParking;
    }
    return Math.floor(parkingSlots);
  }

  //-------CAR PARKING CALCULATION FOR ASSEMBLY-------// KMC Rule 78 Cl.IV
  // Sub-typed by Linetype:
  //   ByLayer / Continuous → General assembly (theatres, restaurants, clubs etc.)
  //   Phantom              → Star Hotels
  //   Phantom2             → Other Hotels / Boarding & Guest Houses
  if (layer === 'Assembly') {
    const general    = layerData.filter(d => d.linetype === 'ByLayer');
    const starHotel  = layerData.filter(d => d.linetype === 'PHANTOM');
    const otherHotel = layerData.filter(d => d.linetype === 'PHANTOM2');

    const netGeneral   = general.reduce((s, d)    => s + parseFloat(d.netArea), 0);
    const netStar      = starHotel.reduce((s, d)  => s + parseFloat(d.netArea), 0);
    const netOther     = otherHotel.reduce((s, d) => s + parseFloat(d.netArea), 0);

    let parking = 0;

    // (a) General: 1 per 65 sqm; minimum 1 if any area exists
    if (netGeneral > 0) {
      parking += netGeneral >= 65 ? Math.floor(netGeneral / 65) : 1;
    }

    // (b)(i) Star Hotels: 1 per 120 sqm; minimum 2
    if (netStar > 0) {
      parking += Math.max(Math.floor(netStar / 120), 2);
    }

    // (c) Other Hotels / Boarding Houses: 1 per 250 sqm; minimum 1
    if (netOther > 0) {
      parking += Math.max(Math.floor(netOther / 250), 1);
    }

    return parking;
  }

  //-------CAR PARKING CALCULATION FOR INSTITUTIONAL-------// KMC Rule 78 Cl.III — ALL OK
  if (layer === 'Institutional') {
    return totalNetArea > 75 ? Math.floor(totalNetArea / 90) : 0;
  }

  //-------CAR PARKING CALCULATION FOR EDUCATIONAL-------// KMC Rule 78 Cl.II
  // Bus parking is handled separately in _createLayerTable (not added to grand total)
  if (layer === 'Educational') {
    if (totalNetArea <= 100) return 0;
    return Math.max(1, Math.floor(totalNetArea / 400));
  }

  //-------CAR PARKING FOR INDUSTRIAL / STORAGE / HAZARDOUS / MERCANTILE WHOLESALE-------//
  // KMC Rule 78 Cl.VII: ≤200 sqm = 0; >200 sqm = 1 per 200 sqm
  if (['Industrial', 'Storage', 'Hazardous', 'Mercantile_wholesale'].includes(layer)) {
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

/* ── Parking area calculation helpers ── */
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
   UPDATED: Bus (Color 10) & Truck (Color 15)
            split into a separate table below
══════════════════════════════════════════ */

const _COLOR_DISPLAY = {
  '20': 'Single', '30': 'Two Layer', '40': 'Three Layer', '50': 'Four Layer', '60': 'Five Layer'
};

const _LW_DISPLAY = {
  '0.20 mm': 'Cover at Ground', '0.25 mm': 'Open at Ground', '0.30 mm': 'Other than Ground'
};

const _BT_COLOR_DISPLAY = {
  '10': 'Bus',
  '15': 'Truck'
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

  let columnIndices    = {};
  const carDataMap     = {};   // Color 20-110 — car parking
  const busTruckMap    = {};   // Color 10 (Bus) & 15 (Truck)
  let totalParkingNos  = 0;
  let totalParkingArea = 0;

  rows.forEach((row, index) => {
    const cells = row.split(',');

    if (index === 0) {
      cells.forEach((cell, ci) => {
        const c = cell.trim();
        if (c === 'Count')      columnIndices.count      = ci;
        if (c === 'Color')      columnIndices.color      = ci;
        if (c === 'Lineweight') columnIndices.lineweight = ci;
        if (c === 'Layer')      columnIndices.layer      = ci;
      });

      ['Count', 'Type', 'Level', 'Nos. of Parking', 'Parking Area'].forEach(h => {
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

    // Color 10 = Bus, Color 15 = Truck → separate map
    if (color === '10' || color === '15') {
      if (busTruckMap[key]) busTruckMap[key].count += count;
      else busTruckMap[key] = { count, color, lineweight };
    } else {
      if (carDataMap[key]) carDataMap[key].count += count;
      else carDataMap[key] = { count, color, lineweight };
    }
  });

  // ── Car parking rows ──
  Object.values(carDataMap).forEach(({ count, color, lineweight }) => {
    const parkingNos  = _calcParkingNos(color, count);
    const parkingArea = _calcParkingArea(color, lineweight, count);

    const tr = tbody.insertRow();
    tr.insertCell().textContent = count;
    tr.insertCell().textContent = _COLOR_DISPLAY[color]   || color;
    tr.insertCell().textContent = _LW_DISPLAY[lineweight] || lineweight;
    tr.insertCell().textContent = parkingNos;
    tr.insertCell().textContent = parkingArea;

    totalParkingNos  += parkingNos;
    totalParkingArea += parkingArea;
  });

  // Car footer totals
  const tdLabel = document.createElement('td');
  tdLabel.colSpan = 3; tdLabel.textContent = 'Total:';
  footer.appendChild(tdLabel);
  const tdNos  = document.createElement('td'); tdNos.textContent  = totalParkingNos;  footer.appendChild(tdNos);
  const tdArea = document.createElement('td'); tdArea.textContent = totalParkingArea; footer.appendChild(tdArea);

  // reqParkingArea logic (car only)
  let maxNosRow = null, maxNos = 0;
  Object.values(carDataMap).forEach(({ count, color, lineweight }) => {
    const nos = _calcParkingNos(color, count);
    if (nos > maxNos) { maxNos = nos; maxNosRow = { color, lineweight }; }
  });
  const areaPerSlot   = maxNosRow ? _calcParkingArea(maxNosRow.color, maxNosRow.lineweight, 1) : 25;
  const totalRequired = (parseInt(localStorage.getItem('totalReqCarParking'))  || 0)
                      + (parseInt(localStorage.getItem('totalParkingRequired')) || 0);
  const reqParkArea = totalParkingNos > totalRequired
    ? totalRequired * areaPerSlot
    : totalParkingArea;

  localStorage.setItem('totalParkingNos',  totalParkingNos);
  localStorage.setItem('totalParkingArea', totalParkingArea);
  localStorage.setItem('reqParkingArea',   reqParkArea);
  console.log('[kmc_parking] Provided Car: Nos =', totalParkingNos, '| Area =', totalParkingArea);

  // ── Bus & Truck separate table (if any drawn) ──
  if (Object.keys(busTruckMap).length > 0) {
    _buildBusTruckTable(busTruckMap);
  }
}

/* ── Bus & Truck Provided Parking Table — 50 sqm per slot ── */
function _buildBusTruckTable(busTruckMap) {
  const container = document.getElementById('p-other-layers-container');
  if (!container) return;

  const section = document.createElement('div');
  section.className = 'filtered-block';

  const heading = document.createElement('h2');
  heading.className = 'filtered-table-title';
  heading.textContent = 'Bus & Truck Parking (Provided)';
  section.appendChild(heading);

  const wrap  = document.createElement('div');
  wrap.className = 'table-wrap';

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  const tfoot = document.createElement('tfoot');

  const hRow = document.createElement('tr');
  ['Count', 'Type', 'Level', 'Nos. of Parking', 'Parking Area'].forEach(h => {
    const th = document.createElement('th'); th.textContent = h; hRow.appendChild(th);
  });
  thead.appendChild(hRow);

  let totalBTNos  = 0;
  let totalBTArea = 0;

  Object.values(busTruckMap).forEach(({ count, color, lineweight }) => {
    const nos  = count;           // 1 slot per drawn element
    const area = 50 * count;      // 50 sqm per slot (Bus & Truck)

    const tr = tbody.insertRow();
    tr.insertCell().textContent = count;
    tr.insertCell().textContent = _BT_COLOR_DISPLAY[color]  || color;
    tr.insertCell().textContent = _LW_DISPLAY[lineweight]   || lineweight;
    tr.insertCell().textContent = nos;
    tr.insertCell().textContent = area;

    totalBTNos  += nos;
    totalBTArea += area;
  });

  // Footer totals
  const fRow = document.createElement('tr');
  fRow.className = 'total-row';
  const fLabel = document.createElement('td');
  fLabel.colSpan = 3; fLabel.textContent = 'Total:';
  fRow.appendChild(fLabel);
  const fNos  = document.createElement('td'); fNos.textContent  = totalBTNos;  fRow.appendChild(fNos);
  const fArea = document.createElement('td'); fArea.textContent = totalBTArea; fRow.appendChild(fArea);
  tfoot.appendChild(fRow);

  localStorage.setItem('totalBusTruckNos',  totalBTNos);
  localStorage.setItem('totalBusTruckArea', totalBTArea);

  table.appendChild(thead);
  table.appendChild(tbody);
  table.appendChild(tfoot);
  wrap.appendChild(table);
  section.appendChild(wrap);
  container.appendChild(section);

  console.log('[kmc_parking] Provided Bus/Truck: Nos =', totalBTNos, '| Area =', totalBTArea);
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
