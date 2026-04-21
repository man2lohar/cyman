/* ══════════════════════════════════════════
   kmc_occupancy.js  —  Occupancy tab logic
   Lazy-loaded on first click of the Occupancy tab.
   Handles:
   • Parsing CSV data from localStorage
   • Building the Occupancy table
   • Storing highest-percentage item for Master tab
   • "Proceed to Final Summary" button logic
   • Custom alert modal
══════════════════════════════════════════ */

(function initOccupancy() {

  const MAIN_TABLE_LAYERS = [
    'Residential', 'Mercantile_wholesale', 'Mercantile_retail', 'Business',
    'Institutional', 'Storage', 'Assembly', 'Hazardous', 'Industrial', 'Educational'
  ];

  /* ── DOM refs ── */
  const tableBody   = document.querySelector('#occ-table tbody');
  const totalFloorEl   = document.getElementById('occ-total-floor-area');
  const totalDeductEl  = document.getElementById('occ-total-deducted-area');
  const totalNetEl     = document.getElementById('occ-total-net-area');
  const alertModal  = document.getElementById('occ-alert-modal');
  const alertMsg    = document.getElementById('occ-alert-message');
  const alertClose  = document.getElementById('occ-alert-close');

  /* ── Alert helpers ── */
  function showAlert(msg) {
    alertMsg.textContent = msg;
    alertModal.style.display = 'flex';
  }

  if (alertClose) {
    alertClose.addEventListener('click', () => {
      alertModal.style.display = 'none';
    });
  }

  /* ── CSV helpers (same logic as original occupancy.js) ── */
  function parseCSVToArray(csv) {
    const rows = csv.split('\n');
    const data = [];
    rows.forEach((row, index) => {
      if (index !== 0 && row.trim() !== '') {
        const cells = row.split(',');
        data.push({
          column4: cells[3],  // Layer
          column6: cells[5],  // Linetype
          column8: parseFloat(cells[7]) || 0  // Area
        });
      }
    });
    return data;
  }

  function calculateTotalFloorArea(layerName, parsedData) {
    return parsedData
      .filter(d => d.column4 === layerName && d.column6 === 'ByLayer')
      .reduce((sum, d) => sum + d.column8, 0);
  }

  function calculateDeductedArea(layerName, parsedData) {
    return parsedData
      .filter(d => d.column4 === layerName && d.column6 === 'DASHED')
      .reduce((sum, d) => sum + d.column8, 0);
  }

  function formatNumber(value) {
    const n = parseFloat(value);
    return isNaN(n) ? '0.000' : n.toFixed(3);
  }

  /* ── Main render function ── */
  function renderOccupancy(csv) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const parsedData = parseCSVToArray(csv);

    // Collect unique layers that match the occupancy list
    const seen = new Set();
    const rows = csv.split('\n');
    const tableData = [];

    rows.forEach((row, index) => {
      if (index === 0 || row.trim() === '') return;
      const cells = row.split(',');
      const layer = cells[3];
      if (MAIN_TABLE_LAYERS.includes(layer) && !seen.has(layer)) {
        seen.add(layer);
        const totalFloor  = calculateTotalFloorArea(layer, parsedData);
        const deducted    = calculateDeductedArea(layer, parsedData);
        const net         = totalFloor - deducted;
        tableData.push({ layer, totalFloor, deducted, net });
      }
    });

    if (tableData.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px;">No occupancy data found in uploaded file.</td></tr>';
      totalFloorEl && (totalFloorEl.textContent = '0.000');
      totalDeductEl && (totalDeductEl.textContent = '0.000');
      totalNetEl && (totalNetEl.textContent = '0.000');
      return;
    }

    let sumFloor = 0, sumDeduct = 0, sumNet = 0;
    tableData.forEach(d => { sumFloor += d.totalFloor; sumDeduct += d.deducted; sumNet += d.net; });

    tableData.forEach(d => {
      const pct = sumNet > 0 ? ((d.net / sumNet) * 100).toFixed(2) + '%' : '0.00%';
      const tr = tableBody.insertRow();
      tr.insertCell().textContent = d.layer;
      tr.insertCell().textContent = formatNumber(d.totalFloor);
      tr.insertCell().textContent = formatNumber(d.deducted);
      tr.insertCell().textContent = formatNumber(d.net);
      tr.insertCell().textContent = pct;
    });

    // Totals
    if (totalFloorEl)  totalFloorEl.textContent  = formatNumber(sumFloor);
    if (totalDeductEl) totalDeductEl.textContent = formatNumber(sumDeduct);
    if (totalNetEl)    totalNetEl.textContent    = formatNumber(sumNet);

    // Store for Master tab
    localStorage.setItem('mainTableData', JSON.stringify(
      tableData.map(d => ({ column4: d.layer, totalFloorArea: d.totalFloor, deductedArea: d.deducted, netArea: d.net }))
    ));
  }

  /* ── getHighestPercentageItem (needed for proceedToMaster) ── */
  function getHighestPercentageItem() {
    const data = JSON.parse(localStorage.getItem('mainTableData') || 'null');
    if (!data || data.length === 0) return null;
    const totalNet = data.reduce((s, d) => s + d.netArea, 0);
    let best = null, bestPct = -1;
    data.forEach(d => {
      const pct = parseFloat(((d.netArea / totalNet) * 100).toFixed(2));
      if (pct > bestPct) { bestPct = pct; best = { layer: d.column4, percentage: pct.toFixed(2) }; }
    });
    return best;
  }

  /* ── Expose globally for the Proceed button (called from HTML onclick) ── */
  window.proceedToMaster = function () {
    const item = getHighestPercentageItem();
    if (!item) {
      showAlert('No data available to determine any use-group of the building.');
      return;
    }
    localStorage.setItem('highestPercentageItem', JSON.stringify(item));
    if (typeof switchTab === 'function') switchTab('section-master');
  };

  /* ── Expose init so Refresh button and tab switcher can call it ── */
  window.initOccupancy = function () {
    const csv = localStorage.getItem('csvData');
    if (!csv) {
      if (tableBody) tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px;">No file loaded. Please upload a file first.</td></tr>';
      return;
    }
    renderOccupancy(csv);
  };

  // Run immediately on load
  window.initOccupancy();

})(); // end initOccupancy
