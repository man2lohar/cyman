/* ══════════════════════════════════════════
   kmc_master.js  —  Final Summary tab logic
   Lazy-loaded on first click of the Final Summary tab.
   Handles:
   • Reading all computed values from localStorage
   • Populating the comparison, open-spaces,
     parking and fees tables
   • FAR / Ground Coverage / Height calculations
   • Tree Cover / CB-Loft calculations
   • Update popup (inline, replacing the old popup.html)
   • Compare() — red highlight on exceeded values
   • Open Spaces extraction
══════════════════════════════════════════ */

(function initMaster() {

  /* ────────────────────────────────────────
     Shared state
  ──────────────────────────────────────── */
  let ParkingAreaSum = 0;

  /* ────────────────────────────────────────
     Helpers
  ──────────────────────────────────────── */
  function formatNumber(value) {
    const n = parseFloat(value);
    return isNaN(n) ? value : n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }

  function interpolate(minVal, maxVal, minPct, maxPct, size) {
    return minPct + ((size - minVal) / (maxVal - minVal)) * (maxPct - minPct);
  }

  /* ────────────────────────────────────────
     CSV parser (same structure as master.js)
  ──────────────────────────────────────── */
  function parseCSVToArray(csv) {
    const rows = csv.split('\n');
    const data = [];
    rows.forEach((row, index) => {
      if (index !== 0 && row.trim() !== '') {
        const cells = row.split(',');
        data.push({
          column2: (cells[1] || '').trim(),
          column3: (cells[2] || '').trim(),
          column4: (cells[3] || '').trim(),
          column5: parseFloat(cells[4]) || 0,
          column6: (cells[5] || '').trim(),
          column7: (cells[6] || '').trim(),
          column8: parseFloat(cells[7]) || 0,
          column9: (cells[8] || '').trim(),  // trim \r\n so '-1' matches
        });
      }
    });
    return data;
  }

  /* ────────────────────────────────────────
     displayFilteredData — extract raw values
     from CSV and populate proposed cells
  ──────────────────────────────────────── */
  function displayFilteredData(csv) {
    const mainTableData = parseCSVToArray(csv);

    const RoadWidthCell      = document.getElementById('roadwidth');
    const HeightCell         = document.getElementById('pro-height');
    const landAreaCell       = document.getElementById('land-area');
    const landAreaDocCell    = document.getElementById('land-area-doc');
    const groundCoverageCell = document.getElementById('pro-ground-coverage');
    const FrontCell          = document.getElementById('pro-front');
    const Side1Cell          = document.getElementById('pro-side1');
    const Side2Cell          = document.getElementById('pro-side2');
    const RearCell           = document.getElementById('pro-rear');

    let RoadWidthSum = 0, HeightSum = 0, landAreaSum = 0;
    let GroundCoverageSum = 0;
    let FrontSum = 0, Side1Sum = 0, Side2Sum = 0, RearSum = 0;
    ParkingAreaSum = 0;

    mainTableData.forEach(row => {
      const { column2: name, column3: color, column4: layer,
              column5: length, column6: linetype, column7: lineweight,
              column8: area, column9: closed } = row;

      if (name === 'Line' && color === '230' && layer === 'Road' && linetype === 'ByLayer' && lineweight === '0.15 mm')
        RoadWidthSum += length;
      if (name === 'Line' && color === 'magenta' && layer === 'Height' && linetype === 'ByLayer' && lineweight === '0.15 mm')
        HeightSum += length;
      if (name === 'Polyline' && color === '240' && layer === 'Plot' && linetype === 'PHANTOM2' && lineweight === '0.50 mm' && closed === '-1')
        landAreaSum += area;
      if (name === 'Polyline' && layer === 'Parking_Area' && lineweight === '0.15 mm' && closed === '-1')
        ParkingAreaSum += area;
      const colorNum = parseFloat(color);
      if (name === 'Polyline' && (colorNum <= 53 || colorNum >= 152) && layer === 'Ground Coverage' && closed === '-1') {
        linetype === 'DASHED' ? (GroundCoverageSum -= area) : (GroundCoverageSum += area);
      }
      if (name === 'Line' && color === '53'      && layer === 'Open Space' && linetype === 'ByLayer' && lineweight === 'ByLayer') FrontSum  += length;
      if (name === 'Line' && color === '73'      && layer === 'Open Space' && linetype === 'ByLayer' && lineweight === 'ByLayer') Side1Sum  += length;
      if (name === 'Line' && color === '83'      && layer === 'Open Space' && linetype === 'ByLayer' && lineweight === 'ByLayer') Side2Sum  += length;
      if (name === 'Line' && color === '63'      && layer === 'Open Space' && linetype === 'ByLayer' && lineweight === 'ByLayer') RearSum   += length;
    });

    if (RoadWidthCell)      RoadWidthCell.textContent      = formatNumber(RoadWidthSum) + ' M.';
    if (HeightCell)         HeightCell.textContent         = formatNumber(HeightSum) + ' M.';
    if (landAreaCell)       landAreaCell.textContent       = formatNumber(landAreaSum.toFixed(3)) + ' Sq.m.';
    if (landAreaDocCell)    landAreaDocCell.textContent    = formatNumber(landAreaSum.toFixed(3)) + ' Sq.m.';
    if (groundCoverageCell) groundCoverageCell.textContent = formatNumber(GroundCoverageSum.toFixed(3)) + ' Sq.m.';
    if (FrontCell)          FrontCell.textContent          = formatNumber(FrontSum) + ' M.';
    if (Side1Cell)          Side1Cell.textContent          = formatNumber(Side1Sum) + ' M.';
    if (Side2Cell)          Side2Cell.textContent          = formatNumber(Side2Sum) + ' M.';
    if (RearCell)           RearCell.textContent           = formatNumber(RearSum) + ' M.';

    const proParking = document.getElementById('pro-park-area');
    if (proParking) proParking.textContent = formatNumber(ParkingAreaSum.toFixed(3)) + ' Sq.m.';

    calculateProposedFAR();
  }

  /* ────────────────────────────────────────
     FAR calculations
  ──────────────────────────────────────── */
  const floorAreaRatioTable = [
    { width: [0, 2.4],       residential: 0,    educational: 0,    industrial: 0,    storage: 0,    hazardous: 0,    assembly: 0,    business: 0,    institutional: 0,    mercantile_retail: 0,    Mercantile_wholesale: 0 },
    { width: [2.4, 3.5],     residential: 1.25, educational: 0,    industrial: 0,    storage: 0,    hazardous: 0,    assembly: 0,    business: 0,    institutional: 0,    mercantile_retail: 0,    Mercantile_wholesale: 0 },
    { width: [3.5, 7.0],     residential: 1.75, educational: 0,    industrial: 0,    storage: 0,    hazardous: 0,    assembly: 0,    business: 0,    institutional: 0,    mercantile_retail: 0,    Mercantile_wholesale: 0 },
    { width: [7.0, 9.0],     residential: 2.0,  educational: 2.0,  industrial: 0,    storage: 0,    hazardous: 0,    assembly: 0,    business: 0,    institutional: 0,    mercantile_retail: 0,    Mercantile_wholesale: 0 },
    { width: [9.0, 15.0],    residential: 2.25, educational: 2.25, industrial: 2.0,  storage: 2.0,  hazardous: 2.0,  assembly: 2.0,  business: 2.0,  institutional: 2.0,  mercantile_retail: 2.0,  Mercantile_wholesale: 2.0 },
    { width: [15.0, 21.5],   residential: 2.5,  educational: 2.5,  industrial: 2.0,  storage: 2.0,  hazardous: 2.0,  assembly: 2.25, business: 2.25, institutional: 2.25, mercantile_retail: 2.25, Mercantile_wholesale: 2.25 },
    { width: [21.5, 24.0],   residential: 2.75, educational: 2.75, industrial: 2.0,  storage: 2.0,  hazardous: 2.0,  assembly: 2.5,  business: 2.5,  institutional: 2.5,  mercantile_retail: 2.5,  Mercantile_wholesale: 2.5 },
    { width: [24.0, Infinity],residential: 3.0, educational: 3.0,  industrial: 2.0,  storage: 2.0,  hazardous: 2.0,  assembly: 2.75, business: 2.75, institutional: 2.75, mercantile_retail: 2.75, Mercantile_wholesale: 2.75 }
  ];

  function calculateFAR() {
    const widthOfAccess = parseFloat(document.getElementById('roadwidth').textContent);
    const buildingType  = document.getElementById('usegroup').textContent.toLowerCase();
    const permEl        = document.getElementById('per-far');
    if (!permEl) return;

    if (isNaN(widthOfAccess) || widthOfAccess === 0) {
      permEl.textContent = 'No width of access';
      permEl.classList.add('text-red');
      return;
    }

    let farValue = null;
    for (const row of floorAreaRatioTable) {
      if (widthOfAccess > row.width[0] && widthOfAccess <= row.width[1]) {
        farValue = row[buildingType] ?? null;
        break;
      }
    }
    permEl.textContent = farValue !== null ? farValue : '';
    Compare();
  }

  function calculateProposedFAR() {
    const LandArea        = parseFloat(document.getElementById('land-area')?.textContent.replace(/,/g, '')) || 0;
    const minLandDoc      = parseFloat(document.getElementById('land-area-doc')?.textContent.replace(/,/g, '')) || 0;
    const totalParkingArea = parseFloat(localStorage.getItem('totalParkingArea')) || 0;
    const netFloorAreaSum  = parseFloat(localStorage.getItem('netFloorAreaSum')) || 0;

    if (ParkingAreaSum >= 0) {
      const minLandArea    = Math.min(LandArea, minLandDoc);
      const netParkingArea = Math.min(totalParkingArea, ParkingAreaSum);
      const proposedFAR    = (netFloorAreaSum - netParkingArea) / minLandArea;
      const proFAR         = document.getElementById('pro-far');
      if (proFAR) proFAR.textContent = proposedFAR.toFixed(3);
    }
  }

  /* ────────────────────────────────────────
     Ground Coverage
  ──────────────────────────────────────── */
  function calculateGroundCoverage() {
    const landAreaBoundary    = parseFloat(document.getElementById('land-area')?.textContent.replace(/,/g, '').split(' ')[0]);
    const landAreaDoc         = parseFloat(document.getElementById('land-area-doc')?.textContent.replace(/,/g, '').split(' ')[0]);
    const proposedGC          = parseFloat(document.getElementById('pro-ground-coverage')?.textContent.replace(/,/g, '').split(' ')[0]);
    const buildingType        = document.getElementById('usegroup')?.textContent.toLowerCase();
    const minLandArea         = Math.min(landAreaBoundary, landAreaDoc);

    const coverageTable = {
      residential: { upTo500: 60, above500: 50, above5000: 45 },
      educational:          { upTo200: 50, upTo500: 45, above500: 45, above5000: 35 },
      institutional:        { upTo200: 40, upTo500: 40, above500: 40, above5000: 35 },
      assembly:             { upTo200: 40, upTo500: 40, above500: 40, above5000: 35 },
      mercantile_retail:    { upTo200: 40, upTo500: 40, above500: 40, above5000: 35 },
      mercantile_wholesale: { upTo200: 40, upTo500: 40, above500: 40, above5000: 35 },
      industrial:           { upTo200: 40, upTo500: 40, above500: 40, above5000: 35 },
      storage:              { upTo200: 40, upTo500: 40, above500: 40, above5000: 35 },
      hazardous:            { upTo200: 40, upTo500: 40, above500: 40, above5000: 35 },
      business:             { upTo200: 40, upTo500: 40, above500: 40, above5000: 35 },
    };

    function getPermissibleCoveragePct(plotSize, type) {
      const t = coverageTable[type];
      if (!t) return 0;
      if (plotSize <= 500)  return t.upTo500;
      if (plotSize <= 5000) return t.above500;
      return t.above5000;
    }

    const permPct  = getPermissibleCoveragePct(minLandArea, buildingType);
    const permArea = (minLandArea * permPct) / 100;
    const propPct  = (proposedGC / minLandArea) * 100;

    const permEl = document.getElementById('per-ground-coverage');
    const propEl = document.getElementById('pro-ground-coverage');
    if (permEl) permEl.textContent = `${permArea.toFixed(3)} Sq. m. (${permPct.toFixed(3)}%)`;
    if (propEl) {
      propEl.textContent = `${proposedGC.toFixed(3)} Sq. m. (${propPct.toFixed(3)}%)`;
      propPct > permPct ? propEl.classList.add('text-red') : propEl.classList.remove('text-red');
    }
  }

  /* ────────────────────────────────────────
     Height
  ──────────────────────────────────────── */
  function calculateHeight() {
    const widthOfAccess = parseFloat(document.getElementById('roadwidth')?.textContent);
    const permEl        = document.getElementById('per-height');
    if (!permEl) return;

    if (isNaN(widthOfAccess) || widthOfAccess === 0) {
      permEl.textContent = 'No width of access';
      permEl.classList.add('text-red');
      return;
    }

    const HeightTable = [
      { width: [0, 2.4],       height: 7.0 },
      { width: [2.4, 3.5],     height: 10.0 },
      { width: [3.5, 7.0],     height: 12.5 },
      { width: [7.0, 9.0],     height: 21.5 },
      { width: [9.0, 12.0],    height: 40.0 },
      { width: [12.0, 15.0],   height: 60.0 },
      { width: [15.0, Infinity], height: Infinity },
    ];

    let heightValue = null;
    for (const row of HeightTable) {
      if (widthOfAccess > row.width[0] && widthOfAccess <= row.width[1]) { heightValue = row.height; break; }
    }

    if (heightValue !== null) {
      permEl.textContent = isFinite(heightValue) ? heightValue.toFixed(2) + ' M.' : 'No limit';
    } else {
      permEl.textContent = 'No permissible height';
      permEl.classList.add('text-red');
    }

    const propEl   = document.getElementById('pro-height');
    const propH    = parseFloat(propEl?.textContent.replace(/ M./, '')) || 0;
    const permH    = parseFloat(permEl.textContent.replace(/ M./, '')) || 0;
    propH > permH ? propEl.classList.add('text-red') : propEl.classList.remove('text-red');
  }

  /* ────────────────────────────────────────
     Tree Cover & CB-Loft
  ──────────────────────────────────────── */
  function TreeCover() {
    const landAreaBoundary      = parseFloat(document.getElementById('land-area')?.textContent.replace(/,/g, '').split(' ')[0]);
    const totalfloorarea        = parseFloat(document.getElementById('total-fees-area')?.textContent.replace(/,/g, '').split(' ')[0]);
    const treecover             = (0.0025 * totalfloorarea) * landAreaBoundary / 100;
    const permissibleTreePct    = (0.0025 * totalfloorarea);
    const cbloftArea            = 0.03 * totalfloorarea;

    const treecoverCell = document.getElementById('per-tree');
    if (treecoverCell) treecoverCell.textContent = `${treecover.toFixed(3)} Sq. m. (${permissibleTreePct.toFixed(3)}%)`;

    const cbloftCell = document.getElementById('per-cb');
    if (cbloftCell) cbloftCell.textContent = `${cbloftArea.toFixed(3)} Sq. m. (3.000%)`;
  }

  /* ────────────────────────────────────────
     Open Spaces lookup table
  ──────────────────────────────────────── */
  const minimumOpenSpaces = {
    residential: [
      { height: 'Up to 7.0 M.',               front: '1.2 M.', side1: '1.2 M.', side2: '1.2 M.',  rear: '2.0 M.' },
      { height: 'Above 7.0 M. up to 10.0 M.', front: '1.2 M.', side1: '1.2 M.', side2: '1.2 M.',  rear: '3.0 M.' },
      { height: 'Above 10.0 M. up to 12.5 M.',front: '1.2 M.', side1: '1.2 M.', side2: '1.5 M.',  rear: '3.0 M.' },
      { height: 'Above 12.5 M. up to 15.5 M.',front: '2.0 M.', side1: '1.5 M.', side2: '2.5 M.',  rear: '4.0 M.' },
      { height: 'Above 15.5 M. up to 21.5 M.',front: '3.5 M.', side1: '4.0 M.', side2: '4.0 M.',  rear: '5.0 M.' },
      { height: 'Above 21.5 M. up to 25.5 M.',front: '5.0 M.', side1: '5.0 M.', side2: '5.0 M.',  rear: '6.5 M.' },
      { height: 'Above 25.5 M. up to 40.0 M.',front: '6.0 M.', side1: '6.5 M.', side2: '6.5 M.',  rear: '8.5 M.' },
      { height: 'Above 40.0 M. up to 60.0 M.',front: '8.0 M.', side1: '8.0 M.', side2: '8.0 M.',  rear: '10.0 M.' },
      { height: 'Above 60.0 M. up to 80.0 M.',front: '10.0 M.',side1: '15% of height or 11.0 M., whichever is less', side2: '15% of height or 11.0 M., whichever is less', rear: '12.0 M.' },
      { height: 'Above 80.0 M.',               front: '12.0 M.',side1: '15% of height or 14.0 M., whichever is less', side2: '15% of height or 14.0 M., whichever is less', rear: '14.0 M.' },
    ],
    educational: [
      { height: 'Up to 10.0 M. for land area up to 500.0 sq. M.',   front: '2.0 M.', side1: '1.8 M.', side2: '4.0 M.', rear: '3.5 M.' },
      { height: 'Up to 10.0 M. for land area above 500.0 sq. M.',   front: '3.5 M.', side1: '3.5 M.', side2: '4.0 M.', rear: '4.0 M.' },
      { height: 'Above 10.0 M. up to 15.5 M.', front: '3.5 M.', side1: '4.0 M.', side2: '4.0 M.', rear: '5.0 M.' },
      { height: 'Above 15.5 M. up to 21.5 M.', front: '5.0 M.', side1: '5.0 M.', side2: '5.0 M.', rear: '6.0 M.' },
      { height: 'Above 21.5 M.', front: '20% of the height of building or 6 M., whichever is more', side1: '20% of the height of building or 5 M., whichever is more', side2: '20% of the height of building or 5 M., whichever is more', rear: '20% of the height of building or 8 M., whichever is more' },
    ],
    institutional: [
      { height: 'Up to 10.0 M. for land area up to 500.0 sq. M.',  front: '2.0 M.', side1: '1.2 M.', side2: '4.0 M.', rear: '4.0 M.' },
      { height: 'Up to 10.0 M. for land area above 500.0 sq. M.',  front: '3.0 M.', side1: '3.5 M.', side2: '4.0 M.', rear: '4.0 M.' },
      { height: 'Above 10.0 M. up to 21.5 M.',  front: '4.0 M.', side1: '4.0 M.', side2: '4.0 M.', rear: '5.0 M.' },
      { height: 'Above 21.5 M. up to 25.5 M.',  front: '5.0 M.', side1: '5.0 M.', side2: '5.0 M.', rear: '6.0 M.' },
      { height: 'Above 25.5 M. up to 40.0 M.',  front: '6.0 M.', side1: '6.5 M.', side2: '6.5 M.', rear: '9.0 M.' },
      { height: 'Above 40.0 M. up to 60.0 M.',  front: '8.0 M.', side1: '9.0 M.', side2: '9.0 M.', rear: '10.0 M.' },
      { height: 'Above 60.0 M. up to 80.0 M.',  front: '10.0 M.', side1: '15% of the height of building or 11.0 M., whichever is less', side2: '15% of the height of building or 11.0 M., whichever is less', rear: '12.0 M.' },
      { height: 'Above 80.0 M.',                 front: '12.0 M.', side1: '15% of the height of building or 14.0 M., whichever is less', side2: '15% of the height of building or 14.0 M., whichever is less', rear: '14.0 M.' },
    ],
    assembly: [
      { height: 'Up to 10.0 M. for land area up to 500.0 sq. M.',  front: '2.0 M.', side1: '1.2 M.', side2: '4.0 M.', rear: '4.0 M.' },
      { height: 'Up to 10.0 M. for land area above 500.0 sq. M.',  front: '3.0 M.', side1: '3.5 M.', side2: '4.0 M.', rear: '4.0 M.' },
      { height: 'Above 10.0 M. up to 21.5 M.',  front: '4.0 M.', side1: '4.0 M.', side2: '4.0 M.', rear: '5.0 M.' },
      { height: 'Above 21.5 M. up to 25.5 M.',  front: '5.0 M.', side1: '5.0 M.', side2: '5.0 M.', rear: '6.0 M.' },
      { height: 'Above 25.5 M. up to 40.0 M.',  front: '6.0 M.', side1: '6.5 M.', side2: '6.5 M.', rear: '9.0 M.' },
      { height: 'Above 40.0 M. up to 60.0 M.',  front: '8.0 M.', side1: '9.0 M.', side2: '9.0 M.', rear: '10.0 M.' },
      { height: 'Above 60.0 M. up to 80.0 M.',  front: '10.0 M.', side1: '15% of the height of building or 11.0 M., whichever is less', side2: '15% of the height of building or 11.0 M., whichever is less', rear: '12.0 M.' },
      { height: 'Above 80.0 M.',                 front: '12.0 M.', side1: '15% of the height of building or 14.0 M., whichever is less', side2: '15% of the height of building or 14.0 M., whichever is less', rear: '14.0 M.' },
    ],
    business: [
      { height: 'Up to 10.0 M. for land area up to 500.0 sq. M.',  front: '2.0 M.', side1: '1.2 M.', side2: '4.0 M.', rear: '4.0 M.' },
      { height: 'Up to 10.0 M. for land area above 500.0 sq. M.',  front: '3.0 M.', side1: '3.5 M.', side2: '4.0 M.', rear: '4.0 M.' },
      { height: 'Above 10.0 M. up to 21.5 M.',  front: '4.0 M.', side1: '4.0 M.', side2: '4.0 M.', rear: '5.0 M.' },
      { height: 'Above 21.5 M. up to 25.5 M.',  front: '5.0 M.', side1: '5.0 M.', side2: '5.0 M.', rear: '6.0 M.' },
      { height: 'Above 25.5 M. up to 40.0 M.',  front: '6.0 M.', side1: '6.5 M.', side2: '6.5 M.', rear: '9.0 M.' },
      { height: 'Above 40.0 M. up to 60.0 M.',  front: '8.0 M.', side1: '9.0 M.', side2: '9.0 M.', rear: '10.0 M.' },
      { height: 'Above 60.0 M. up to 80.0 M.',  front: '10.0 M.', side1: '15% of the height of building or 11.0 M., whichever is less', side2: '15% of the height of building or 11.0 M., whichever is less', rear: '12.0 M.' },
      { height: 'Above 80.0 M.',                 front: '12.0 M.', side1: '15% of the height of building or 14.0 M., whichever is less', side2: '15% of the height of building or 14.0 M., whichever is less', rear: '14.0 M.' },
    ],
    Mercantile_retail: [
      { height: 'Up to 10.0 M. for land area up to 500.0 sq. M.',  front: '2.0 M.', side1: '1.2 M.', side2: '4.0 M.', rear: '4.0 M.' },
      { height: 'Up to 10.0 M. for land area above 500.0 sq. M.',  front: '3.0 M.', side1: '3.5 M.', side2: '4.0 M.', rear: '4.0 M.' },
      { height: 'Above 10.0 M. up to 21.5 M.',  front: '4.0 M.', side1: '4.0 M.', side2: '4.0 M.', rear: '5.0 M.' },
      { height: 'Above 21.5 M. up to 25.5 M.',  front: '5.0 M.', side1: '5.0 M.', side2: '5.0 M.', rear: '6.0 M.' },
      { height: 'Above 25.5 M. up to 40.0 M.',  front: '6.0 M.', side1: '6.5 M.', side2: '6.5 M.', rear: '9.0 M.' },
      { height: 'Above 40.0 M. up to 60.0 M.',  front: '8.0 M.', side1: '9.0 M.', side2: '9.0 M.', rear: '10.0 M.' },
      { height: 'Above 60.0 M. up to 80.0 M.',  front: '10.0 M.', side1: '15% of the height of building or 11.0 M., whichever is less', side2: '15% of the height of building or 11.0 M., whichever is less', rear: '12.0 M.' },
      { height: 'Above 80.0 M.',                 front: '12.0 M.', side1: '15% of the height of building or 14.0 M., whichever is less', side2: '15% of the height of building or 14.0 M., whichever is less', rear: '14.0 M.' },
    ],
    Mercantile_wholesale: [
      { height: 'Up to 10.0 M. for land area up to 500.0 sq. M.',  front: '2.0 M.', side1: '1.2 M.', side2: '4.0 M.', rear: '4.0 M.' },
      { height: 'Up to 10.0 M. for land area above 500.0 sq. M.',  front: '3.0 M.', side1: '3.5 M.', side2: '4.0 M.', rear: '4.0 M.' },
      { height: 'Above 10.0 M. up to 21.5 M.',  front: '4.0 M.', side1: '4.0 M.', side2: '4.0 M.', rear: '5.0 M.' },
      { height: 'Above 21.5 M. up to 25.5 M.',  front: '5.0 M.', side1: '5.0 M.', side2: '5.0 M.', rear: '6.0 M.' },
      { height: 'Above 25.5 M. up to 40.0 M.',  front: '6.0 M.', side1: '6.5 M.', side2: '6.5 M.', rear: '9.0 M.' },
      { height: 'Above 40.0 M. up to 60.0 M.',  front: '8.0 M.', side1: '9.0 M.', side2: '9.0 M.', rear: '10.0 M.' },
      { height: 'Above 60.0 M. up to 80.0 M.',  front: '10.0 M.', side1: '15% of the height of building or 11.0 M., whichever is less', side2: '15% of the height of building or 11.0 M., whichever is less', rear: '12.0 M.' },
      { height: 'Above 80.0 M.',                 front: '12.0 M.', side1: '15% of the height of building or 14.0 M., whichever is less', side2: '15% of the height of building or 14.0 M., whichever is less', rear: '14.0 M.' },
    ],
    industrial: [
      { height: 'Up to 10.0 M.',          front: '12.5 M.', side1: '5.0 M.', side2: '4.0 M.',  rear: '4.0 M.' },
      { height: 'Above 10.0 M. up to 21.5 M.', front: '12.5 M.', side1: '6.0 M.', side2: '6.5 M.', rear: '10.0 M.' },
      { height: 'Above 21.5 M.', front: '20% of the height of building or 6 M., whichever is more', side1: '20% of the height of building or 6.5 M., whichever is more', side2: '20% of the height of building or 6.5 M., whichever is more', rear: '20% of the height of building or 10.0 M., whichever is more' },
    ],
    Storage: [
      { height: 'Up to 10.0 M.',          front: '12.5 M.', side1: '5.0 M.', side2: '4.0 M.',  rear: '4.0 M.' },
      { height: 'Above 10.0 M. up to 21.5 M.', front: '12.5 M.', side1: '6.0 M.', side2: '6.5 M.', rear: '10.0 M.' },
      { height: 'Above 21.5 M.', front: '20% of the height of building or 6 M., whichever is more', side1: '20% of the height of building or 6.5 M., whichever is more', side2: '20% of the height of building or 6.5 M., whichever is more', rear: '20% of the height of building or 10.0 M., whichever is more' },
    ],
    Hazardous: [
      { height: 'Up to 10.0 M.',          front: '12.5 M.', side1: '5.0 M.', side2: '4.0 M.',  rear: '4.0 M.' },
      { height: 'Above 10.0 M. up to 21.5 M.', front: '12.5 M.', side1: '6.0 M.', side2: '6.5 M.', rear: '10.0 M.' },
      { height: 'Above 21.5 M.', front: '20% of the height of building or 6 M., whichever is more', side1: '20% of the height of building or 6.5 M., whichever is more', side2: '20% of the height of building or 6.5 M., whichever is more', rear: '20% of the height of building or 10.0 M., whichever is more' },
    ],
  };

  function extractOpenSpaces() {
    const useGroup      = document.getElementById('usegroup')?.textContent.toLocaleLowerCase();
    const buildingHeight = parseFloat(document.getElementById('pro-height')?.textContent.replace(/[^\d.]/g, ''));
    const landArea       = parseFloat(document.getElementById('land-area')?.textContent.replace(/[^\d.]/g, ''));

    const categoryData = minimumOpenSpaces[useGroup] || minimumOpenSpaces[
      Object.keys(minimumOpenSpaces).find(k => k.toLowerCase() === useGroup)
    ];
    if (!categoryData) { console.warn('No open-space data for use group:', useGroup); return; }

    const openSpaceData = categoryData.find(entry => {
      const m = entry.height.match(/(Up to|Above)? ?(\d*\.?\d+) ?M\.( up to (\d*\.?\d+) ?M\.)?/);
      if (!m) return false;
      let minH = 0, maxH = Infinity;
      if (m[1] === 'Up to') maxH = parseFloat(m[2]);
      else if (m[1] === 'Above') minH = parseFloat(m[2]);
      if (m[4]) maxH = parseFloat(m[4]);
      return buildingHeight > minH && buildingHeight <= maxH;
    });

    if (!openSpaceData) { console.warn('No matching open-space entry found.'); return; }

    let side1Val = openSpaceData.side1, side2Val = openSpaceData.side2;
    if (buildingHeight > 80) {
      side1Val = side2Val = Math.min(buildingHeight * 0.15, 14.0).toFixed(2) + ' m';
    } else if (buildingHeight > 60) {
      side1Val = side2Val = Math.min(buildingHeight * 0.15, 11.0).toFixed(2) + ' m';
    }

    const fEl  = document.getElementById('per-front');
    const s1El = document.getElementById('per-side1');
    const s2El = document.getElementById('per-side2');
    const rEl  = document.getElementById('per-rear');
    if (fEl)  fEl.innerText  = openSpaceData.front;
    if (s1El) s1El.innerText = side1Val;
    if (s2El) s2El.innerText = side2Val;
    if (rEl)  rEl.innerText  = openSpaceData.rear;
  }

  /* ────────────────────────────────────────
     Compare — red highlights
  ──────────────────────────────────────── */
  function Compare() {
    function num(id) { return parseFloat(document.getElementById(id)?.textContent.replace(/[^0-9.]/g, '')) || 0; }
    function el(id)  { return document.getElementById(id); }

    const permFAR  = num('per-far'),  propFAR  = num('pro-far');
    const permTree = num('per-tree'), propTree = num('pro-tree');
    const permCB   = num('per-cb'),   propCB   = num('pro-cb');
    const reqCar   = num('per-car'),  propCar  = num('pro-car');

    if (!isNaN(permFAR) && !isNaN(propFAR))
      propFAR > permFAR ? el('pro-far')?.classList.add('text-red')  : el('pro-far')?.classList.remove('text-red');
    if (!isNaN(permTree) && !isNaN(propTree))
      propTree < permTree ? el('pro-tree')?.classList.add('text-red') : el('pro-tree')?.classList.remove('text-red');
    if (!isNaN(permCB) && !isNaN(propCB))
      propCB > permCB ? el('pro-cb')?.classList.add('text-red') : el('pro-cb')?.classList.remove('text-red');
    if (!isNaN(reqCar) && !isNaN(propCar))
      propCar < reqCar ? el('pro-car')?.classList.add('text-red') : el('pro-car')?.classList.remove('text-red');

    // Open Spaces comparison
    [['per-front','pro-front'],['per-side1','pro-side1'],['per-side2','pro-side2'],['per-rear','pro-rear']].forEach(([permId, propId]) => {
      const perm = parseFloat(document.getElementById(permId)?.textContent) || 0;
      const prop = parseFloat(document.getElementById(propId)?.textContent) || 0;
      perm > prop ? document.getElementById(propId)?.classList.add('text-red') : document.getElementById(propId)?.classList.remove('text-red');
    });
  }

  /* ────────────────────────────────────────
     Update popup wiring
  ──────────────────────────────────────── */
  const confirmBtn = document.getElementById('master-update-confirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      const landAreaDoc = parseFloat(document.getElementById('manual-land-area')?.value);
      const far         = parseFloat(document.getElementById('manual-far')?.value);
      const park        = parseFloat(document.getElementById('manual-parking-area')?.value);

      if (!isNaN(landAreaDoc)) {
        const el = document.getElementById('land-area-doc');
        if (el) el.textContent = formatNumber(landAreaDoc.toFixed(3)) + ' Sq.m.';
        calculateGroundCoverage();
      }
      if (!isNaN(far)) {
        const el = document.getElementById('per-far');
        if (el) el.textContent = formatNumber(far.toFixed(3));
      }
      if (!isNaN(park)) {
        const el = document.getElementById('per-park-area');
        if (el) el.textContent = formatNumber(park.toFixed(3)) + ' Sq.m.';
        localStorage.setItem('totalParkingArea', park);
      }

      calculateProposedFAR();
      Compare();
      const popup = document.getElementById('master-popup');
      if (popup) popup.style.display = 'none';
    });
  }

  /* ────────────────────────────────────────
     Car parking totals
  ──────────────────────────────────────── */
  function loadParkingTotals() {
    const totalParkingRequired = parseInt(localStorage.getItem('totalParkingRequired')) || 0;
    const totalReqCarParking   = parseInt(localStorage.getItem('totalReqCarParking'))   || 0;
    const totalSum = totalParkingRequired + totalReqCarParking;
    const sumCell  = document.getElementById('per-car');
    if (sumCell) sumCell.textContent = totalSum;

    const totalParkingNos  = localStorage.getItem('totalParkingNos');
    const totalParkingArea = localStorage.getItem('totalParkingArea');
    if (totalParkingNos)  { const el = document.getElementById('pro-car');       if (el) el.textContent = totalParkingNos; }
    if (totalParkingArea) { const el = document.getElementById('per-park-area'); if (el) el.textContent = totalParkingArea + ' Sq.m.'; }
  }

  /* ────────────────────────────────────────
     Floor area totals
  ──────────────────────────────────────── */
  function loadFloorTotals() {
    const storedSum              = parseFloat(localStorage.getItem('layerSumTotal')) || 0;
    const effectiveFloorAreaSum  = parseFloat(localStorage.getItem('effectiveFloorAreaSum')) || 0;
    const treecoversum           = parseFloat(localStorage.getItem('treeCoverNetArea')) || 0;
    const cbloftsum              = parseFloat(localStorage.getItem('cbLoftNetArea')) || 0;

    const totalFloorEl = document.getElementById('total-floor');
    if (totalFloorEl) totalFloorEl.textContent = effectiveFloorAreaSum ? `${effectiveFloorAreaSum.toFixed(3)} Sq.m.` : '0 Sq.m.';

    const addFloorEl = document.getElementById('additional-floor');
    if (addFloorEl) addFloorEl.textContent = storedSum ? `${storedSum.toFixed(3)} Sq.m.` : '0 Sq.m.';

    const totalFeesArea = effectiveFloorAreaSum + storedSum;
    const feesEl = document.getElementById('total-fees-area');
    if (feesEl) feesEl.textContent = `${totalFeesArea.toFixed(3)} Sq.m.`;

    // CB-Loft
    if (cbloftsum) {
      const cbPct = (cbloftsum / totalFeesArea) * 100;
      const el = document.getElementById('pro-cb');
      if (el) el.textContent = `${cbloftsum.toFixed(3)} Sq.m. (${cbPct.toFixed(3)}%)`;
    }

    return { treecoversum, totalFeesArea };
  }

  /* ────────────────────────────────────────
     Use-group
  ──────────────────────────────────────── */
  function loadUseGroup() {
    const item = JSON.parse(localStorage.getItem('highestPercentageItem') || 'null');
    const el   = document.getElementById('usegroup');
    if (el) el.textContent = item ? item.layer : 'No data available';
  }

  /* ────────────────────────────────────────
     Main init — called on tab switch
  ──────────────────────────────────────── */
  window.initMasterTab = function () {
    const csv = localStorage.getItem('csvData');
    loadUseGroup();
    loadParkingTotals();
    const { treecoversum, totalFeesArea } = loadFloorTotals();

    if (csv) displayFilteredData(csv);

    calculateFAR();
    calculateGroundCoverage();
    calculateHeight();
    extractOpenSpaces();
    TreeCover();

    // Proposed Tree Cover
    const landAreaBoundary1 = parseFloat(document.getElementById('land-area-doc')?.textContent.replace(/,/g, '').split(' ')[0]);
    const propTreePct = (treecoversum / landAreaBoundary1) * 100;
    if (treecoversum) {
      const el = document.getElementById('pro-tree');
      if (el) el.textContent = `${treecoversum.toFixed(3)} Sq.m. (${propTreePct.toFixed(3)}%)`;
    }

    Compare();

    // Show update popup on first load so user can verify/override values
    const popup = document.getElementById('master-popup');
    if (popup) popup.style.display = 'flex';
  };

  // initMasterTab is called by kmc_core switchTab after script loads
  // (no immediate self-invocation — avoids double-run)

})(); // end initMaster
