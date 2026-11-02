/*
 * NKDA Smart DCR Pre-Check - report builders (stage 4)
 *   makeMarkedDxf(originalDxfText, result) -> { dxf, marks }
 *   makePdf(jsPDFConstructor, result, meta, snapshot) -> jsPDF document
 * The marked-up DXF adds only objects on layer NONCOMPLIANT (which does not start with
 * FLOOR, so Smart DCR ignores it if the file is uploaded again).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NKDAReport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LAYER = 'NONCOMPLIANT', MAX_MARKS = 3000;
  function ascii(s) { return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\x7E]/g, '?'); }
  function latin(s) { return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\xFF]/g, '?'); }
  function f6(n) { return (Math.round(n * 1e6) / 1e6).toFixed(6); }
  function hex(n) { return n.toString(16).toUpperCase(); }

  function bbox(e) {
    var xs = [], ys = [];
    if (e.p1) { xs.push(e.p1[0], e.p2[0]); ys.push(e.p1[1], e.p2[1]); }
    else if (e.verts && e.verts.length) e.verts.forEach(function (v) { xs.push(v.x); ys.push(v.y); });
    else if (e.pt) { var w = (e.height || 0) * (e.text ? e.text.length : 1) * 0.6; xs.push(e.pt.x, e.pt.x + w); ys.push(e.pt.y, e.pt.y + (e.height || 0)); }
    else if (e.p) { xs.push(e.p[0]); ys.push(e.p[1]); }
    else return null;
    return { minX: Math.min.apply(null, xs), minY: Math.min.apply(null, ys), maxX: Math.max.apply(null, xs), maxY: Math.max.apply(null, ys) };
  }

  /* ---------------------------------------------------------------- marked-up DXF */
  function makeMarkedDxf(text, result) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var eol = /\r\n/.test(text) ? '\r\n' : '\n';
    var lines = text.split(/\r\n|\r|\n/);
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    function tr(i) { return lines[i] === undefined ? '' : lines[i].trim(); }

    var sec = '', table = '', entEnd = -1, layerEnd = -1, seedIdx = -1, maxH = 0, hasLayer = false, i;
    for (i = 0; i + 1 < lines.length; i += 2) {
      var c = tr(i), v = tr(i + 1);
      if (c === '0' && v === 'SECTION') sec = tr(i + 2) === '2' ? tr(i + 3).toUpperCase() : '';
      else if (c === '0' && v === 'ENDSEC') { if (sec === 'ENTITIES' && entEnd < 0) entEnd = i; sec = ''; }
      else if (sec === 'TABLES' && c === '0' && v === 'TABLE') table = tr(i + 2) === '2' ? tr(i + 3).toUpperCase() : '';
      else if (sec === 'TABLES' && c === '0' && v === 'ENDTAB') { if (table === 'LAYER' && layerEnd < 0) layerEnd = i; table = ''; }
      else if (sec === 'TABLES' && table === 'LAYER' && c === '2' && v.toUpperCase() === LAYER) hasLayer = true;
      else if (sec === 'HEADER' && c === '9' && v === '$HANDSEED') seedIdx = i + 3;
      if (c === '5') { var n = parseInt(v, 16); if (n > maxH) maxH = n; }
    }
    if (entEnd < 0) throw new Error('No ENTITIES section found in the DXF.');

    var sub = /AcDbEntity/.test(text), subLayer = /AcDbLayerTableRecord/.test(text), useH = maxH > 0, nextH = maxH + 1;
    var add = [];
    function p(code, val) { add.push(String(code), String(val)); }
    function head(type) { p(0, type); if (useH) p(5, hex(nextH++)); if (sub) p(100, 'AcDbEntity'); p(8, LAYER); }
    function circle(x, y, r, col) { head('CIRCLE'); p(62, col); if (sub) p(100, 'AcDbCircle'); p(10, f6(x)); p(20, f6(y)); p(30, 0); p(40, f6(r)); }
    function line(x1, y1, x2, y2, col) { head('LINE'); p(62, col); if (sub) p(100, 'AcDbLine'); p(10, f6(x1)); p(20, f6(y1)); p(30, 0); p(11, f6(x2)); p(21, f6(y2)); p(31, 0); }
    function txt(x, y, h, s, col) { head('TEXT'); p(62, col); if (sub) p(100, 'AcDbText'); p(10, f6(x)); p(20, f6(y)); p(30, 0); p(40, f6(h)); p(1, ascii(s)); if (sub) p(100, 'AcDbText'); }

    /* overall size of the checked drawing, to scale the marks */
    var ents = result.drawing.entities, box = null;
    ents.forEach(function (e) {
      if (e.ignored) return; var b = bbox(e); if (!b) return;
      if (!box) box = { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
      else { box.minX = Math.min(box.minX, b.minX); box.minY = Math.min(box.minY, b.minY); box.maxX = Math.max(box.maxX, b.maxX); box.maxY = Math.max(box.maxY, b.maxY); }
    });
    if (!box) box = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    var size = Math.max(box.maxX - box.minX, box.maxY - box.minY, 1), ht = Math.max(0.25, size / 300), marks = 0, globals = [];

    result.issues.forEach(function (it) {
      if (it.severity === 'info') return;
      if (it.x == null) { globals.push(it); return; }
      if (marks >= MAX_MARKS) return;
      var e = it.ei != null ? ents[it.ei] : null, b = e ? bbox(e) : null;
      if (!b) b = { minX: it.x, minY: it.y, maxX: it.x, maxY: it.y };
      var cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2, w = b.maxX - b.minX, h = b.maxY - b.minY;
      var r = Math.max(0.6, Math.hypot(w, h) / 2 * 1.15 + 0.2), col = it.severity === 'error' ? 1 : 2;
      circle(cx, cy, r, col);
      if (it.severity === 'error') { var hw = Math.max(w / 2, 0.4), hh = Math.max(h / 2, 0.4); line(cx - hw, cy - hh, cx + hw, cy + hh, 8); line(cx - hw, cy + hh, cx + hw, cy - hh, 8); }
      txt(cx + r + ht * 0.4, cy, ht, '[' + it.code + '] ' + it.message.slice(0, 140), col);
      marks++;
    });
    if (globals.length) {
      var gy = box.minY - ht * 3;
      txt(box.minX, gy, ht * 1.3, 'DRAWING-LEVEL ISSUES (no single location)', 1); gy -= ht * 2;
      globals.forEach(function (it) { txt(box.minX, gy, ht, '[' + it.code + '] ' + it.message.slice(0, 160), it.severity === 'error' ? 1 : 2); gy -= ht * 1.6; marks++; });
    }
    if (result.issues.length && marks >= MAX_MARKS) txt(box.minX, box.maxY + ht * 2, ht, 'Only the first ' + MAX_MARKS + ' issues are marked. See the PDF report for the rest.', 1);

    if (!add.length) return { dxf: lines.join(eol) + eol, marks: 0 };
    var layerRec = [];
    if (!hasLayer && layerEnd >= 0) {
      layerRec.push('0', 'LAYER'); if (useH) layerRec.push('5', hex(nextH++));
      if (subLayer) layerRec.push('100', 'AcDbSymbolTableRecord', '100', 'AcDbLayerTableRecord');
      layerRec.push('2', LAYER, '70', '0', '62', '1', '6', 'Continuous');
    }
    var out = lines.slice();
    Array.prototype.splice.apply(out, [entEnd, 0].concat(add));
    if (layerRec.length) Array.prototype.splice.apply(out, [layerEnd, 0].concat(layerRec));
    if (seedIdx >= 0 && useH) out[seedIdx] = hex(nextH);
    return { dxf: out.join(eol) + eol, marks: marks };
  }

  /* ---------------------------------------------------------------- PDF report */
  function makePdf(JsPDF, result, meta, snap) {
    var doc = new JsPDF({ unit: 'mm', format: 'a4' }), PW = 210, PH = 297, M = 15, CW = PW - 2 * M, y = M;
    var RED = [200, 40, 40], AMB = [185, 115, 0], GRN = [20, 140, 90], INK = [30, 30, 30], GREY = [110, 110, 110], BLUE = [40, 100, 190];
    function ensure(h) { if (y + h > PH - M - 4) { doc.addPage(); y = M; } }
    function para(t, o) {
      o = o || {}; var size = o.size || 9, lh = size * 0.3528 * 1.3;
      doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor.apply(doc, o.color || INK);
      doc.splitTextToSize(latin(t), CW - (o.indent || 0)).forEach(function (l) { ensure(lh); doc.text(l, M + (o.indent || 0), y + size * 0.3528); y += lh; });
      y += o.gap == null ? 1.2 : o.gap;
    }
    var s = result.summary, pass = result.pass;

    para('NKDA Smart DCR Pre-Check Report', { size: 18, bold: true, gap: 0.5 });
    para('Unofficial check against the Smart DCR User Manual v' + (result.manualVersion || '3.0') + ' (format only, not building rules)', { size: 9, color: GREY, gap: 3 });
    para('File: ' + meta.fileName, { size: 10 }); para('Checked: ' + meta.when, { size: 10 });
    para('Engine ' + result.engineVersion + '  |  Rules ' + result.rulesVersion, { size: 9, color: GREY, gap: 3 });

    ensure(22); doc.setFillColor.apply(doc, pass ? [225, 245, 236] : [250, 228, 228]); doc.roundedRect(M, y, CW, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor.apply(doc, pass ? GRN : RED);
    doc.text(pass ? 'NO ERRORS FOUND' : s.errors + (s.errors === 1 ? ' ERROR' : ' ERRORS') + ' TO FIX', M + 4, y + 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor.apply(doc, INK);
    doc.text(s.warnings + ' warning(s)  |  ' + s.entitiesChecked + ' objects checked on FLOOR layers  |  ' + s.entitiesIgnored + ' on other layers ignored', M + 4, y + 14);
    y += 22;

    if (snap && snap.dataUrl) {
      var wmm = CW, hmm = CW * snap.h / snap.w; if (hmm > 105) { hmm = 105; wmm = hmm * snap.w / snap.h; }
      ensure(hmm + 8); doc.addImage(snap.dataUrl, 'PNG', M, y, wmm, hmm, undefined, 'FAST'); y += hmm + 2;
      para('Red rings = errors, amber rings = warnings, grey cross = object with an error.', { size: 8, color: GREY, gap: 4 });
    }

    var groups = [], idx = {};
    result.issues.forEach(function (it) { var k = it.severity + '|' + it.code; if (!idx[k]) { idx[k] = { sev: it.severity, code: it.code, title: it.title, items: [] }; groups.push(idx[k]); } idx[k].items.push(it); });
    if (!groups.length) para('No issues to report.', { size: 11, bold: true, color: GRN });
    else para('Issues', { size: 13, bold: true, gap: 2 });
    var CAP = 40;
    groups.forEach(function (g) {
      var col = g.sev === 'error' ? RED : g.sev === 'warning' ? AMB : BLUE;
      ensure(14); para(g.sev.toUpperCase() + '  ' + g.code + '  ' + g.title + '  (' + g.items.length + ')', { size: 10, bold: true, color: col, gap: 0.8 });
      g.items.slice(0, CAP).forEach(function (it, n) {
        ensure(13);
        para((n + 1) + '. ' + it.message, { size: 8.5, indent: 3, gap: 0 });
        var m = []; if (it.layer) m.push('Layer ' + it.layer); if (it.entityType) m.push(it.entityType); if (it.handle) m.push('handle ' + it.handle);
        if (it.x != null) m.push('at (' + (Math.round(it.x * 100) / 100) + ', ' + (Math.round(it.y * 100) / 100) + ')'); if (it.ruleId) m.push(it.ruleId);
        if (m.length) para(m.join('  |  '), { size: 7.5, indent: 3, color: GREY, gap: 1 });
      });
      if (g.items.length > CAP) para('... and ' + (g.items.length - CAP) + ' more of this type. Download the marked-up DXF to see every location.', { size: 8.5, indent: 3, color: GREY, gap: 2 });
      y += 2;
    });

    ensure(20); para('Not checked by this tool', { size: 12, bold: true, gap: 1.5 });
    result.notChecked.forEach(function (n) { para('- ' + n, { size: 8.5, indent: 3, gap: 0.6 }); });
    y += 3;
    para('This report comes from an unofficial tool and does not replace the official NKDA Smart DCR Pre-Check. The architect remains responsible for compliance with the rules.', { size: 8, color: GREY });

    var pages = doc.getNumberOfPages();
    for (var i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, GREY);
      doc.text('NKDA Smart DCR Pre-Check (unofficial)  |  ' + latin(meta.fileName).slice(0, 60), M, PH - 8);
      doc.text('Page ' + i + ' of ' + pages, PW - M, PH - 8, { align: 'right' });
    }
    return doc;
  }

  return { makeMarkedDxf: makeMarkedDxf, makePdf: makePdf, LAYER: LAYER };
});
