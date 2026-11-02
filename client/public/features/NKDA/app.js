/* NKDA Smart DCR Pre-Check - page logic (stage 3). Pure helpers are exported for Node tests. */
(function (root) {
  'use strict';

  /* ================= pure helpers ================= */
  var FIXED = { 1: [255, 0, 0], 2: [255, 255, 0], 3: [0, 255, 0], 4: [0, 255, 255], 5: [0, 0, 255], 6: [255, 0, 255], 7: [255, 255, 255], 8: [128, 128, 128], 9: [192, 192, 192],
    250: [51, 51, 51], 251: [80, 80, 80], 252: [105, 105, 105], 253: [130, 130, 130], 254: [190, 190, 190], 255: [255, 255, 255] };

  function aciRgb(i) {
    if (FIXED[i]) return FIXED[i];
    if (!(i >= 10 && i <= 249)) return [255, 255, 255];
    var hue = Math.floor((i - 10) / 10) * 15, off = (i - 10) % 10;
    var f = [1, 0.65, 0.5, 0.3, 0.15][off >> 1], sat = (off % 2) ? 0.5 : 1;
    var h = hue / 60, x = 1 - Math.abs(h % 2 - 1), r, g, b;
    if (h < 1) { r = 1; g = x; b = 0; } else if (h < 2) { r = x; g = 1; b = 0; } else if (h < 3) { r = 0; g = 1; b = x; }
    else if (h < 4) { r = 0; g = x; b = 1; } else if (h < 5) { r = x; g = 0; b = 1; } else { r = 1; g = 0; b = x; }
    return [r, g, b].map(function (c) { c = c * 255; return Math.floor((c + (255 - c) * (1 - sat)) * f); });
  }

  /* points after p along a bulge segment p->q, ending exactly at q */
  function bulgePoints(p, q, bulge) {
    if (Math.abs(bulge) < 1e-9) return [q];
    var dx = q.x - p.x, dy = q.y - p.y, c = Math.hypot(dx, dy);
    if (c < 1e-12) return [q];
    var theta = 4 * Math.atan(bulge), d = (c / 2) * (1 - bulge * bulge) / (2 * bulge);
    var cx = (p.x + q.x) / 2 + (-dy / c) * d, cy = (p.y + q.y) / 2 + (dx / c) * d;
    var r = Math.hypot(p.x - cx, p.y - cy), a0 = Math.atan2(p.y - cy, p.x - cx);
    var n = Math.max(2, Math.ceil(Math.abs(theta) / (Math.PI / 24))), out = [];
    for (var k = 1; k < n; k++) { var a = a0 + theta * k / n; out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
    out.push(q); return out;
  }

  function entityBBox(e) {
    var xs = [], ys = [];
    if (e.p1) { xs.push(e.p1[0], e.p2[0]); ys.push(e.p1[1], e.p2[1]); }
    else if (e.verts && e.verts.length) e.verts.forEach(function (v) { xs.push(v.x); ys.push(v.y); });
    else if (e.pt) { var w = (e.height || 0) * (e.text ? e.text.length : 1) * 0.6; xs.push(e.pt.x, e.pt.x + w); ys.push(e.pt.y, e.pt.y + (e.height || 0)); }
    else if (e.p) { xs.push(e.p[0]); ys.push(e.p[1]); }
    else return null;
    return { minX: Math.min.apply(null, xs), minY: Math.min.apply(null, ys), maxX: Math.max.apply(null, xs), maxY: Math.max.apply(null, ys) };
  }

  function fitView(b, W, H, margin, minSpan) {
    margin = margin == null ? 0.06 : margin;
    var bw = b.maxX - b.minX, bh = b.maxY - b.minY;
    if (minSpan) { bw = Math.max(bw, minSpan); bh = Math.max(bh, minSpan); }
    bw = Math.max(bw, 1e-6); bh = Math.max(bh, 1e-6);
    return { cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, scale: Math.min(W * (1 - 2 * margin) / bw, H * (1 - 2 * margin) / bh) };
  }
  function w2s(v, W, H, x, y) { return { x: (x - v.cx) * v.scale + W / 2, y: H / 2 - (y - v.cy) * v.scale }; }
  function s2w(v, W, H, sx, sy) { return { x: (sx - W / 2) / v.scale + v.cx, y: (H / 2 - sy) / v.scale + v.cy }; }

  function entityRgb(e, layers) {
    if (e.aci) return aciRgb(e.aci);
    if (e.colorKind === 'truecolor') return [200, 200, 200];
    if (e.colorKind === 'bylayer') { var L = layers[String(e.layer).toUpperCase()]; return aciRgb(L && L.color ? L.color : 7); }
    return [255, 255, 255];
  }

  function groupIssues(issues, filt) {
    var map = new Map();
    issues.forEach(function (it, i) {
      if (!filt.sev[it.severity]) return;
      if (filt.q && (it.message + ' ' + it.code + ' ' + (it.layer || '') + ' ' + (it.handle || '') + ' ' + (it.title || '')).toLowerCase().indexOf(filt.q) < 0) return;
      var key = it.severity + '|' + it.code;
      if (!map.has(key)) map.set(key, { key: key, severity: it.severity, code: it.code, title: it.title, items: [] });
      map.get(key).items.push(i);
    });
    return Array.from(map.values());
  }

  var core = { aciRgb: aciRgb, bulgePoints: bulgePoints, entityBBox: entityBBox, fitView: fitView, w2s: w2s, s2w: s2w, entityRgb: entityRgb, groupIssues: groupIssues };
  if (typeof module === 'object' && module.exports) module.exports = core;
  if (typeof document === 'undefined') return;

  /* ================= UI ================= */
  var $ = function (id) { return document.getElementById(id); };
  var state = { rules: null, result: null, fileName: '', view: { cx: 0, cy: 0, scale: 1 }, sel: -1, hidden: {}, filt: { sev: { error: true, warning: true, info: true }, q: '' }, collapsed: {}, errMap: new Map(), W: 0, H: 0, dpr: 1, raf: 0 };
  var cv = $('canvas'), ctx = cv.getContext('2d');

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  /* ---- page state (shell status bar, upload card, reset) ---- */
  function showUpload(on) {
    ['home-hero', 'feature-strip'].forEach(function (id) { var n = $(id); if (n) n.style.display = on ? '' : 'none'; });
    var col = document.querySelector('.home-two-col'); if (col) col.style.display = on ? 'flex' : 'none';
  }
  function setShell(loaded, name) {
    var dot = $('status-dot'), txt = $('status-text'), clr = $('clearStorageBtn');
    if (dot) dot.classList.toggle('green', !!loaded);
    if (txt) txt.textContent = loaded ? 'Checked — ' + name : 'No file loaded — upload to begin';
    if (clr) clr.style.display = loaded ? 'inline-flex' : 'none';
  }
  root.nkReset = function () {
    state.result = null; state.pending = null; state.fileName = ''; state.dxfText = '';
    $('results').hidden = true; $('banner').hidden = true; $('status').textContent = '';
    $('drop').classList.remove('ok', 'err', 'over'); $('nk-ico').textContent = '\ud83d\udcc2';
    $('nk-hint').textContent = 'Drop or click \u00b7 ASCII DXF only (no DWG)'; $('nk-err').textContent = '';
    $('nk-btn-check').disabled = true; $('nk-btn-check').textContent = '\u26a1 Check Drawing';
    showUpload(true); setShell(false);
  };
  /* a file was chosen: validate, then wait for the Check Drawing button */
  function pick(file) {
    if (!file) return;
    var dz = $('drop'); dz.classList.remove('ok', 'err'); showBanner('');
    if (!/\.dxf$/i.test(file.name)) {
      state.pending = null; $('nk-btn-check').disabled = true;
      $('nk-ico').textContent = '\ud83d\udcc2'; dz.classList.add('err');
      $('nk-err').textContent = 'Please choose a .dxf file (got "' + file.name + '"). DWG files cannot be read in the browser.';
      return;
    }
    state.pending = file; $('nk-err').textContent = '';
    $('nk-ico').textContent = '\u2705'; $('nk-hint').textContent = file.name; dz.classList.add('ok');
    $('nk-btn-check').disabled = false;
  }

  /* ---- loading ---- */
  function loadRules() {
    return fetch('rules.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) { state.rules = j; })
      .catch(function () { showBanner('Could not load rules.json. Open this page through a web server (GitHub Pages, or "python -m http.server"), not by double-clicking the file.'); });
  }
  function showBanner(msg) { var b = $('banner'); b.textContent = msg; b.hidden = !msg; }

  function handleFile(file) {
    if (!file) return;
    if (!state.rules) { showBanner('Rules are not loaded yet.'); return; }
    showBanner('');
    if (!/\.dxf$/i.test(file.name)) { showBanner('Please choose a .dxf file. In AutoCAD use SAVEAS and pick an ASCII DXF format. DWG files cannot be read in the browser.'); return; }
    $('status').textContent = 'Reading ' + file.name + ' ...';
    var reader = new FileReader();
    reader.onload = function () { runCheck(String(reader.result), file.name); };
    reader.onerror = function () { showBanner('Could not read the file.'); };
    reader.readAsText(file);
  }
  function loadSample(url, name) {
    fetch(url).then(function (r) { if (!r.ok) throw new Error(); return r.text(); }).then(function (t) { runCheck(t, name); })
      .catch(function () { showBanner('Sample file not found.'); });
  }

  function runCheck(text, name) {
    $('status').textContent = 'Checking ' + name + ' ...';
    setTimeout(function () {
      var res;
      try { res = root.NKDAChecker.check(text, state.rules); } catch (err) { showBanner('The checker failed on this file: ' + err.message); $('status').textContent = ''; return; }
      state.result = res; state.fileName = name; state.sel = -1; state.hidden = {}; state.collapsed = {};
      state.dxfText = text; var canExport = res.drawing.entities.length > 0; $('btnPdf').disabled = !canExport; $('btnDxf').disabled = !canExport;
      state.errMap = new Map();
      res.issues.forEach(function (it) { if (it.ei != null && it.severity !== 'info') { var cur = state.errMap.get(it.ei); if (cur !== 'error') state.errMap.set(it.ei, it.severity); } });
      $('status').textContent = '';
      renderSummary(); renderIssues(); renderLayers(); renderNotes();
      $('results').hidden = false; $('loaded-filename').textContent = name;
      showUpload(false); setShell(true, name);
      resize(); fitAll(); schedule();
    }, 30);
  }

  /* ---- summary ---- */
  function renderSummary() {
    var r = state.result, s = r.summary, bar = $('sumBar');
    bar.className = 'sum ' + (r.pass ? 'ok' : 'bad');
    bar.textContent = '';
    bar.appendChild(el('div', 'sum-title', r.pass ? 'No errors found' : s.errors + (s.errors === 1 ? ' error' : ' errors') + ' to fix'));
    bar.appendChild(el('div', 'sum-sub', s.warnings + ' warning' + (s.warnings === 1 ? '' : 's') + ' \u00b7 ' + s.entitiesChecked + ' objects checked on FLOOR layers \u00b7 ' + s.entitiesIgnored + ' on other layers ignored'));
    if (r.pass) bar.appendChild(el('div', 'sum-note', 'This is an unofficial check. Passing here does not guarantee the official NKDA Smart DCR Pre-Check will pass.'));
  }

  /* ---- issues ---- */
  function renderIssues() {
    var r = state.result, list = $('issueList'), groups = groupIssues(r.issues, state.filt);
    list.textContent = '';
    var counts = { error: 0, warning: 0, info: 0 };
    r.issues.forEach(function (i) { counts[i.severity]++; });
    ['error', 'warning', 'info'].forEach(function (k) { $('cnt-' + k).textContent = counts[k]; });
    if (!groups.length) { list.appendChild(el('p', 'empty', r.issues.length ? 'No issues match the filter.' : 'Nothing to report.')); return; }
    groups.forEach(function (g) {
      var key = g.key, isCollapsed = state.collapsed[key] === undefined ? g.items.length > 40 : state.collapsed[key];
      var head = el('button', 'grp sev-' + g.severity);
      head.type = 'button'; head.setAttribute('aria-expanded', String(!isCollapsed));
      head.appendChild(el('span', 'grp-code', g.code));
      head.appendChild(el('span', 'grp-title', g.title));
      head.appendChild(el('span', 'grp-count', String(g.items.length)));
      head.addEventListener('click', function () { state.collapsed[key] = !isCollapsed; renderIssues(); });
      list.appendChild(head);
      if (isCollapsed) return;
      g.items.forEach(function (i) {
        var it = r.issues[i], b = el('button', 'iss' + (i === state.sel ? ' sel' : ''));
        b.type = 'button'; b.dataset.i = i;
        b.appendChild(el('div', 'iss-msg', it.message));
        var meta = [];
        if (it.layer) meta.push(it.layer);
        if (it.entityType) meta.push(it.entityType);
        if (it.handle) meta.push('handle ' + it.handle);
        if (it.x != null) meta.push('(' + (Math.round(it.x * 100) / 100) + ', ' + (Math.round(it.y * 100) / 100) + ')');
        if (it.ruleId) meta.push(it.ruleId);
        if (meta.length) b.appendChild(el('div', 'iss-meta', meta.join(' \u00b7 ')));
        b.addEventListener('click', function () { select(i, true); });
        list.appendChild(b);
      });
    });
  }

  function select(i, zoom) {
    state.sel = i;
    var it = state.result.issues[i];
    Array.prototype.forEach.call(document.querySelectorAll('.iss'), function (n) { n.classList.toggle('sel', Number(n.dataset.i) === i); });
    var node = document.querySelector('.iss[data-i="' + i + '"]');
    if (node && node.scrollIntoView) node.scrollIntoView({ block: 'nearest' });
    if (zoom && it) zoomToIssue(it);
    schedule();
  }
  function zoomToIssue(it) {
    var e = it.ei != null ? state.result.drawing.entities[it.ei] : null, b = e ? entityBBox(e) : null;
    if (!b && it.x != null) b = { minX: it.x, minY: it.y, maxX: it.x, maxY: it.y };
    if (!b) return;
    state.view = fitView(b, state.W, state.H, 0.2, 6);
    if (state.view.scale > 400) state.view.scale = 400;
  }

  /* ---- layers / notes ---- */
  function renderLayers() {
    var box = $('layerList'), ents = state.result.drawing.entities, by = {};
    box.textContent = '';
    ents.forEach(function (e) { var b = by[e.layer] || (by[e.layer] = { layer: e.layer, n: 0, ignored: e.ignored }); b.n++; });
    var rows = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return (a.ignored - b.ignored) || (a.layer < b.layer ? -1 : 1); });
    rows.forEach(function (rw) {
      var lab = el('label', 'lay'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !state.hidden[rw.layer];
      cb.addEventListener('change', function () { state.hidden[rw.layer] = !cb.checked; schedule(); });
      lab.appendChild(cb); lab.appendChild(el('span', 'lay-name', rw.layer));
      lab.appendChild(el('span', 'lay-tag', rw.ignored ? 'ignored by Smart DCR' : 'checked'));
      lab.appendChild(el('span', 'lay-n', String(rw.n)));
      box.appendChild(lab);
    });
  }
  function renderNotes() {
    var box = $('notesList'); box.textContent = '';
    box.appendChild(el('p', 'note-h', 'This tool does not check the following:'));
    state.result.notChecked.forEach(function (n) { box.appendChild(el('p', 'note', n)); });
    box.appendChild(el('p', 'note-h', 'Versions'));
    box.appendChild(el('p', 'note', 'Engine ' + state.result.engineVersion + ' \u00b7 Rules ' + state.result.rulesVersion + ' \u00b7 Manual: NKDA Smart DCR User Manual v3.0'));
  }

  /* ---- canvas ---- */
  function resize() {
    var wrap = $('viewerWrap'), r = wrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    state.W = Math.max(100, Math.floor(r.width)); state.H = Math.max(100, Math.floor(r.height)); state.dpr = dpr;
    cv.width = state.W * dpr; cv.height = state.H * dpr; cv.style.width = state.W + 'px'; cv.style.height = state.H + 'px';
    schedule();
  }
  function fitAll() {
    var r = state.result; if (!r) return;
    var ents = r.drawing.entities, box = null, rect = ents.filter(function (e) { return e.rules.indexOf('SITE-15') >= 0 && e.verts; })[0];
    if (rect) box = entityBBox(rect);
    if (!box) {
      var vis = ents.filter(function (e) { return !e.ignored; }); if (!vis.length) vis = ents;
      vis.forEach(function (e) { var b = entityBBox(e); if (!b) return; if (!box) box = { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY }; else { box.minX = Math.min(box.minX, b.minX); box.minY = Math.min(box.minY, b.minY); box.maxX = Math.max(box.maxX, b.maxX); box.maxY = Math.max(box.maxY, b.maxY); } });
    }
    if (box) state.view = fitView(box, state.W, state.H, 0.05, 1);
  }
  function schedule() { if (state.raf) return; state.raf = requestAnimationFrame(function () { state.raf = 0; draw(); }); }

  function pathEntity(e, v) {
    var W = state.W, H = state.H, p, i;
    if (e.p1) { p = w2s(v, W, H, e.p1[0], e.p1[1]); ctx.moveTo(p.x, p.y); p = w2s(v, W, H, e.p2[0], e.p2[1]); ctx.lineTo(p.x, p.y); return; }
    if (!e.verts || !e.verts.length) return;
    var n = e.verts.length, first = e.verts[0];
    p = w2s(v, W, H, first.x, first.y); ctx.moveTo(p.x, p.y);
    var segs = e.closed ? n : n - 1;
    for (i = 0; i < segs; i++) {
      var a = e.verts[i], b = e.verts[(i + 1) % n];
      bulgePoints(a, b, a.bulge || 0).forEach(function (q) { var s = w2s(v, W, H, q.x, q.y); ctx.lineTo(s.x, s.y); });
    }
  }

  function draw() {
    var r = state.result, W = state.W, H = state.H, v = state.view;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (!r) return;
    var ents = r.drawing.entities, layers = r.drawing.layers, i, e;
    ctx.lineWidth = 1; ctx.lineJoin = 'round';
    for (i = 0; i < ents.length; i++) {
      e = ents[i]; if (state.hidden[e.layer]) continue;
      var c = entityRgb(e, layers), col = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
      ctx.globalAlpha = e.ignored ? 0.3 : 1;
      if (e.text !== undefined) {
        var px = e.height * v.scale; if (px < 2.5) { ctx.globalAlpha *= 0.6; var tp = w2s(v, W, H, e.pt.x, e.pt.y); ctx.fillStyle = col; ctx.fillRect(tp.x, tp.y - 1, Math.max(2, e.text.length * px * 0.6), 1); continue; }
        var sp = w2s(v, W, H, e.pt.x, e.pt.y);
        ctx.save(); ctx.translate(sp.x, sp.y); ctx.rotate(-(e.rot || 0) * Math.PI / 180);
        ctx.fillStyle = col; ctx.font = Math.min(px, 600) + 'px system-ui, sans-serif'; ctx.textBaseline = 'alphabetic'; ctx.fillText(e.text, 0, 0); ctx.restore();
      } else if (e.p && !e.p1 && !e.verts) {
        var mp = w2s(v, W, H, e.p[0], e.p[1]); ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(mp.x - 3, mp.y - 3); ctx.lineTo(mp.x + 3, mp.y + 3); ctx.moveTo(mp.x - 3, mp.y + 3); ctx.lineTo(mp.x + 3, mp.y - 3); ctx.stroke();
      } else { ctx.strokeStyle = col; ctx.beginPath(); pathEntity(e, v); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    /* errors: crossed grey line over the object, as the manual describes */
    state.errMap.forEach(function (sev, ei) {
      var ent = ents[ei]; if (!ent || state.hidden[ent.layer] || sev !== 'error') return;
      var b = entityBBox(ent); if (!b) return;
      var a = w2s(v, W, H, b.minX, b.maxY), z = w2s(v, W, H, b.maxX, b.minY), cx = (a.x + z.x) / 2, cy = (a.y + z.y) / 2;
      var hw = Math.max(7, Math.abs(z.x - a.x) / 2), hh = Math.max(7, Math.abs(z.y - a.y) / 2);
      ctx.strokeStyle = 'rgba(170,170,170,0.9)'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(cx - hw, cy - hh); ctx.lineTo(cx + hw, cy + hh); ctx.moveTo(cx - hw, cy + hh); ctx.lineTo(cx + hw, cy - hh); ctx.stroke();
    });
    /* selected object */
    var sel = state.sel >= 0 ? r.issues[state.sel] : null;
    if (sel && sel.ei != null) {
      var se = ents[sel.ei];
      if (se && se.text === undefined) { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3; ctx.beginPath(); pathEntity(se, v); ctx.stroke(); ctx.lineWidth = 1; }
    }
    /* markers */
    var vis = state.filt.sev;
    r.issues.forEach(function (it, idx) {
      if (it.x == null || !vis[it.severity] || it.severity === 'info') return;
      if (it.ei != null && ents[it.ei] && state.hidden[ents[it.ei].layer]) return;
      var p = w2s(v, W, H, it.x, it.y); if (p.x < -20 || p.y < -20 || p.x > W + 20 || p.y > H + 20) return;
      var isSel = idx === state.sel;
      ctx.strokeStyle = it.severity === 'error' ? '#ff5c5c' : '#ffb020'; ctx.lineWidth = isSel ? 3 : 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, isSel ? 12 : 7, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.lineWidth = 1;
  }

  function nearestIssue(sx, sy) {
    var r = state.result, best = -1, bd = 14;
    r.issues.forEach(function (it, idx) {
      if (it.x == null || it.severity === 'info' || !state.filt.sev[it.severity]) return;
      var p = w2s(state.view, state.W, state.H, it.x, it.y), d = Math.hypot(p.x - sx, p.y - sy);
      if (d < bd) { bd = d; best = idx; }
    });
    return best;
  }

  /* ---- downloads ---- */
  function snapshot() {
    var off = document.createElement('canvas'), W = 1600, H = 1000; off.width = W; off.height = H;
    var keep = { W: state.W, H: state.H, dpr: state.dpr, view: state.view, ctx: ctx, sel: state.sel }, url = null;
    ctx = off.getContext('2d'); state.W = W; state.H = H; state.dpr = 1; state.sel = -1; fitAll();
    try { draw(); url = off.toDataURL('image/png'); }
    finally { ctx = keep.ctx; state.W = keep.W; state.H = keep.H; state.dpr = keep.dpr; state.view = keep.view; state.sel = keep.sel; }
    return { dataUrl: url, w: W, h: H };
  }
  function baseName() { return state.fileName.replace(/\.dxf$/i, '') || 'drawing'; }
  function saveBlob(blob, fileName) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  $('btnPdf').addEventListener('click', function () {
    if (!state.result) return;
    if (!(root.jspdf && root.jspdf.jsPDF)) { showBanner('The PDF library did not load (vendor/jspdf.umd.min.js).'); return; }
    try {
      var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var when = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      root.NKDAReport.makePdf(root.jspdf.jsPDF, state.result, { fileName: state.fileName, when: when }, snapshot()).save(baseName() + '-precheck-report.pdf');
    } catch (err) { showBanner('Could not build the PDF: ' + err.message); }
  });
  $('btnDxf').addEventListener('click', function () {
    if (!state.result) return;
    try { saveBlob(new Blob([root.NKDAReport.makeMarkedDxf(state.dxfText, state.result).dxf], { type: 'application/dxf' }), baseName() + '-marked.dxf'); }
    catch (err) { showBanner('Could not build the marked-up DXF: ' + err.message); }
  });

  /* ---- interaction ---- */
  function zoomAt(sx, sy, f) {
    var v = state.view, w = s2w(v, state.W, state.H, sx, sy), ns = Math.min(1e6, Math.max(1e-4, v.scale * f));
    v.scale = ns; v.cx = w.x - (sx - state.W / 2) / ns; v.cy = w.y + (sy - state.H / 2) / ns; schedule();
  }
  var pointers = new Map(), drag = null, pinch = 0;
  function pdist() { var a = Array.from(pointers.values()); return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
  cv.addEventListener('pointerdown', function (ev) {
    cv.setPointerCapture(ev.pointerId); pointers.set(ev.pointerId, { x: ev.offsetX, y: ev.offsetY });
    if (pointers.size === 1) drag = { moved: 0 }; if (pointers.size === 2) { pinch = pdist(); drag = null; }
  });
  cv.addEventListener('pointermove', function (ev) {
    var p = pointers.get(ev.pointerId); if (!p) return;
    var dx = ev.offsetX - p.x, dy = ev.offsetY - p.y; p.x = ev.offsetX; p.y = ev.offsetY;
    if (pointers.size === 2 && pinch) { var d = pdist(), a = Array.from(pointers.values()); zoomAt((a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2, d / pinch); pinch = d; }
    else if (drag) { drag.moved += Math.abs(dx) + Math.abs(dy); state.view.cx -= dx / state.view.scale; state.view.cy += dy / state.view.scale; schedule(); }
  });
  function endPointer(ev) {
    if (drag && drag.moved < 5 && state.result && pointers.size === 1) { var i = nearestIssue(ev.offsetX, ev.offsetY); if (i >= 0) select(i, false); }
    pointers.delete(ev.pointerId); drag = null; pinch = 0;
  }
  cv.addEventListener('pointerup', endPointer); cv.addEventListener('pointercancel', endPointer);
  cv.addEventListener('wheel', function (ev) { ev.preventDefault(); zoomAt(ev.offsetX, ev.offsetY, Math.pow(1.0015, -ev.deltaY)); }, { passive: false });
  $('btnIn').addEventListener('click', function () { zoomAt(state.W / 2, state.H / 2, 1.5); });
  $('btnOut').addEventListener('click', function () { zoomAt(state.W / 2, state.H / 2, 1 / 1.5); });
  $('btnFit').addEventListener('click', function () { fitAll(); schedule(); });
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe($('viewerWrap'));

  /* tabs and filters */
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (x) { x.setAttribute('aria-selected', String(x === t)); });
      ['Issues', 'Layers', 'Notes'].forEach(function (n) { $('panel' + n).hidden = t.dataset.tab !== n; });
    });
  });
  ['error', 'warning', 'info'].forEach(function (k) {
    $('f-' + k).addEventListener('change', function (ev) { state.filt.sev[k] = ev.target.checked; if (state.result) { renderIssues(); schedule(); } });
  });
  $('q').addEventListener('input', function (ev) { state.filt.q = ev.target.value.trim().toLowerCase(); if (state.result) renderIssues(); });

  /* upload */
  var drop = $('drop'), fileInp = $('file');
  drop.addEventListener('click', function (ev) { if (ev.target !== fileInp) fileInp.click(); });
  fileInp.addEventListener('change', function (ev) { pick(ev.target.files[0]); ev.target.value = ''; });
  ['dragenter', 'dragover'].forEach(function (n) { drop.addEventListener(n, function (ev) { ev.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (n) { drop.addEventListener(n, function (ev) { ev.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (ev) { pick(ev.dataTransfer.files[0]); });
  $('nk-btn-check').addEventListener('click', function () { if (state.pending) handleFile(state.pending); });
  $('sampleGood').addEventListener('click', function () { loadSample('test/good.dxf', 'sample-clean.dxf'); });
  $('sampleBad').addEventListener('click', function () { loadSample('test/bad.dxf', 'sample-faulty.dxf'); });

  loadRules();
})(typeof self !== 'undefined' ? self : this);
