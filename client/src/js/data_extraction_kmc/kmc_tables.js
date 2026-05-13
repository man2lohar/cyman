/* ══════════════════════════════════════════
   kmc_tables.js  —  Layer Tables tab logic
   Lazy-loaded on first click of Layer Tables tab.
   Exposes: window.initLayerTables()
            window.generateTables()   (called by Refresh button)
══════════════════════════════════════════ */

/* ────────────────────────────────────────
   Generate all per-layer tables
   from csvData in localStorage.
──────────────────────────────────────── */
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

  const headers       = rows[0].split(',');
  const categoryIndex = 3;  // 4th column groups rows by layer/category
  const categories    = {};

  rows.slice(1).forEach(row => {
    const cells    = row.split(',');
    const category = cells[categoryIndex] || '(none)';
    if (!categories[category]) categories[category] = [];
    categories[category].push(cells);
  });

  Object.keys(categories).sort().forEach(category => {
    /* ── Section title ── */
    const title = document.createElement('h2');
    title.textContent = category;
    title.style.cssText = [
      'font-family:var(--font-mono)',
      'font-size:.85rem',
      'font-weight:700',
      'text-transform:uppercase',
      'letter-spacing:.08em',
      'color:var(--accent)',
      'margin:28px 0 10px',
      'padding:8px 14px',
      'background:rgba(212,80,26,.06)',
      'border-left:3px solid var(--accent)',
      'border-radius:0 6px 6px 0',
    ].join(';');
    container.appendChild(title);

    /* ── Table ── */
    const wrap  = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.style.marginBottom = '10px';

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Header row
    const headerRow = document.createElement('tr');
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h.trim();
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Data rows
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

/* ────────────────────────────────────────
   Init — called by kmc_core.js switchTab
   after this file is first loaded.
──────────────────────────────────────── */
window.initLayerTables = function () {
  generateTables();
};

// Run immediately if tab is already active on load
// (shouldn't normally happen, but safe to include)
(function () {
  const sec = document.getElementById('section-tables');
  if (sec && sec.classList.contains('active')) generateTables();
})();
