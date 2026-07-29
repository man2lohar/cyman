/* ══════════════════════════════════════════
   kmc_master_multi.js  —  Final Summary for multi-block
   
   Rules:
   • Ground Coverage  → SUM all blocks (colour 53+i per block)
   • Height           → MAX across all blocks; per-block breakdown table injected
   • Open Spaces      → per-block table, each block has its own Required/Proposed
══════════════════════════════════════════ */

(function initMasterMulti() {

  const LW_LIST = [
    '0.15 mm','0.20 mm','0.25 mm','0.30 mm','0.35 mm',
    '0.40 mm','0.50 mm','0.60 mm','0.70 mm','0.80 mm','0.90 mm',
  ];

  function _osLayer(n) {
    if (n >= 50) return 'Open Space_Ext_5';
    if (n >= 40) return 'Open Space_Ext_4';
    if (n >= 30) return 'Open Space_Ext_3';
    if (n >= 20) return 'Open Space_Ext_2';
    if (n >= 10) return 'Open Space_Ext_1';
    return 'Open Space';
  }
  function _htLayer(n) { return n > 24 ? 'Height_Ext_1' : 'Height'; }

  let ParkingAreaSum = 0;

  function fmt(v) {
    const n = parseFloat(v);
    return isNaN(n) ? v : n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }
  function set(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

  function parseCSV(csv) {
    return csv.split('\n').filter((r, i) => i !== 0 && r.trim()).map(row => {
      const c = row.split(',');
      return {
        name:       (c[1] || '').trim(),
        colour:     (c[2] || '').trim(),
        layer:      (c[3] || '').trim(),
        length:     parseFloat(c[4]) || 0,
        linetype:   (c[5] || '').trim(),
        lineweight: (c[6] || '').trim(),
        area:       parseFloat(c[7]) || 0,
        closed:     (c[8] || '').trim(),
        midX:       parseFloat(c[9]),
        midY:       parseFloat(c[10]),
        centerX:    parseFloat(c[11]),
        centerY:    parseFloat(c[12]),
      };
    });
  }

  /* ══════════════════════════════════════
     DISPLAY FILTERED DATA — multi-aware
  ══════════════════════════════════════ */
  function displayFilteredData(csv, blockLabels) {
    const blockCount = blockLabels.length;
    const osLayer    = _osLayer(blockCount);
    const htLayer    = _htLayer(blockCount);

    let RoadWidthSum = 0, landAreaSum = 0, GroundCoverageSum = 0;
    ParkingAreaSum = 0;

    const blockHeights = {};
    blockLabels.forEach(l => blockHeights[l] = 0);
    const blockOS = {};
    blockLabels.forEach(l => blockOS[l] = { front:0, rear:0, side1:0, side2:0 });

    /* ── GROUND COVERAGE: master sheet only ── */
    const masterCSVRaw = window.KMCMulti ? KMCMulti.getMasterCSV() : '';
    if (masterCSVRaw) {
      parseCSV(masterCSVRaw).forEach(r => {
        if (r.name === 'Polyline' && r.layer === 'Ground Coverage' && r.closed === '-1') {
          r.linetype === 'DASHED'
            ? (GroundCoverageSum -= r.area)
            : (GroundCoverageSum += r.area);
        }
      });
    }

    /* ── HEIGHT: each block sheet — block i uses LW_LIST[i] ── */
    blockLabels.forEach((lbl, i) => {
      const blkCSV = window.KMCMulti ? KMCMulti.getBlockCSV(lbl) : '';
      if (!blkCSV) return;
      const lw = LW_LIST[i];
      if (!lw) return;
      parseCSV(blkCSV).forEach(r => {
        if (r.name === 'Line' && r.layer === htLayer &&
            r.linetype === 'ByLayer' && r.lineweight === lw) {
          blockHeights[lbl] = Math.max(blockHeights[lbl], r.length);
        }
      });
    });

    /* ── OPEN SPACES: master sheet — colour per block per direction ── */
    if (masterCSVRaw) {
      parseCSV(masterCSVRaw).forEach(r => {
        if (r.name !== 'Line' || r.layer !== osLayer ||
            r.linetype !== 'ByLayer' || r.lineweight !== 'ByLayer') return;
        const c = parseInt(r.colour, 10);
        if (isNaN(c)) return;
        blockLabels.forEach((lbl, i) => {
          if (c === 53 + i) blockOS[lbl].front += r.length;
          if (c === 63 + i) blockOS[lbl].rear  += r.length;
          if (c === 73 + i) blockOS[lbl].side1 += r.length;
          if (c === 83 + i) blockOS[lbl].side2 += r.length;
        });
      });
    }

    /* ── ROAD WIDTH, PLOT, PARKING AREA: from combined CSV ── */
    parseCSV(csv).forEach(r => {
      if (r.name === 'Line' && r.colour === '230' && r.layer === 'Road' &&
          r.linetype === 'ByLayer' && r.lineweight === '0.15 mm')
        RoadWidthSum += r.length;

      if (r.name === 'Polyline' && r.colour === '240' && r.layer === 'Plot' &&
          r.linetype === 'PHANTOM2' && r.lineweight === '0.50 mm' && r.closed === '-1')
        landAreaSum += r.area;

      if (r.name === 'Polyline' && r.layer === 'Parking_Area' &&
          r.lineweight === '0.15 mm' && r.closed === '-1') {
        r.linetype === 'DASHED'
          ? (ParkingAreaSum -= r.area)
          : (ParkingAreaSum += r.area);
      }
    });

    const maxHeight = Math.max(...Object.values(blockHeights), 0);

    set('roadwidth',           fmt(RoadWidthSum) + ' M.');
    set('pro-height',          fmt(maxHeight) + ' M.');
    set('land-area',           fmt(landAreaSum.toFixed(3)) + ' Sq.m.');
    set('land-area-doc',       fmt(landAreaSum.toFixed(3)) + ' Sq.m.');
    set('pro-ground-coverage', fmt(GroundCoverageSum.toFixed(3)) + ' Sq.m.');
    set('pro-park-area',       fmt(ParkingAreaSum.toFixed(3)) + ' Sq.m.');

    calculateProposedFAR();
    _injectHeightTable(blockHeights, blockLabels);
    _injectOpenSpacesTable(blockOS, blockLabels, blockHeights);
  const _jopUseGroup = (document.getElementById('usegroup')?.textContent || '').toLowerCase();
    const _jopLandArea = parseFloat(document.getElementById('land-area')?.textContent.replace(/[^\d.]/g, '')) || 0;
    _injectJointOpenSpaceTable(masterCSVRaw, blockHeights, blockLabels, _jopUseGroup, _jopLandArea);

    return { blockHeights, maxHeight };
  }

  /* ══════════════════════════════════════
     Per-block HEIGHT breakdown table
     Injected after the Comparison Table card
  ══════════════════════════════════════ */
  function _injectHeightTable(blockHeights, blockLabels) {
    const existingId = 'mb-height-breakdown';
    let card = document.getElementById(existingId);
    if (!card) {
      card = document.createElement('div');
      card.id = existingId;
      card.className = 'data-card';
      card.style.marginBottom = '20px';
      /* Insert after comparison table card */
      const compCard = document.getElementById('master-table')?.closest('.data-card');
      if (compCard) compCard.after(card);
      else document.getElementById('section-master')?.appendChild(card);
    }

    card.innerHTML = `
      <div class="data-card-title">Height — Per Block</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Block</th><th>Lineweight Used</th><th>Proposed Height (M.)</th><th>Permissible Height</th><th>Status</th></tr></thead>
          <tbody id="mb-height-tbody"></tbody>
        </table>
      </div>`;

    const tbody = card.querySelector('#mb-height-tbody');
    const roadW = parseFloat(document.getElementById('roadwidth')?.textContent) || 0;

    blockLabels.forEach((lbl, i) => {
      const ht     = blockHeights[lbl] || 0;
      const lw     = LW_LIST[i] || '—';
      const permHt = _getPermissibleHeight(roadW);
      const over   = permHt !== null && isFinite(permHt) && ht > permHt;
      const permTxt= permHt === null ? '—' : isFinite(permHt) ? permHt.toFixed(2) + ' M.' : 'No limit';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>Block ${lbl}</strong></td>
        <td style="font-family:var(--font-mono);font-size:.8rem;">${lw}</td>
        <td>${fmt(ht)} M.</td>
        <td>${permTxt}</td>
        <td class="${over ? 'text-red' : 'text-green'}" style="font-weight:700;">
          ${over ? '✗ Exceeds' : '✔ OK'}
        </td>`;
      tbody.appendChild(tr);
    });
  }

  function _getPermissibleHeight(roadWidth) {
    const htTable = [
      { w: [2.4, 3.0],      h: 7.0   },
      { w: [3.0, 4.25],     h: 10.0  },
      { w: [4.25, 6.75],    h: 12.5  },
      { w: [6.75, 9.0],     h: 21.5  },
      { w: [9.0, 12.0],     h: 40.0  },
      { w: [12.0, 15.0],    h: 60.0  },
      { w: [15.0, Infinity], h: Infinity },
    ];
    for (const row of htTable) {
      if (roadWidth > row.w[0] && roadWidth <= row.w[1]) return row.h;
    }
    return null;
  }

  /* ══════════════════════════════════════
     Per-block OPEN SPACES table
     Replaces the static master-open-spaces table
  ══════════════════════════════════════ */
  function _injectOpenSpacesTable(blockOS, blockLabels, blockHeights) {
    const card = document.getElementById('master-open-spaces')?.closest('.data-card');
    if (!card) return;

    const title = card.querySelector('.data-card-title')?.textContent || 'Open Spaces';
    card.innerHTML = `<div class="data-card-title">${title} — Per Block</div>
      <div id="mb-os-blocks"></div>`;

    const container  = card.querySelector('#mb-os-blocks');
    const useGroup   = (document.getElementById('usegroup')?.textContent || '').toLowerCase();
    const landArea   = parseFloat(document.getElementById('land-area')?.textContent.replace(/[^\d.]/g, '')) || 0;

    blockLabels.forEach((lbl) => {
      const os      = blockOS[lbl] || { front:0, rear:0, side1:0, side2:0 };
      /* Use this block's own height for permissible lookup */
      const blockHt = blockHeights[lbl] || 0;
      const perm    = _getPermissibleOS(useGroup, blockHt, landArea);
      const drawnSides = [os.side1, os.side2].filter(v => v > 0);
      const minSide = drawnSides.length > 0 ? Math.min(...drawnSides) : 0;

      const blockCard = document.createElement('div');
      blockCard.style.cssText = 'margin-bottom:16px;';
      blockCard.innerHTML = `
        <div style="font-family:var(--font-mono);font-size:.75rem;font-weight:700;color:var(--accent);
                    text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;
                    padding:4px 10px;background:rgba(212,80,26,.06);
                    border-left:3px solid var(--accent);border-radius:0 4px 4px 0;">
          Block ${lbl} &nbsp;<span style="color:var(--muted);font-weight:400;">(Height: ${blockHt.toFixed(3)} M.)</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Open Space</th><th>Required</th><th>Proposed</th><th>Status</th>
            </tr></thead>
            <tbody>
              ${_osRow('Front',  perm.front,  os.front)}
              ${_osRow('Rear',   perm.rear,   os.rear)}
              ${_osRow('Side 1', perm.side1,  os.side1)}
              ${_osRow('Side 2', perm.side2,  os.side2)}
            </tbody>
          </table>
        </div>`;
      container.appendChild(blockCard);
    });
  }

  function _osRow(label, perm, prop, note = '') {
     const permNum = parseFloat(perm) || 0;
     const over    = permNum > 0 && prop > 0 && prop < permNum;
   
     const status = prop === 0
       ? '<span class="text-red" style="font-weight:700;">⚠ No data</span>'
       : over
         ? '<span class="text-red" style="font-weight:700;">✗ Short</span>'
         : '<span class="text-green" style="font-weight:700;">✔ OK</span>';
   
     return `<tr>
       <td class="head">${label}${note ? `<br><span style="font-size:.7rem;color:var(--muted);">${note}</span>` : ''}</td>
       <td>${perm}</td>
       <td>${prop > 0 ? prop.toFixed(3) + ' M.' : '0.000 M.'}</td>
       <td>${status}</td>
     </tr>`;
   }

  function _getPermissibleOS(useGroup, buildingHeight, landArea) {
    const data = minimumOpenSpaces[useGroup] ||
      minimumOpenSpaces[Object.keys(minimumOpenSpaces).find(k => k.toLowerCase() === useGroup)];
    const fallback = { front: '—', side1: '—', side2: '—', rear: '—' };
    if (!data) return fallback;

    const entry = data.find(e => {
      const m = e.height.match(/(Up to|Above)? ?(\d*\.?\d+) ?M\.( up to (\d*\.?\d+) ?M\.)?/);
      if (!m) return false;
      let minH = 0, maxH = Infinity;
      if (m[1] === 'Up to') maxH = parseFloat(m[2]);
      else if (m[1] === 'Above') minH = parseFloat(m[2]);
      if (m[4]) maxH = parseFloat(m[4]);
      return buildingHeight > minH && buildingHeight <= maxH;
    });
    if (!entry) return fallback;

    let s1 = entry.side1, s2 = entry.side2;
    if (buildingHeight > 80)      { s1 = s2 = Math.min(buildingHeight * 0.15, 14.0).toFixed(2) + ' M.'; }
    else if (buildingHeight > 60) { s1 = s2 = Math.min(buildingHeight * 0.15, 11.0).toFixed(2) + ' M.'; }
    return { front: entry.front, side1: s1, side2: s2, rear: entry.rear };
  }

/* ══════════════════════════════════════
     JOINT OPEN SPACE  (KMC Rule 66)
     Layer "Joint Open Space" on the MASTER sheet.
     Colour    → direction: North=13  South=23  East=33  West=43
     Lineweight→ JOP pair#: 0.15=1 0.20=2 0.25=3 0.30=4 0.35=5
                            0.40=6 0.50=7 0.60=8 0.70=9 0.90=10
     Pair convention: JOP1=A&B, JOP2=A&C, JOP3=A&D ... (lexicographic
     block order), capped at 10 pairs — only 10 lineweights available.
  ══════════════════════════════════════ */
  const _JOP_LW_LIST = [
    '0.15 mm','0.20 mm','0.25 mm','0.30 mm','0.35 mm',
    '0.40 mm','0.50 mm','0.60 mm','0.70 mm','0.90 mm',
  ]; // index 0 = JOP1 ... index 9 = JOP10 (note: skips 0.80mm on purpose)

  const _JOP_COLOUR_DIR = { 13:'North', 23:'South', 33:'East', 43:'West' };

  /* Default assumption: which compass direction = which relative side of
     a block, used to fetch the taller block's own mandatory open space
     for Rule 66's "OR mandatory open space of higher block" clause.
     Change this mapping if your standard plot orientation differs. */
  const _JOP_DIR_TO_OS_SIDE = { North:'front', South:'rear', East:'side1', West:'side2' };

  function _jopPairs(blockLabels) {
    const pairs = [];
    for (let i = 0; i < blockLabels.length; i++) {
      for (let j = i + 1; j < blockLabels.length; j++) {
        pairs.push([blockLabels[i], blockLabels[j]]);
        if (pairs.length >= 10) return pairs;
      }
    }
    return pairs;
  }

  /* Each block's Ground Coverage centroid, from colour 53+i (A=53,B=54,C=55...) */
  function _blockGCCentroids(masterCSVRaw, blockLabels) {
    const centroids = {};
    blockLabels.forEach((lbl, i) => {
      const colour = 53 + i;
      let sx = 0, sy = 0, n = 0;
      if (masterCSVRaw) {
        parseCSV(masterCSVRaw).forEach(r => {
          if (r.name === 'Polyline' && r.layer === 'Ground Coverage' &&
              parseInt(r.colour, 10) === colour && r.closed === '-1' &&
              !isNaN(r.centerX) && !isNaN(r.centerY)) {
            sx += r.centerX; sy += r.centerY; n++;
          }
        });
      }
      if (n > 0) centroids[lbl] = { x: sx / n, y: sy / n };
    });
    return centroids;
  }

  /* Nearest 2 block centroids to a Joint Open Space line's midpoint
     = the 2 blocks that line sits between */
  function _nearestBlockPair(midX, midY, centroids) {
    const dists = Object.keys(centroids).map(lbl => {
      const c = centroids[lbl];
      return { lbl, d: Math.hypot(c.x - midX, c.y - midY) };
    }).sort((a, b) => a.d - b.d);
    if (dists.length < 2) return null;
    return [dists[0].lbl, dists[1].lbl].sort();
  }

  /* Returns { "A|B": {North,South,East,West}, "A|C": {...} } — only pairs
     that actually have a drawn line get an entry (B|C simply never appears
     if you never drew a line near both B and C's ground coverage) */
  function _extractJointOpenSpace(masterCSVRaw, blockLabels) {
    const centroids = _blockGCCentroids(masterCSVRaw, blockLabels);
    const result = {};
    if (!masterCSVRaw) return result;
    parseCSV(masterCSVRaw).forEach(r => {
      if (r.name !== 'Line' || r.layer !== 'Joint Open Space' ||
          r.linetype !== 'ByLayer') return;
      const dir = _JOP_COLOUR_DIR[parseInt(r.colour, 10)];
      if (!dir) return;
      if (isNaN(r.midX) || isNaN(r.midY)) return;
      const pair = _nearestBlockPair(r.midX, r.midY, centroids);
      if (!pair) return;
      const key = pair.join('|');
      if (!result[key]) result[key] = { North:0, South:0, East:0, West:0 };
      result[key][dir] += r.length;
    });
    return result;
  }

  /* Rule 66 calculator. heightA/heightB = the pair's block heights.
     mandatoryOSofHigher = taller block's own mandatory OS (M.) for that side. */
  function _getJOPPermissible(heightA, heightB, mandatoryOSofHigher) {
    const heightLow  = Math.min(heightA, heightB);
    const heightHigh = Math.max(heightA, heightB);

    if (heightLow <= 5.0) return { applicable:false };            // Clause (3)

    if (heightLow > 15.5 && heightHigh > 15.5) {                  // Clause (1)
      const req = Math.max(0.15 * heightLow, mandatoryOSofHigher, 7.0);
      return { applicable:true, required: Math.min(req, 15.0) };
    }

    if (heightHigh > 15.5) {                                      // Clause (2)
      let floor;
      if      (heightLow > 12.5) floor = 5.0;
      else if (heightLow > 10.0) floor = 4.0;
      else if (heightLow > 7.0)  floor = 3.5;
      else                       floor = 3.0;
      const req = Math.max(0.15 * heightLow, mandatoryOSofHigher, floor);
      return { applicable:true, required: Math.min(req, 15.0) };
    }

    return { applicable:false };  // neither block exceeds 15.50 M.
  }

  function _injectJointOpenSpaceTable(masterCSVRaw, blockHeights, blockLabels, useGroup, landArea) {
    const tbody = document.getElementById('mb-jop-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const jopData   = _extractJointOpenSpace(masterCSVRaw, blockLabels); // "A|B" -> {N,S,E,W}
    const pairKeys  = Object.keys(jopData).sort();

    if (!pairKeys.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);">No "Joint Open Space" lines found on the Master sheet.</td></tr>';
      return;
    }

    let anyRow = false, jopCounter = 0;

    pairKeys.forEach(key => {
      jopCounter++;
      const [lblA, lblB] = key.split('|');
      const hA = blockHeights[lblA] || 0;
      const hB = blockHeights[lblB] || 0;
      const higherOS = _getPermissibleOS(useGroup, Math.max(hA, hB), landArea);
      const proposed = jopData[key];

      ['North','South','East','West'].forEach(dir => {
        const mandatory = parseFloat(higherOS?.[_JOP_DIR_TO_OS_SIDE[dir]]) || 0;
        const calc      = _getJOPPermissible(hA, hB, mandatory);
        const prop      = proposed[dir] || 0;
        if (!calc.applicable && prop === 0) return;

        anyRow = true;
        const permTxt = calc.applicable ? calc.required.toFixed(3) + ' M.' : 'N/A';
        const status  = !calc.applicable
          ? '<span style="color:var(--muted);">—</span>'
          : prop === 0
            ? '<span class="text-red" style="font-weight:700;">⚠ No data</span>'
            : prop < calc.required
              ? '<span class="text-red" style="font-weight:700;">✗ Short</span>'
              : '<span class="text-green" style="font-weight:700;">✔ OK</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="head">JOP ${jopCounter}</td>
          <td>Block ${lblA} ↔ Block ${lblB}</td>
          <td>${dir}</td>
          <td>${permTxt}</td>
          <td>${prop > 0 ? prop.toFixed(3) + ' M.' : '0.000 M.'}</td>
          <td>${status}</td>`;
        tbody.appendChild(tr);
      });
    });

    if (!anyRow) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);">Rule 66 not triggered — no block pair exceeds 15.50 M.</td></tr>';
    }
  }
   
  /* ══════════════════════════════════════
     All the same helpers as kmc_master.js
  ══════════════════════════════════════ */
  const farTable = [
    { w: [0, 2.4],         res: 0,    edu: 0,    ind: 0,   sto: 0,   haz: 0,   asm: 0,    bus: 0,    ins: 0,    mr: 0,    mw: 0    },
    { w: [2.4, 3.5],       res: 1.5,  edu: 0,    ind: 0,   sto: 0,   haz: 0,   asm: 0,    bus: 0,    ins: 0,    mr: 0,    mw: 0    },
    { w: [3.5, 6.75],      res: 1.75, edu: 0,    ind: 0,   sto: 0,   haz: 0,   asm: 0,    bus: 0,    ins: 0,    mr: 0,    mw: 0    },
    { w: [6.75, 9.0],      res: 2.0,  edu: 2.0,  ind: 0,   sto: 0,   haz: 0,   asm: 0,    bus: 0,    ins: 0,    mr: 0,    mw: 0    },
    { w: [9.0, 15.0],      res: 2.25, edu: 2.25, ind: 2.0, sto: 2.0, haz: 2.0, asm: 2.0,  bus: 2.0,  ins: 2.0,  mr: 2.0,  mw: 2.0  },
    { w: [15.0, 21.5],     res: 2.5,  edu: 2.5,  ind: 2.0, sto: 2.0, haz: 2.0, asm: 2.25, bus: 2.25, ins: 2.25, mr: 2.25, mw: 2.25 },
    { w: [21.5, 24.0],     res: 2.75, edu: 2.75, ind: 2.0, sto: 2.0, haz: 2.0, asm: 2.5,  bus: 2.5,  ins: 2.5,  mr: 2.5,  mw: 2.5  },
    { w: [24.0, Infinity], res: 3.0,  edu: 3.0,  ind: 2.0, sto: 2.0, haz: 2.0, asm: 2.75, bus: 2.75, ins: 2.75, mr: 2.75, mw: 2.75 },
  ];
  const farKeyMap = {
    residential:'res', educational:'edu', industrial:'ind', storage:'sto',
    hazardous:'haz', assembly:'asm', business:'bus', institutional:'ins',
    mercantile_retail:'mr', mercantile_wholesale:'mw',
  };

  function calculateFAR() {
    const width  = parseFloat(document.getElementById('roadwidth')?.textContent);
    const type   = (document.getElementById('usegroup')?.textContent || '').toLowerCase();
    const permEl = document.getElementById('per-far');
    if (!permEl) return;
    if (isNaN(width) || width === 0) { permEl.textContent = 'No width of access'; permEl.classList.add('text-red'); return; }
    const key = farKeyMap[type];
    let farVal = null;
    for (const row of farTable) {
      if (width > row.w[0] && width <= row.w[1]) { farVal = key ? row[key] : null; break; }
    }
    permEl.textContent = farVal !== null ? farVal : '';
    Compare();
  }

  function calculateProposedFAR() {
    const landArea    = parseFloat(document.getElementById('land-area')?.textContent.replace(/,/g, '')) || 0;
    const landDoc     = parseFloat(document.getElementById('land-area-doc')?.textContent.replace(/,/g, '')) || 0;
    const actualBonus = parseFloat(localStorage.getItem('totalParkingArea')) || 0;   // Actual Bonus car parking area
    const netFloor    = parseFloat(localStorage.getItem('netFloorAreaSum')) || 0;
    const minLand     = Math.min(landArea, landDoc);
    if (minLand > 0) {
      const netPark  = Math.min(ParkingAreaSum, actualBonus); // min of Proposed & Actual Bonus
      const el = document.getElementById('pro-far');
      if (el) el.textContent = ((netFloor - netPark) / minLand).toFixed(3);
    }
  }

   window.showFarCalcPopup = function () {
    const landArea    = parseFloat(document.getElementById('land-area')?.textContent.replace(/,/g, '')) || 0;
    const landDoc     = parseFloat(document.getElementById('land-area-doc')?.textContent.replace(/,/g, '')) || 0;
    const actualBonus = parseFloat(localStorage.getItem('totalParkingArea')) || 0;
    const netFloor    = parseFloat(localStorage.getItem('netFloorAreaSum')) || 0;
    const minLand     = Math.min(landArea, landDoc);
    const netPark     = Math.min(ParkingAreaSum, actualBonus);
    const proFar      = minLand > 0 ? (netFloor - netPark) / minLand : 0;

    const rows = [
      ['Land Area as per Boundary Declaration', `${landArea.toFixed(3)} Sq.m.`],
      ['Land Area as per Document (min.)',      `${landDoc.toFixed(3)} Sq.m.`],
      ['→ Min. Land Area used',                 `${minLand.toFixed(3)} Sq.m.`],
      ['Net Floor Area (Floor Area table)',     `${netFloor.toFixed(3)} Sq.m.`],
      ['Proposed Car Parking Area',             `${ParkingAreaSum.toFixed(3)} Sq.m.`],
      ['Actual Bonus Car Parking Area',         `${actualBonus.toFixed(3)} Sq.m.`],
      ['→ Net Parking Deduction = min(Proposed, Actual Bonus)', `${netPark.toFixed(3)} Sq.m.`],
      ['Formula',      '(Net Floor Area − Net Parking Deduction) / Min. Land Area'],
      ['Calculation',  `(${netFloor.toFixed(3)} − ${netPark.toFixed(3)}) / ${minLand.toFixed(3)}`],
      ['Proposed F.A.R.', proFar.toFixed(3)],
    ];

    const tbody = document.getElementById('far-calc-steps');
    if (tbody) {
      tbody.innerHTML = rows.map(([label, val], i) => {
        const isResult = i === rows.length - 1;
        return `<tr style="${isResult ? 'font-weight:700;border-top:2px solid var(--accent);' : 'border-bottom:1px solid var(--border);'}">
          <td style="padding:7px 8px;">${label}</td>
          <td style="padding:7px 8px;text-align:right;">${val}</td>
        </tr>`;
      }).join('');
    }

    const popup = document.getElementById('far-calc-popup');
    if (popup) popup.style.display = 'flex';
  };

  function calculateGroundCoverage() {
    const landArea   = parseFloat(document.getElementById('land-area')?.textContent.replace(/,/g, '').split(' ')[0]);
    const landDoc    = parseFloat(document.getElementById('land-area-doc')?.textContent.replace(/,/g, '').split(' ')[0]);
    const proposedGC = parseFloat(document.getElementById('pro-ground-coverage')?.textContent.replace(/,/g, '').split(' ')[0]);
    const type       = (document.getElementById('usegroup')?.textContent || '').toLowerCase();
    const minLand    = Math.min(landArea, landDoc);
    const gcTable = {
      residential:         { upTo500: 60, above500: 50, above5000: 50 },
      educational:         { upTo500: 50, above500: 50, above5000: 50 },
      institutional:       { upTo500: 50, above500: 50, above5000: 50 },
      assembly:            { upTo500: 50, above500: 50, above5000: 50 },
      mercantile_retail:   { upTo500: 50, above500: 50, above5000: 50 },
      mercantile_wholesale:{ upTo500: 50, above500: 50, above5000: 50 },
      industrial:          { upTo500: 50, above500: 50, above5000: 50 },
      storage:             { upTo500: 50, above500: 50, above5000: 50 },
      hazardous:           { upTo500: 50, above500: 50, above5000: 50 },
      business:            { upTo500: 50, above500: 50, above5000: 50 },
    };
    const t = gcTable[type] || gcTable.residential;
    const permPct  = minLand <= 500 ? t.upTo500 : minLand <= 5000 ? t.above500 : t.above5000;
    const permArea = (minLand * permPct) / 100;
    const propPct  = (proposedGC / minLand) * 100;
    const permEl = document.getElementById('per-ground-coverage');
    const propEl = document.getElementById('pro-ground-coverage');
    if (permEl) permEl.textContent = `${permArea.toFixed(3)} Sq. m. (${permPct.toFixed(3)}%)`;
    if (propEl) {
      propEl.textContent = `${proposedGC.toFixed(3)} Sq. m. (${propPct.toFixed(3)}%)`;
      propPct > permPct ? propEl.classList.add('text-red') : propEl.classList.remove('text-red');
    }
  }

  function calculateHeight() {
    /* For the comparison table permissible height — use max road width / tallest block */
    const width  = parseFloat(document.getElementById('roadwidth')?.textContent);
    const permEl = document.getElementById('per-height');
    if (!permEl) return;
    if (isNaN(width) || width === 0) { permEl.textContent = 'No width of access'; permEl.classList.add('text-red'); return; }
    const permHt = _getPermissibleHeight(width);
    permEl.textContent = permHt === null ? 'N/A' : isFinite(permHt) ? permHt.toFixed(2) + ' M.' : 'No limit';
    const propEl  = document.getElementById('pro-height');
    if (permEl.textContent === 'No limit') { propEl?.classList.remove('text-red'); return; }
    const propH = parseFloat(propEl?.textContent.replace(/[^\d.]/g, '')) || 0;
    const permH = parseFloat(permEl.textContent.replace(/[^\d.]/g, '')) || 0;
    propH > permH ? propEl?.classList.add('text-red') : propEl?.classList.remove('text-red');
  }

  function TreeCover() {
    const landArea  = parseFloat(document.getElementById('land-area')?.textContent.replace(/,/g,'').split(' ')[0]) || 0;
    const feesTotal = parseFloat(document.getElementById('total-fees-area')?.textContent.replace(/,/g,'').split(' ')[0]) || 0;
    const cbloft    = 0.03 * feesTotal;

    /* Required Tree Cover per spec:
       (i)  TFA >= 6000 sq.m  →  15% of land area
       (ii) TFA < 6000 sq.m   →  (TFA / 6000) × 15% of land area  (proportional) */
    const BASE_TFA     = 6000;
    const BASE_PCT     = 0.15;   // 15%
    const permPct      = feesTotal >= BASE_TFA
      ? BASE_PCT
      : (feesTotal / BASE_TFA) * BASE_PCT;
    const permTreeArea = permPct * landArea;
    const permPctDisp  = (permPct * 100).toFixed(3);

    set('per-tree', `${permTreeArea.toFixed(3)} Sq. m. (${permPctDisp}%)`);
    set('per-cb',   `${cbloft.toFixed(3)} Sq. m. (3.000%)`);
  }

  function Compare() {
    const num  = id => parseFloat(document.getElementById(id)?.textContent.replace(/[^0-9.]/g, '')) || 0;
    const flag = (id, over) => over
      ? document.getElementById(id)?.classList.add('text-red')
      : document.getElementById(id)?.classList.remove('text-red');
    flag('pro-far',  num('pro-far')  > num('per-far'));
    flag('pro-tree', num('pro-tree') < num('per-tree'));
    flag('pro-cb',   num('pro-cb')   > num('per-cb'));
    flag('pro-car',  num('pro-car')  < num('per-car'));
    flag('pro-height', num('pro-height') > num('per-height'));
  }

  function loadParkingTotals() {
     const req    = parseInt(localStorage.getItem('totalParkingRequired')) || 0;
     const reqCar = parseInt(localStorage.getItem('totalReqCarParking'))   || 0;
     set('per-car', req + reqCar);
     const nos  = localStorage.getItem('totalParkingNos');
     const area = localStorage.getItem('reqParkingArea');
     if (nos)  set('pro-car',       nos);
     if (area) set('per-park-area', area + ' Sq.m.');
   
     // Actual Bonus — pulled directly from the Provided Parking table (Parking tab)
     const actualNos  = localStorage.getItem('totalParkingNos');
     const actualArea = localStorage.getItem('totalParkingArea');
     if (actualNos)  set('act-car',       actualNos);
     if (actualArea) set('act-park-area', parseFloat(actualArea).toFixed(3) + ' Sq.m.');
   }

  function loadFloorTotals() {
    const layerSum = parseFloat(localStorage.getItem('layerSumTotal'))         || 0;
    const efa      = parseFloat(localStorage.getItem('effectiveFloorAreaSum')) || 0;
    const treecover= parseFloat(localStorage.getItem('treeCoverNetArea'))      || 0;
    const cbloft   = parseFloat(localStorage.getItem('cbLoftNetArea'))         || 0;
    set('total-floor',      efa      ? `${efa.toFixed(3)} Sq.m.`      : '0 Sq.m.');
    set('additional-floor', layerSum ? `${layerSum.toFixed(3)} Sq.m.` : '0 Sq.m.');
    const feesTotal = efa + layerSum;
    set('total-fees-area', `${feesTotal.toFixed(3)} Sq.m.`);
    if (cbloft) {
      const pct = (cbloft / feesTotal) * 100;
      set('pro-cb', `${cbloft.toFixed(3)} Sq.m. (${pct.toFixed(3)}%)`);
    }
    return { treecover, feesTotal };
  }

  function loadUseGroup() {
    const item = JSON.parse(localStorage.getItem('highestPercentageItem') || 'null');
    set('usegroup', item?.layer || 'No data available');
  }

  /* Update popup */
  const confirmBtn = document.getElementById('master-update-confirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      const landAreaDoc = parseFloat(document.getElementById('manual-land-area')?.value);
      const far         = parseFloat(document.getElementById('manual-far')?.value);
      const park        = parseFloat(document.getElementById('manual-parking-area')?.value);
      if (!isNaN(landAreaDoc)) {
        const e = document.getElementById('land-area-doc');
        if (e) e.textContent = fmt(landAreaDoc.toFixed(3)) + ' Sq.m.';
        calculateGroundCoverage();
      }
      if (!isNaN(far))  set('per-far', fmt(far.toFixed(3)));
      if (!isNaN(park)) {
        set('per-park-area', fmt(park.toFixed(3)) + ' Sq.m.');
        localStorage.setItem('totalParkingArea', park);
        localStorage.removeItem('reqParkingArea');
      }
      calculateProposedFAR();
      Compare();
      const popup = document.getElementById('master-popup');
      if (popup) popup.style.display = 'none';
    });
  }

  /* ── Open Spaces lookup table ── */
  const minimumOpenSpaces = {
    residential: [
      { height:'Up to 7.0 M.',                front:'1.2 M.', side1:'1.2 M.', side2:'1.2 M.', rear:'2.0 M.' },
      { height:'Above 7.0 M. up to 10.0 M.',  front:'1.2 M.', side1:'1.2 M.', side2:'1.2 M.', rear:'3.0 M.' },
      { height:'Above 10.0 M. up to 12.5 M.', front:'1.2 M.', side1:'1.2 M.', side2:'1.5 M.', rear:'3.0 M.' },
      { height:'Above 12.5 M. up to 15.5 M.', front:'2.0 M.', side1:'1.5 M.', side2:'2.5 M.', rear:'4.0 M.' },
      { height:'Above 15.5 M. up to 21.5 M.', front:'3.5 M.', side1:'4.0 M.', side2:'4.0 M.', rear:'5.0 M.' },
      { height:'Above 21.5 M. up to 25.5 M.', front:'5.0 M.', side1:'5.0 M.', side2:'5.0 M.', rear:'6.5 M.' },
      { height:'Above 25.5 M. up to 40.0 M.', front:'6.0 M.', side1:'6.5 M.', side2:'6.5 M.', rear:'8.5 M.' },
      { height:'Above 40.0 M. up to 60.0 M.', front:'8.0 M.', side1:'8.0 M.', side2:'8.0 M.', rear:'10.0 M.' },
      { height:'Above 60.0 M. up to 80.0 M.', front:'10.0 M.', side1:'15% of height or 11.0 M., whichever is less', side2:'15% of height or 11.0 M., whichever is less', rear:'12.0 M.' },
      { height:'Above 80.0 M.',                front:'12.0 M.', side1:'15% of height or 14.0 M., whichever is less', side2:'15% of height or 14.0 M., whichever is less', rear:'14.0 M.' },
    ],
    educational: [
      { height:'Up to 10.0 M. for land area up to 500.0 sq. M.',  front:'2.0 M.', side1:'1.8 M.', side2:'4.0 M.', rear:'3.5 M.' },
      { height:'Up to 10.0 M. for land area above 500.0 sq. M.',  front:'3.5 M.', side1:'3.5 M.', side2:'4.0 M.', rear:'4.0 M.' },
      { height:'Above 10.0 M. up to 15.5 M.', front:'3.5 M.', side1:'4.0 M.', side2:'4.0 M.', rear:'5.0 M.' },
      { height:'Above 15.5 M. up to 21.5 M.', front:'5.0 M.', side1:'5.0 M.', side2:'5.0 M.', rear:'6.0 M.' },
      { height:'Above 21.5 M.', front:'20% of height or 6 M., whichever is more', side1:'20% of height or 5 M., whichever is more', side2:'20% of height or 5 M., whichever is more', rear:'20% of height or 8 M., whichever is more' },
    ],
    institutional: [
      { height:'Up to 10.0 M. for land area up to 500.0 sq. M.',  front:'2.0 M.', side1:'1.2 M.', side2:'4.0 M.', rear:'4.0 M.' },
      { height:'Up to 10.0 M. for land area above 500.0 sq. M.',  front:'3.0 M.', side1:'3.5 M.', side2:'4.0 M.', rear:'4.0 M.' },
      { height:'Above 10.0 M. up to 21.5 M.',  front:'4.0 M.', side1:'4.0 M.', side2:'4.0 M.', rear:'5.0 M.' },
      { height:'Above 21.5 M. up to 25.5 M.',  front:'5.0 M.', side1:'5.0 M.', side2:'5.0 M.', rear:'6.0 M.' },
      { height:'Above 25.5 M. up to 40.0 M.',  front:'6.0 M.', side1:'6.5 M.', side2:'6.5 M.', rear:'9.0 M.' },
      { height:'Above 40.0 M. up to 60.0 M.',  front:'8.0 M.', side1:'9.0 M.', side2:'9.0 M.', rear:'10.0 M.' },
      { height:'Above 60.0 M. up to 80.0 M.',  front:'10.0 M.', side1:'15% of height or 11.0 M., whichever is less', side2:'15% of height or 11.0 M., whichever is less', rear:'12.0 M.' },
      { height:'Above 80.0 M.',                 front:'12.0 M.', side1:'15% of height or 14.0 M., whichever is less', side2:'15% of height or 14.0 M., whichever is less', rear:'14.0 M.' },
    ],
    assembly: [
      { height:'Up to 10.0 M. for land area up to 500.0 sq. M.',  front:'2.0 M.', side1:'1.2 M.', side2:'4.0 M.', rear:'4.0 M.' },
      { height:'Up to 10.0 M. for land area above 500.0 sq. M.',  front:'3.0 M.', side1:'3.5 M.', side2:'4.0 M.', rear:'4.0 M.' },
      { height:'Above 10.0 M. up to 21.5 M.',  front:'4.0 M.', side1:'4.0 M.', side2:'4.0 M.', rear:'5.0 M.' },
      { height:'Above 21.5 M. up to 25.5 M.',  front:'5.0 M.', side1:'5.0 M.', side2:'5.0 M.', rear:'6.0 M.' },
      { height:'Above 25.5 M. up to 40.0 M.',  front:'6.0 M.', side1:'6.5 M.', side2:'6.5 M.', rear:'9.0 M.' },
      { height:'Above 40.0 M. up to 60.0 M.',  front:'8.0 M.', side1:'9.0 M.', side2:'9.0 M.', rear:'10.0 M.' },
      { height:'Above 60.0 M. up to 80.0 M.',  front:'10.0 M.', side1:'15% of height or 11.0 M., whichever is less', side2:'15% of height or 11.0 M., whichever is less', rear:'12.0 M.' },
      { height:'Above 80.0 M.',                 front:'12.0 M.', side1:'15% of height or 14.0 M., whichever is less', side2:'15% of height or 14.0 M., whichever is less', rear:'14.0 M.' },
    ],
    business: [
      { height:'Up to 10.0 M. for land area up to 500.0 sq. M.',  front:'2.0 M.', side1:'1.2 M.', side2:'4.0 M.', rear:'4.0 M.' },
      { height:'Up to 10.0 M. for land area above 500.0 sq. M.',  front:'3.0 M.', side1:'3.5 M.', side2:'4.0 M.', rear:'4.0 M.' },
      { height:'Above 10.0 M. up to 21.5 M.',  front:'4.0 M.', side1:'4.0 M.', side2:'4.0 M.', rear:'5.0 M.' },
      { height:'Above 21.5 M. up to 25.5 M.',  front:'5.0 M.', side1:'5.0 M.', side2:'5.0 M.', rear:'6.0 M.' },
      { height:'Above 25.5 M. up to 40.0 M.',  front:'6.0 M.', side1:'6.5 M.', side2:'6.5 M.', rear:'9.0 M.' },
      { height:'Above 40.0 M. up to 60.0 M.',  front:'8.0 M.', side1:'9.0 M.', side2:'9.0 M.', rear:'10.0 M.' },
      { height:'Above 60.0 M. up to 80.0 M.',  front:'10.0 M.', side1:'15% of height or 11.0 M., whichever is less', side2:'15% of height or 11.0 M., whichever is less', rear:'12.0 M.' },
      { height:'Above 80.0 M.',                 front:'12.0 M.', side1:'15% of height or 14.0 M., whichever is less', side2:'15% of height or 14.0 M., whichever is less', rear:'14.0 M.' },
    ],
    industrial: [
      { height: 'Up to 12.5 M.',
       front: '5.0 M.', side1: '4.0 M.', side2: '4.0 M.', rear: '4.5 M.' },
     { height: 'Above 12.5 M. up to 21.5 M.',
       front: '6.0 M.', side1: '6.5 M.', side2: '6.5 M.', rear: '10.0 M.' },
     { height: 'Above 21.5 M.',
       front: '20% of the height of building or 6 M., whichever is more',
       side1: '20% of the height of building or 6.5 M., whichever is more',
       side2: '20% of the height of building or 6.5 M., whichever is more',
       rear:  '20% of the height of building or 10.0 M., whichever is more' },
   ],
    storage: [
      { height: 'Up to 12.5 M.',
       front: '5.0 M.', side1: '4.0 M.', side2: '4.0 M.', rear: '4.5 M.' },
     { height: 'Above 12.5 M. up to 21.5 M.',
       front: '6.0 M.', side1: '6.5 M.', side2: '6.5 M.', rear: '10.0 M.' },
     { height: 'Above 21.5 M.',
       front: '20% of the height of building or 6 M., whichever is more',
       side1: '20% of the height of building or 6.5 M., whichever is more',
       side2: '20% of the height of building or 6.5 M., whichever is more',
       rear:  '20% of the height of building or 10.0 M., whichever is more' },
   ],
    hazardous: [
      { height: 'Up to 12.5 M.',
       front: '5.0 M.', side1: '4.0 M.', side2: '4.0 M.', rear: '4.5 M.' },
     { height: 'Above 12.5 M. up to 21.5 M.',
       front: '6.0 M.', side1: '6.5 M.', side2: '6.5 M.', rear: '10.0 M.' },
     { height: 'Above 21.5 M.',
       front: '20% of the height of building or 6 M., whichever is more',
       side1: '20% of the height of building or 6.5 M., whichever is more',
       side2: '20% of the height of building or 6.5 M., whichever is more',
       rear:  '20% of the height of building or 10.0 M., whichever is more' },
   ],
  };

  /* ══════════════════════════════════════
     MAIN INIT
  ══════════════════════════════════════ */
  window._runMasterMulti = function () {
    const blockLabels = (window.KMCMulti ? KMCMulti.getBlocks() : []);
    localStorage.setItem('MB_blockCount', String(blockLabels.length || 1));

    const csv = localStorage.getItem('csvData');
    loadUseGroup();
    loadParkingTotals();
    const { treecover, feesTotal } = loadFloorTotals();

    if (csv) displayFilteredData(csv, blockLabels);

    calculateFAR();
    calculateGroundCoverage();
    calculateHeight();
    TreeCover();

    /* Proposed Tree Cover */
    const landDoc     = parseFloat(document.getElementById('land-area-doc')?.textContent.replace(/,/g, '').split(' ')[0]);
    const propTreePct = (treecover / landDoc) * 100;
    if (treecover) set('pro-tree', `${treecover.toFixed(3)} Sq.m. (${propTreePct.toFixed(3)}%)`);

    Compare();
    const popup = document.getElementById('master-popup');
    if (popup) popup.style.display = 'flex';
  };

})();
