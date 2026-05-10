/* ═══════════════════════════════════════════════════
   dxf_extractor.js  —  DXF Layer Extractor Logic
   KMC EODB v1.5 · 59 tracked layers
═══════════════════════════════════════════════════ */

// ── Constants ─────────────────────────────────────────────────────────────────
// Layers expected ONLY in Master Sheet
const MASTER_LAYERS = [
  "Plot","Road","Splay","Strip","GroundCoverage","TreeCover","OpenSpace",
  "Waterbody","Goomty","Alignment","GFPlanExistingStructure",
  "Sanctioned Alignment","STP","RWH","Pavement"
];
// Layers expected ONLY in A.dxf
const A_LAYERS = [
  "Column","Open Space_Ext_1","Residential","Mercantile_wholesale","Mercantile_retail",
  "Business","Institutional","Storage","Assembly","Hazardous","Industrial","Educational",
  "Internal Road","Stair","Lift","Lift_Ext_1","Loft","Cupboard","Tenement","Tenement_Ext_1",
  "Tenement_Single","Tenement_Single_Ext_1","Height","Floor Height","Roof_Structure","Terrace",
  "Parking_Area","Heritage","Existing","Service_floor","Common Area",
  "Fire Refuge","Triple_Balcony","Court Yard","Shaft",
  "Corridor","EVCP","Solar","Baby Care Room"
];
// Layers allowed in BOTH files
const SHARED_LAYERS = ["Parking"];

const MASTER_SET = new Set(MASTER_LAYERS);
const A_SET      = new Set(A_LAYERS);
const SHARED_SET = new Set(SHARED_LAYERS);
const TARGET_LAYERS = [...MASTER_LAYERS, ...A_LAYERS, ...SHARED_LAYERS];
const TARGET_SET    = new Set(TARGET_LAYERS);

// mm → m conversion (drawings are in millimetres)
const MM_TO_M   = 0.001;
const MM2_TO_M2 = MM_TO_M * MM_TO_M;   // for area: mm² → m²

const EXPECTED_PRINTABLE = {
  "Plot":true,"Road":false,"Splay":true,"Strip":true,"GroundCoverage":false,"TreeCover":false,
  "OpenSpace":false,"Open Space_Ext_1":false,"Residential":false,"Mercantile_wholesale":false,
  "Mercantile_retail":false,"Business":false,"Institutional":false,"Storage":false,"Assembly":false,
  "Hazardous":false,"Industrial":false,"Educational":false,"Internal Road":false,"Alignment":false,
  "Stair":false,"Lift":false,"Lift_Ext_1":false,"Loft":false,"Cupboard":false,"Tenement":false,
  "Tenement_Ext_1":false,"Tenement_Single":false,"Tenement_Single_Ext_1":false,"Height":false,
  "Floor Height":false,"Roof_Structure":false,"Terrace":false,"Parking":true,"Parking_Area":false,
  "Waterbody":true,"Heritage":false,"Existing":false,"Service_floor":false,"Common Area":false,
  "Wall":true,"Text":true,"Dimension":true,"Section":true,"Print":true,"Mis1":true,
  "Block_Text":true,"Fire Refuge":false,"Triple_Balcony":false,"Goomty":false,"Court Yard":false,
  "Shaft":false,"Corridor":false,"STP":false,"RWH":false,"Pavement":false,"EVCP":false,
  "Solar":false,"Baby Care Room":false,"Column":true,"GFPlanExistingStructure":false,
  "Sanctioned Alignment":false
};

const NAME_TO_ACI = { red:1,yellow:2,green:3,cyan:4,blue:5,magenta:6,white:7,grey:8,gray:8 };
const ACI_HEX = (() => {
  const m = {
    1:"#FF0000",2:"#FFFF00",3:"#00FF00",4:"#00FFFF",5:"#0000FF",6:"#FF00FF",
    7:"#FFFFFF",8:"#414141",9:"#808080",250:"#333333",251:"#505050",
    252:"#6F6F6F",253:"#8F8F8F",254:"#B0B0B0",255:"#D0D0D0"
  };
  const hues=[0,30,60,90,120,150,180,210,240,270,300,330,15,45,75,105,135,165,195,225,255,285,315,345];
  hues.forEach((h,hi) => {
    const shades=[100,82,66,50,33,82,66,50,33,20];
    shades.forEach((s,si) => { const idx=10+hi*10+si; if(idx<=249) m[idx]=`hsl(${h},100%,${s}%)`; });
  });
  return m;
})();

function resolveACI(raw) {
  const t = (raw||'').trim().toLowerCase();
  if (NAME_TO_ACI[t] !== undefined) return NAME_TO_ACI[t];
  const n = parseInt(t); return isNaN(n) ? 7 : n;
}
function aciHex(raw) { return ACI_HEX[resolveACI(raw)] || '#888'; }

function colorSwatchHTML(raw) {
  const aci = resolveACI(raw);
  const hex = ACI_HEX[aci] || '#888';
  const border = aci===7 ? '1px solid #555' : '1px solid rgba(255,255,255,.12)';
  return `<span style="display:inline-flex;align-items:center;gap:7px">
    <span style="width:16px;height:16px;border-radius:3px;flex-shrink:0;background:${hex};
      border:${border};box-shadow:0 1px 4px rgba(0,0,0,.5);display:inline-block"></span>
    <span style="font-family:'Courier New',monospace;font-size:11px;color:#94a3b8">${aci}</span>
  </span>`;
}

// ── State ─────────────────────────────────────────────────────────────────────
const S = {
  files: { master: null, a: null },
  rows: [],          // all parsed rows
  filtered: [],      // after filter
  srcFilter: 'All',
  layerFilter: 'All',
  mismatchOnly: false,
  search: '',
};

// ── Drop zones ────────────────────────────────────────────────────────────────
const MASTER_PATTERN = /^master\s+sheet\.dxf$/i;

function dzDrag(e, slot, on) { e.preventDefault(); document.getElementById('dz-'+slot).classList.toggle('drag', on); }
function dzDrop(e, slot) {
  e.preventDefault(); document.getElementById('dz-'+slot).classList.remove('drag');
  const f = e.dataTransfer.files[0]; if (f) fileChosen(slot, f);
}
function fileChosen(slot, file) {
  const dz  = document.getElementById('dz-'+slot);
  const valid = slot === 'master' ? MASTER_PATTERN.test(file.name) : file.name === 'A.dxf';
  const expected = slot === 'master'
    ? '"Master Sheet.dxf" (any capitalisation)'
    : '"A.dxf" (capital A, exact)';
  dz.classList.remove('ok','err');
  if (!valid) {
    document.getElementById('err-'+slot).textContent  = `Expected ${expected} — got "${file.name}"`;
    document.getElementById('ico-'+slot).textContent  = '📂';
    document.getElementById('hint-'+slot).innerHTML   = slot==='master'?'Drop or click · any capitalisation':'Drop or click · must be capital A';
    dz.classList.add('err');
    S.files[slot] = null;
  } else {
    document.getElementById('err-'+slot).textContent  = '';
    document.getElementById('ico-'+slot).textContent  = '✅';
    document.getElementById('hint-'+slot).innerHTML   = `<span class="dz-name">${file.name}</span>`;
    dz.classList.add('ok');
    S.files[slot] = file;
  }
  updateExtractBtn();
}
function updateExtractBtn() {
  const btn = document.getElementById('btn-extract');
  const ready = !!(S.files.master && S.files.a);   // BOTH required
  btn.disabled = !ready; btn.classList.toggle('ready', ready);
}

// ── CSV Parser ────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 4) continue;
    const name     = (cols[1]||'').trim();
    const colorRaw = (cols[2]||'').trim();
    const layer    = (cols[3]||'').trim();
    const lengthV  = (cols[4]||'').trim();
    const linetype = (cols[5]||'').trim();
    const lwRaw    = (cols[6]||'').trim();
    const areaV    = (cols[7]||'').trim();
    const closedV  = (cols[8]||'').trim();

    const canonical = TARGET_SET.has(layer) ? layer : (TARGET_LOWER[layer.toLowerCase()] || null);
    if (!canonical) continue;

    const isPolyline = name.toLowerCase().includes('polyline');
    const isLine     = name.toLowerCase() === 'line';
    const closedInt  = parseInt(closedV);
    const isClosed   = closedInt === -1;
    const areaNum    = parseFloat(areaV);
    const lenNum     = parseFloat(lengthV);
    const showArea   = isPolyline && isClosed && !isNaN(areaNum) && areaNum > 0;
    const showLength = (isLine || !isPolyline) && !isNaN(lenNum) && lenNum > 0
                    || (isPolyline && !isClosed && !isNaN(lenNum) && lenNum > 0);

    rows.push({
      count: 1, name, colorRaw, layer: canonical,
      length:    showLength ? lenNum.toFixed(3) : '—',
      area:      showArea   ? areaNum.toFixed(3) : '—',
      linetype, lineweight: lwRaw || 'ByLayer',
      closed:    isClosed ? -1 : 0,
      printable: undefined,
    });
  }
  return rows;
}

// ── DXF Tokeniser ─────────────────────────────────────────────────────────────
function tokenise(text) {
  const cleaned = text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  const lines = cleaned.split('\n');
  const pairs = [];
  for (let i = 0; i+1 < lines.length; i += 2) {
    const code = lines[i].trim(), val = lines[i+1].trim();
    if (code !== '') pairs.push({ code, val });
  }
  return pairs;
}

// ── DXF Parser ────────────────────────────────────────────────────────────────
// Returns { rows, allLayerNames, entityCount }
function parseDXF(text) {
  const pairs = tokenise(text);
  const n = pairs.length;

  // 1. Layer table
  const layerDefs = {};
  let inTable = false, inLayerTable = false, curLayer = null;
  for (let i = 0; i < n; i++) {
    const { code, val } = pairs[i];
    if (code==='0' && val==='TABLE')  { inTable = true; continue; }
    if (code==='0' && val==='ENDTAB') {
      if (curLayer && curLayer.name) layerDefs[curLayer.name] = {...curLayer};
      curLayer = null; inTable = false; inLayerTable = false; continue;
    }
    if (inTable && code==='2' && val==='LAYER') { inLayerTable = true; continue; }
    if (!inLayerTable) continue;
    if (code==='0' && val==='LAYER') {
      if (curLayer && curLayer.name) layerDefs[curLayer.name] = {...curLayer};
      curLayer = {}; continue;
    }
    if (curLayer) {
      if (code==='2')   curLayer.name       = val;
      if (code==='62')  curLayer.color      = parseInt(val);
      if (code==='6')   curLayer.linetype   = val || 'Continuous';
      if (code==='370') curLayer.lineweight = parseInt(val);
      if (code==='290') curLayer.plot       = val === '1';
    }
  }

  // 2. Scan BLOCKS + ENTITIES for geometry
  const ENTITY_TYPES = new Set(['LINE','LWPOLYLINE','POLYLINE','POINT','INSERT']);
  const allLayerNamesSet = new Set();
  const rawEntities = [];
  let section = '', ent = null;

  for (let i = 0; i < n; i++) {
    const { code, val } = pairs[i];

    if (code==='0' && val==='SECTION') continue;
    if (code==='2' && (val==='BLOCKS' || val==='ENTITIES')) {
      if (ent) { rawEntities.push(finalise(ent, layerDefs)); ent = null; }
      section = val; continue;
    }
    if (code==='0' && val==='ENDSEC') {
      if (ent) { rawEntities.push(finalise(ent, layerDefs)); ent = null; }
      section = ''; continue;
    }

    if (code==='8' && val) allLayerNamesSet.add(val);
    if (section !== 'BLOCKS' && section !== 'ENTITIES') continue;

    if (code==='0') {
      if (ent) { rawEntities.push(finalise(ent, layerDefs)); ent = null; }
      if (ENTITY_TYPES.has(val)) {
        ent = {
          type: val, layer:'0', color:null,
          linetype: null,   // null = not set on entity → ByLayer
          lineweight: null, // null = not set on entity → ByLayer
          closed: false,
          // LINE endpoints
          x1:null, y1:null, x2:null, y2:null,
          // LWPOLYLINE / POLYLINE vertices
          vertices: [], curX: null, curY: null,
          // area from DXF (group 42 = HATCH boundary area; we compute from vertices)
          area: 0
        };
      } else {
        ent = null;
      }
      continue;
    }

    if (!ent) continue;

    // Common entity codes
    if (code==='8')   ent.layer      = val;
    if (code==='62')  ent.color      = parseInt(val);       // explicit color index
    if (code==='6')   ent.linetype   = val;                 // explicit linetype name
    if (code==='370') ent.lineweight = parseInt(val);       // explicit lineweight

    // Closed flag: LWPOLYLINE group 70 bit-0; POLYLINE group 70 bit-0
    if (code==='70' && (ent.type==='LWPOLYLINE' || ent.type==='POLYLINE')) {
      ent.closed = (parseInt(val) & 1) === 1;
    }

    // LINE: start (10,20) and end (11,21)
    if (ent.type==='LINE') {
      if (code==='10') ent.x1 = parseFloat(val);
      if (code==='20') ent.y1 = parseFloat(val);
      if (code==='11') ent.x2 = parseFloat(val);
      if (code==='21') ent.y2 = parseFloat(val);
    }

    // LWPOLYLINE: vertices via code 10 (X) and 20 (Y) — each 10 starts a new vertex
    if (ent.type==='LWPOLYLINE') {
      if (code==='10') {
        if (ent.curX !== null && ent.curY !== null) {
          ent.vertices.push([ent.curX, ent.curY]);
        }
        ent.curX = parseFloat(val); ent.curY = null;
      }
      if (code==='20') ent.curY = parseFloat(val);
    }
  }
  if (ent) rawEntities.push(finalise(ent, layerDefs));

  // ── Geometry calculations ──────────────────────────────────────────────────
  function dist(ax,ay,bx,by){ return Math.sqrt((bx-ax)**2+(by-ay)**2); }
  function polyPerimeter(verts, closed) {
    let len = 0;
    for (let i = 0; i < verts.length-1; i++) len += dist(verts[i][0],verts[i][1],verts[i+1][0],verts[i+1][1]);
    if (closed && verts.length > 1) len += dist(verts[verts.length-1][0],verts[verts.length-1][1],verts[0][0],verts[0][1]);
    return len;
  }
  // Shoelace formula for polygon area
  function polyArea(verts) {
    let area = 0;
    const n = verts.length;
    for (let i = 0; i < n; i++) {
      const j = (i+1) % n;
      area += verts[i][0] * verts[j][1];
      area -= verts[j][0] * verts[i][1];
    }
    return Math.abs(area) / 2;
  }

  // Post-process: compute length/area from geometry
  for (const e of rawEntities) {
    if (e.type === 'LINE') {
      if (e.x1!==null && e.y1!==null && e.x2!==null && e.y2!==null) {
        e.length = dist(e.x1, e.y1, e.x2, e.y2);
      }
    }
    if (e.type === 'LWPOLYLINE') {
      // Flush last vertex
      if (e.curX !== null && e.curY !== null) e.vertices.push([e.curX, e.curY]);
      if (e.vertices.length >= 2) {
        e.length = polyPerimeter(e.vertices, e.closed);
        if (e.closed && e.vertices.length >= 3) e.area = polyArea(e.vertices);
      }
    }
  }

  // 3. Map to rows (one row per entity, count always 1)
  const rows = [];
  for (const e of rawEntities) {
    if (!TARGET_SET.has(e.layer)) continue;

    let typeName;
    if (e.type === 'LINE')                              typeName = 'Line';
    else if (e.type==='LWPOLYLINE'||e.type==='POLYLINE') typeName = 'Polyline';
    else if (e.type === 'POINT')                        typeName = 'Point';
    else if (e.type === 'INSERT')                       typeName = 'Insert';
    else typeName = e.type;

    const isPoly  = (e.type==='LWPOLYLINE' || e.type==='POLYLINE');
    const isLine  = (e.type==='LINE');
    const isClosed = e.closed || false;

    // Length: show for Line and Polyline (both open and closed)
    // Area:   show only for closed Polyline
    const showLength = (isLine || isPoly) && (e.length||0) > 0;
    const showArea   = isPoly && isClosed && (e.area||0) > 0;

    // Lineweight: entity-level if set, else "ByLayer"
    const lw = e.lineweight;
    const lwLabel = (lw===null || lw===-3 || lw===0) ? 'ByLayer'
                  : lw===-1 ? 'ByLayer'
                  : lw===-2 ? 'ByBlock'
                  : lw > 0  ? (lw/100).toFixed(2)+' mm' : 'ByLayer';

    // Linetype: entity-level if set, else "ByLayer"
    const ltLabel = e.linetype || 'ByLayer';

    rows.push({
      count:      1,
      name:       typeName,
      colorRaw:   String(e.color ?? 7),
      layer:      e.layer,
      // Convert mm → m (3 decimal places)
      length:     showLength ? (e.length * MM_TO_M).toFixed(3) : '—',
      area:       showArea   ? (e.area   * MM2_TO_M2).toFixed(3) : '—',
      linetype:   ltLabel,
      lineweight: lwLabel,
      closed:     isClosed ? -1 : 0,
      printable:  e.printable,
      // which file this layer is expected in
      expectedIn: SHARED_SET.has(e.layer) ? 'both' : MASTER_SET.has(e.layer) ? 'master' : 'a',
    });
  }

  return { rows, allLayerNames:[...allLayerNamesSet].sort(), entityCount:rawEntities.length };
}

function finalise(ent, layerDefs) {
  const ld = layerDefs[ent.layer] || {};
  // Color: use entity color if set, else inherit from layer def
  if (ent.color === null) ent.color = ld.color ?? 7;
  // Printable: from layer plot flag
  ent.printable = ld.plot !== undefined ? ld.plot : true;
  // linetype / lineweight stay null if not set on entity → rendered as ByLayer in rows
  return ent;
}

// ── Debug panel ───────────────────────────────────────────────────────────────
function renderDebug(slotId, label, allLayerNames, entityCount, rows) {
  const matched = new Set(rows.map(r => r.layer));
  const el = document.getElementById('debug-'+slotId);
  if (!el) return;
  el.innerHTML = `
    <h4>📄 ${label} — ${entityCount} entities · ${allLayerNames.length} unique layer names</h4>
    <div class="debug-tags">
      ${allLayerNames.length === 0
        ? '<span style="color:#f87171;font-size:12px">⚠ No layer names found — check encoding or file structure.</span>'
        : allLayerNames.map(l =>
            `<span class="dtag ${matched.has(l) ? 'found' : 'extra'}">${l}</span>`
          ).join('')}
    </div>
    <div class="debug-legend">
      <span style="color:#34d399">■ Green = matched &amp; extracted</span>
      <span style="color:#fbbf24">■ Yellow = in file but not in target list</span>
    </div>`;
}

// ── Extract ───────────────────────────────────────────────────────────────────
let _pendingShowAnyway = null;

function closePopup(showAnyway) {
  document.getElementById('popup-overlay').style.display = 'none';
  if (showAnyway && _pendingShowAnyway) _pendingShowAnyway();
  _pendingShowAnyway = null;
}

function handleExtract() {
  const btn = document.getElementById('btn-extract');
  btn.textContent = '⏳ Parsing…'; btn.disabled = true;

  const parseOne = (file, srcName) => readFile(file).then(text => {
    const res = parseDXF(text);
    return { rows: res.rows.map(r=>({...r,source:srcName})), allLayerNames:res.allLayerNames, entityCount:res.entityCount };
  });

  const jobs = [
    parseOne(S.files.master, S.files.master.name.replace(/\.\w+$/,'')),
    parseOne(S.files.a,      S.files.a.name.replace(/\.\w+$/,''))
  ];

  Promise.all(jobs).then(([mRes, aRes]) => {
    btn.textContent='⚡ Extract Layers'; btn.disabled=false; btn.classList.add('ready');

    // ── Layer-file mismatch validation ────────────────────────────────────
    // Skip layers that are allowed in both files (SHARED_SET)
    const masterWrong = mRes.rows.filter(r => A_SET.has(r.layer) && !SHARED_SET.has(r.layer));
    const aWrong      = aRes.rows.filter(r => MASTER_SET.has(r.layer) && !SHARED_SET.has(r.layer));
    const mismatches  = [
      ...masterWrong.map(r => ({ layer:r.layer, foundIn: S.files.master.name, shouldBeIn: 'A.dxf' })),
      ...aWrong.map(r      => ({ layer:r.layer, foundIn: S.files.a.name,      shouldBeIn: S.files.master.name }))
    ];
    // deduplicate by layer+foundIn
    const seen = new Set();
    const uniqMismatches = mismatches.filter(m => {
      const k = m.layer+'|'+m.foundIn;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });

    // ── Printable flag mismatch ───────────────────────────────────────────
    const allRowsForCheck = [...mRes.rows, ...aRes.rows];
    const printSeen = new Set();
    const printMismatches = allRowsForCheck
      .map(r => {
        const exp = EXPECTED_PRINTABLE[r.layer];
        const act = r.printable !== undefined ? r.printable : exp;
        return { layer:r.layer, source:r.source, expected:exp, actual:act,
                 mismatch: exp !== undefined && act !== exp };
      })
      .filter(m => {
        if (!m.mismatch) return false;
        const k = m.layer+'|'+m.source;
        if (printSeen.has(k)) return false;
        printSeen.add(k); return true;
      });

    const doShow = () => {      const allRows = [...mRes.rows, ...aRes.rows];
      S.rows = allRows;

      const dp = document.getElementById('debug-panel');
      dp.style.display = 'block';
      renderDebug('master', S.files.master.name, mRes.allLayerNames, mRes.entityCount, mRes.rows);
      renderDebug('a',      S.files.a.name,      aRes.allLayerNames, aRes.entityCount, aRes.rows);

      const sources = ['All', ...[...new Set(S.rows.map(r=>r.source))]];
      document.getElementById('src-btns').innerHTML = sources.map(s =>
        `<button class="ctrl-btn ${s==='All'?'active':''}" data-src="${s}" onclick="setSrc(this)">${s}</button>`
      ).join('');

      const layers = [...new Set(S.rows.map(r=>r.layer))].sort();
      const sel = document.getElementById('layer-sel');
      sel.innerHTML = '<option value="All">All layers</option>' +
        layers.map(l=>`<option value="${l}">${l}</option>`).join('');

      S.srcFilter='All'; S.layerFilter='All'; S.mismatchOnly=false; S.search='';
      document.getElementById('search').value='';
      document.getElementById('btn-csv').style.display='inline-block';
      document.getElementById('stats-bar').style.display='flex';
      document.getElementById('controls').style.display='flex';
      document.getElementById('tbl-wrap').style.display='block';
      document.getElementById('empty').style.display='none';
      applyFilter();
    };

    if (uniqMismatches.length > 0 || printMismatches.length > 0) {
      // Build popup body — layer-file mismatches
      let html = '';
      if (uniqMismatches.length > 0) {
        html += `<p style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Layer in wrong file</p>`;
        html += uniqMismatches.map(m => `
          <div style="display:flex;align-items:center;gap:10px;padding:7px 10px;margin-bottom:5px;
            background:#fef2f2;border:1px solid #fecaca;border-radius:7px">
            <span style="font-family:'Courier New',monospace;color:#dc2626;flex:1;font-weight:600">${m.layer}</span>
            <span style="color:#94a3b8;font-size:11px">found in <strong style="color:#d97706">${m.foundIn}</strong></span>
            <span style="color:#cbd5e1">→</span>
            <span style="color:#94a3b8;font-size:11px">should be in <strong style="color:#16a34a">${m.shouldBeIn}</strong></span>
          </div>`).join('');
      }
      // Printable mismatches
      if (printMismatches.length > 0) {
        html += `<p style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin:10px 0 6px">Printable flag mismatch</p>`;
        html += printMismatches.map(m => `
          <div style="display:flex;align-items:center;gap:10px;padding:7px 10px;margin-bottom:5px;
            background:#fffbeb;border:1px solid #fde68a;border-radius:7px">
            <span style="font-family:'Courier New',monospace;color:#92400e;flex:1;font-weight:600">${m.layer}</span>
            <span style="color:#94a3b8;font-size:11px">in <strong style="color:#64748b">${m.source}</strong></span>
            <span style="color:#cbd5e1">·</span>
            <span style="color:#94a3b8;font-size:11px">actual: <strong style="color:#dc2626">${m.actual?'Yes':'No'}</strong></span>
            <span style="color:#cbd5e1">→</span>
            <span style="color:#94a3b8;font-size:11px">expected: <strong style="color:#16a34a">${m.expected?'Yes':'No'}</strong></span>
          </div>`).join('');
      }
      document.getElementById('popup-body').innerHTML = html;
      const overlay = document.getElementById('popup-overlay');
      overlay.style.display = 'flex';
      _pendingShowAnyway = doShow;
    } else {
      doShow();
    }

  }).catch(err => {
    console.error(err);
    btn.textContent='⚡ Extract Layers'; btn.disabled=false; btn.classList.add('ready');
  });
}

function readFile(f) {
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=e=>res(e.target.result); r.onerror=rej; r.readAsText(f); });
}

// ── Filter ────────────────────────────────────────────────────────────────────
function setSrc(btn) {
  S.srcFilter = btn.dataset.src;
  document.querySelectorAll('[data-src]').forEach(b=>b.classList.toggle('active', b===btn));
  applyFilter();
}
function toggleMismatch() {
  S.mismatchOnly = !S.mismatchOnly;
  const btn = document.getElementById('btn-mismatch');
  btn.classList.toggle('active', S.mismatchOnly);
  btn.classList.toggle('red', S.mismatchOnly);
  btn.textContent = S.mismatchOnly ? '⚠ Mismatch only' : '⚠ Show mismatch';
  applyFilter();
}
function getPrintMismatch(r) {
  const exp = EXPECTED_PRINTABLE[r.layer];
  const act = r.printable !== undefined ? r.printable : exp;
  return { exp, act, mismatch: exp !== undefined && act !== exp };
}

function applyFilter() {
  S.search      = document.getElementById('search').value.toLowerCase();
  S.layerFilter = document.getElementById('layer-sel').value;

  S.filtered = S.rows.filter(r => {
    if (S.srcFilter !== 'All' && r.source !== S.srcFilter) return false;
    if (S.layerFilter !== 'All' && r.layer !== S.layerFilter) return false;
    if (S.search && !r.layer.toLowerCase().includes(S.search)) return false;
    if (S.mismatchOnly && !getPrintMismatch(r).mismatch) return false;
    return true;
  });

  const mismatchCount = S.rows.filter(r=>getPrintMismatch(r).mismatch).length;
  const layers = [...new Set(S.rows.map(r=>r.layer))];

  // Stats
  document.getElementById('stat-total').textContent    = S.rows.length;
  document.getElementById('stat-layers').textContent   = layers.length;
  document.getElementById('stat-showing').textContent  = S.filtered.length;
  document.getElementById('stat-mismatch').textContent = mismatchCount;
  document.getElementById('stat-mismatch').style.color = mismatchCount>0?'#dc2626':'#16a34a';
  document.getElementById('mismatch-warn').style.display = mismatchCount>0?'flex':'none';
  document.getElementById('ctrl-count').textContent = `${S.filtered.length} / ${S.rows.length} objects`;

  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('tbody');
  if (!S.filtered.length) {
    tbody.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:36px;color:#94a3b8">No matching rows found.</td></tr>`;
    return;
  }

  tbody.innerHTML = S.filtered.map((r, idx) => {
    const { mismatch } = getPrintMismatch(r);
    const evBg    = mismatch ? '#fef2f2' : '#ffffff';
    const odBg    = mismatch ? '#fff5f5' : '#f8fafc';
    const bg      = idx%2===0 ? evBg : odBg;
    const hoverBg = mismatch ? '#fee2e2' : '#eff6ff';

    const aciNum = resolveACI(r.colorRaw);

    // Closed badge
    const closedBg    = r.closed===-1 ? '#dcfce7' : '#fef9c3';
    const closedColor = r.closed===-1 ? '#15803d' : '#a16207';
    const closedLabel = r.closed===-1 ? 'Yes' : 'No';

    // length/area: use empty string for display when blank
    const lenDisplay  = r.length === '—' ? '' : r.length;
    const areaDisplay = r.area   === '—' ? '' : r.area;

    const TD   = 'padding:7px 13px;border-bottom:1px solid #f1f5f9;white-space:nowrap';
    const MONO = `${TD};font-family:'Courier New',monospace;font-size:11px`;

    // Column order: Count | Name | Color | Layer | Length | Linetype | Lineweight | Area | Closed
    return `<tr style="background:${bg};transition:background .12s"
              onmouseenter="this.style.background='${hoverBg}'"
              onmouseleave="this.style.background='${bg}'">
      <td style="${TD};text-align:center;color:#64748b;font-family:'Courier New',monospace">${r.count}</td>
      <td style="${TD};color:#475569;font-size:11px">${r.name}</td>
      <td style="${MONO};color:#6366f1">${aciNum}</td>
      <td style="${MONO};color:#0f172a;font-weight:600">${r.layer}</td>
      <td style="${MONO};color:${lenDisplay?'#0369a1':'#cbd5e1'}">${lenDisplay}</td>
      <td style="${MONO};color:#64748b">${r.linetype}</td>
      <td style="${MONO};color:#64748b">${r.lineweight}</td>
      <td style="${MONO};color:${areaDisplay?'#15803d':'#cbd5e1'}">${areaDisplay}</td>
      <td style="${TD};text-align:center">
        <span style="padding:2px 9px;border-radius:5px;font-size:11px;font-weight:700;background:${closedBg};color:${closedColor}">${closedLabel}</span>
      </td>
    </tr>`;
  }).join('');
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportCSV() {
  const hdr = 'Count,Name,Color(ACI),Layer,Length(m),Linetype,Lineweight,Area(m2),Closed,Source,Printable_Actual,Printable_Expected,Mismatch';
  const body = S.filtered.map(r => {
    const aci = resolveACI(r.colorRaw);
    const { exp, act, mismatch } = getPrintMismatch(r);
    const closedLabel = r.closed===-1 ? 'Yes' : 'No';
    // Replace em-dash with empty string for Excel compatibility
    const lenVal  = r.length === '—' ? '' : r.length;
    const areaVal = r.area   === '—' ? '' : r.area;
    return [
      r.count, r.name, aci, r.layer,
      lenVal, r.linetype, r.lineweight, areaVal, closedLabel,
      r.source,
      act!==undefined?(act?'Yes':'No'):'?',
      exp!==undefined?(exp?'Yes':'No'):'?',
      mismatch?'YES':''
    ].map(v=>`"${v??''}"`).join(',');
  }).join('\n');
  // Use UTF-8 BOM so Excel opens it correctly
  const bom = '\uFEFF';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bom+hdr+'\n'+body],{type:'text/csv;charset=utf-8;'}));
  a.download = 'extracted_layers.csv'; a.click();
}