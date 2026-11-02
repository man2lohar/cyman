/*
 * NKDA Smart DCR Pre-Check engine  (stage 2)
 * Reads ASCII DXF text and checks it against rules.json.
 * Browser:  const result = NKDAChecker.check(dxfText, rules);
 * Node:     const { check } = require('./nkda-checker.js');
 *
 * Severity policy
 *   error   = stated in the manual text (would fail the real Pre-Check)
 *   warning = inferred from an annex example, or the manual is silent
 *   info    = note only
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NKDAChecker = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '2.1.0-manual-v3';
  var EPS = 1e-6;
  var ZERO = 1e-9;

  var CODES = {
    'F-BINARY': 'Binary DXF not supported', 'F-INVALID': 'Not a readable DXF file', 'F-NOFLOOR': 'No objects on FLOOR layers',
    'F-UNITS': 'Drawing units', 'F-VERSION': 'DXF version note',
    'L-NAME': 'Invalid FLOOR layer name', 'L-STATE': 'Layer locked / frozen / off',
    'E-PAPER': 'Object in paper space', 'E-FORBIDDEN': 'Forbidden object type', 'E-UNLISTED': 'Object type not covered by manual',
    'E-Z': 'Z coordinate / elevation not zero', 'E-EXTRUSION': 'Object not in top view (XY plane)', 'E-THICK': 'Thickness not zero',
    'E-WIDTH': 'Polyline width not zero', 'E-LW': 'Line weight not zero',
    'E-TEXT-HEIGHT': 'Text height too small', 'E-TEXT-EMPTY': 'Empty text', 'E-TEXT-MULTILINE': 'Text is not single line',
    'E-COLOR': 'Object colour not explicit ACI', 'E-MATCH': 'Colour / object type / layer not defined in manual',
    'E-TEXT-INVALID': 'Text not permitted', 'E-TEXT-MISSING': 'Required text missing inside boundary', 'E-TEXT-ORPHAN': 'Text not inside a matching boundary',
    'E-CLOSE': 'Polyline not closed', 'E-CLOSE-FLAG': 'Polyline closed by coordinates only', 'E-VERTS': 'Too few vertices', 'E-AREA': 'Zero area',
    'E-SELFX': 'Polyline crosses or touches itself', 'E-DUPVERT': 'Duplicate vertices', 'E-ZEROLEN': 'Zero-length line',
    'E-DUP': 'Duplicate object', 'E-OVERLAP': 'Overlapping objects', 'E-CONTAIN': 'Object not inside required boundary',
    'E-BLOCK-LABEL': 'Block has no name text', 'E-BLOCK-OUTSIDE': 'Floor plan outside its block rectangle',
    'E-RECT-SHAPE': 'Bounding rectangle is not a rectangle', 'E-RECT-MULTI': 'More than one bounding rectangle',
    'E-RECT-ORIGIN': 'Bounding rectangle not at 0,0', 'E-OUTSIDE': 'Object outside bounding rectangle', 'E-MANDATORY': 'Mandatory item missing'
  };

  var KIND_NAME = {
    ground: 'FLOOR-GROUND', basement: 'FLOOR-BF / FLOOR-BFn', applicable_floor: 'FLOOR01, FLOOR02...',
    service: 'FLOOR-SERVICE', terrace: 'FLOOR-TERRACE', terrace_intermediate: 'FLOOR-TERRACEINTERMEDIATE (01, 02...)', mezzanine: 'FLOOR-MEZZANINE', unknown: 'unknown'
  };
  var TYPE_NAME = { LWPOLYLINE: 'Polyline', LINE: 'Line', TEXT: 'Text' };
  var FORBID = {
    INSERT: 'Block or external reference (not processed by Smart DCR)',
    REGION: 'Region (not processed by Smart DCR)', WIPEOUT: 'Wipeout (not processed by Smart DCR)',
    OLE2FRAME: 'OLE object (not allowed)', MTEXT: 'MText (use single-line TEXT only)'
  };

  /* ------------------------------------------------------------ helpers */
  function up(s) { return String(s == null ? '' : s).toUpperCase(); }
  function normText(s) { return up(s).replace(/\s+/g, ' ').trim(); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function distPtSeg(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    if (l2 === 0) return dist(p, a);
    var t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2; t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }
  function orient(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
  function segCross(a, b, c, d) {
    var o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
    return ((o1 > ZERO && o2 < -ZERO) || (o1 < -ZERO && o2 > ZERO)) && ((o3 > ZERO && o4 < -ZERO) || (o3 < -ZERO && o4 > ZERO));
  }
  function segTouch(a, b, c, d) {
    return segCross(a, b, c, d) || distPtSeg(a, c, d) < EPS || distPtSeg(b, c, d) < EPS || distPtSeg(c, a, b) < EPS || distPtSeg(d, a, b) < EPS;
  }
  function pointInPoly(p, pts) {
    var n = pts.length, i, j;
    for (i = 0; i < n; i++) if (distPtSeg(p, pts[i], pts[(i + 1) % n]) < EPS) return true;
    var inside = false;
    for (i = 0, j = n - 1; i < n; j = i++) {
      var a = pts[i], b = pts[j];
      if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) inside = !inside;
    }
    return inside;
  }
  function polyArea(pts) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; }
    return Math.abs(s) / 2;
  }
  function bboxOfPts(pts) {
    var b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    pts.forEach(function (p) { b.minX = Math.min(b.minX, p.x); b.minY = Math.min(b.minY, p.y); b.maxX = Math.max(b.maxX, p.x); b.maxY = Math.max(b.maxY, p.y); });
    return b;
  }
  function bboxOverlap(a, b) { return !(a.maxX < b.minX - EPS || b.maxX < a.minX - EPS || a.maxY < b.minY - EPS || b.maxY < a.minY - EPS); }
  function selfIntersects(pts) {
    var n = pts.length;
    if (n < 4 || n > 3000) return false;
    for (var i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        if (j === i + 1 || (i === 0 && j === n - 1)) continue;
        if (segTouch(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
      }
    }
    return false;
  }
  function polysCross(A, B) {
    for (var i = 0; i < A.length; i++) for (var j = 0; j < B.length; j++)
      if (segCross(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])) return true;
    return false;
  }
  function fmt(n) { return (Math.round(n * 1000) / 1000).toString(); }

  /* ------------------------------------------------------------ DXF parser */
  function records(sp) {
    var out = [], cur = null;
    sp.forEach(function (p) {
      if (p[0] === 0) { cur = { type: p[1].trim(), g: [] }; out.push(cur); } else if (cur) cur.g.push(p);
    });
    return out;
  }
  function gv(rec, code) { for (var i = 0; i < rec.g.length; i++) if (rec.g[i][0] === code) return rec.g[i][1]; return undefined; }
  function gn(rec, code, def) { var v = gv(rec, code); if (v === undefined) return def; var n = parseFloat(v); return isNaN(n) ? def : n; }

  function buildEntity(rec) {
    var e = {
      type: rec.type, layer: (gv(rec, 8) || '0').trim(), handle: gv(rec, 5) ? gv(rec, 5).trim() : null,
      paper: gn(rec, 67, 0) === 1, thickness: gn(rec, 39, 0), lineweight: gn(rec, 370, undefined),
      extrusion: [gn(rec, 210, 0), gn(rec, 220, 0), gn(rec, 230, 1)]
    };
    var c62 = gv(rec, 62);
    if (gv(rec, 420) !== undefined) e.color = { kind: 'truecolor' };
    else if (c62 === undefined) e.color = { kind: 'bylayer' };
    else {
      var n = parseInt(c62, 10);
      e.color = n === 256 ? { kind: 'bylayer' } : n === 0 ? { kind: 'byblock' } : (n >= 1 && n <= 255) ? { kind: 'aci', index: n } : { kind: 'invalid', raw: n };
    }
    if (rec.type === 'LINE') {
      e.p1 = [gn(rec, 10, 0), gn(rec, 20, 0), gn(rec, 30, 0)];
      e.p2 = [gn(rec, 11, 0), gn(rec, 21, 0), gn(rec, 31, 0)];
    } else if (rec.type === 'LWPOLYLINE') {
      var verts = [];
      rec.g.forEach(function (p) {
        var n2 = parseFloat(p[1]);
        if (p[0] === 10) verts.push({ x: n2, y: 0, bulge: 0, sw: 0, ew: 0 });
        else if (verts.length) {
          var l = verts[verts.length - 1];
          if (p[0] === 20) l.y = n2; else if (p[0] === 42) l.bulge = n2; else if (p[0] === 40) l.sw = n2; else if (p[0] === 41) l.ew = n2;
        }
      });
      e.verts = verts; e.flags = gn(rec, 70, 0); e.closed = (e.flags & 1) === 1;
      e.elevation = gn(rec, 38, 0); e.constWidth = gn(rec, 43, 0);
    } else if (rec.type === 'TEXT') {
      e.text = gv(rec, 1) === undefined ? '' : gv(rec, 1);
      e.height = gn(rec, 40, 0); e.p = [gn(rec, 10, 0), gn(rec, 20, 0), gn(rec, 30, 0)];
      e.h72 = gn(rec, 72, 0); e.v73 = gn(rec, 73, 0); e.rotation = gn(rec, 50, 0);
      e.pt = (e.h72 !== 0 || e.v73 !== 0) ? { x: gn(rec, 11, 0), y: gn(rec, 21, 0) } : { x: e.p[0], y: e.p[1] };
    } else if (rec.type === 'POLYLINE') {
      e.flags = gn(rec, 70, 0); e.verts = []; e.is3D = (e.flags & (8 | 16 | 64)) !== 0;
    } else {
      e.p = [gn(rec, 10, 0), gn(rec, 20, 0), gn(rec, 30, 0)];
    }
    return e;
  }

  function parseDxf(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    if (/^AutoCAD Binary DXF/.test(text)) return { binary: true };
    var lines = text.split(/\r\n|\r|\n/);
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    var pairs = [];
    for (var i = 0; i + 1 < lines.length; i += 2) {
      var raw = lines[i].trim();
      if (!/^-?\d+$/.test(raw)) return { invalid: true, line: i + 1 };
      pairs.push([parseInt(raw, 10), lines[i + 1]]);
    }
    var out = { header: {}, layers: {}, entities: [], sectionsFound: 0 };
    i = 0;
    while (i < pairs.length) {
      if (pairs[i][0] === 0 && pairs[i][1].trim() === 'SECTION' && pairs[i + 1] && pairs[i + 1][0] === 2) {
        var name = pairs[i + 1][1].trim().toUpperCase(), j = i + 2;
        while (j < pairs.length && !(pairs[j][0] === 0 && pairs[j][1].trim() === 'ENDSEC')) j++;
        var sp = pairs.slice(i + 2, j);
        out.sectionsFound++;
        if (name === 'HEADER') {
          var cur = null;
          sp.forEach(function (p) { if (p[0] === 9) { cur = p[1].trim(); out.header[cur] = []; } else if (cur) out.header[cur].push(p); });
        } else if (name === 'TABLES') {
          var table = null;
          records(sp).forEach(function (rec) {
            if (rec.type === 'TABLE') table = (gv(rec, 2) || '').trim().toUpperCase();
            else if (rec.type === 'ENDTAB') table = null;
            else if (table === 'LAYER' && rec.type === 'LAYER') {
              var nm = (gv(rec, 2) || '').trim(), fl = gn(rec, 70, 0), col = gn(rec, 62, 7);
              out.layers[nm.toUpperCase()] = { name: nm, frozen: (fl & 1) !== 0, locked: (fl & 4) !== 0, off: col < 0, color: Math.abs(col), lineweight: gn(rec, 370, -3) };
            }
          });
        } else if (name === 'ENTITIES') {
          var heavy = null;
          records(sp).forEach(function (rec) {
            if (rec.type === 'VERTEX') { if (heavy) heavy.verts.push({ x: gn(rec, 10, 0), y: gn(rec, 20, 0), bulge: 0, sw: 0, ew: 0 }); return; }
            if (rec.type === 'SEQEND') { heavy = null; return; }
            var e = buildEntity(rec); e.i = out.entities.length; out.entities.push(e);
            heavy = e.type === 'POLYLINE' ? e : null;
          });
        }
        i = j + 1;
      } else i++;
    }
    return out;
  }

  function loc(e) {
    if (e.type === 'LINE') return { x: e.p1[0], y: e.p1[1] };
    if (e.type === 'TEXT') return e.pt;
    if (e.verts && e.verts.length) return { x: e.verts[0].x, y: e.verts[0].y };
    if (e.p) return { x: e.p[0], y: e.p[1] };
    return null;
  }
  function bboxOf(e) {
    if (e.type === 'LINE') return bboxOfPts([{ x: e.p1[0], y: e.p1[1] }, { x: e.p2[0], y: e.p2[1] }]);
    if (e.type === 'TEXT') return bboxOfPts([e.pt]);
    if (e.verts && e.verts.length) return bboxOfPts(e.verts);
    if (e.p) return bboxOfPts([{ x: e.p[0], y: e.p[1] }]);
    return null;
  }

  /* ------------------------------------------------------------ rule index */
  function buildIndex(rules) {
    var all = [], s = rules.settings;
    [['site', rules.siteObjects], ['floor', rules.floorObjects], ['terrace', rules.terraceServiceObjects]].forEach(function (g) {
      g[1].rules.forEach(function (r) { all.push(Object.assign({ group: g[0] }, r)); });
    });
    all.forEach(function (r) {
      r.kinds = r.layers.slice();
      if (r.group === 'floor' && s.floorObjectsAllowedOnGround) ['ground', 'basement'].forEach(function (k) { if (r.kinds.indexOf(k) < 0) r.kinds.push(k); });
    });
    var lists = {};
    Object.keys(rules.buildingUseText).forEach(function (k) {
      var b = rules.buildingUseText[k];
      lists[k] = { key: k, title: b.title, color: b.color, section: b.section, set: new Set(b.items.map(normText)) };
    });
    lists.nonFar = { key: 'nonFar', title: 'Permissible Non-FAR', color: rules.nonFarText.color, section: '15.0', set: new Set(rules.nonFarText.items.map(normText)) };
    var typical = { floor: new RegExp(rules.typicalFloorText.floorFormat.regex, 'i'), block: new RegExp(rules.typicalFloorText.blockFormat.regex, 'i') };
    var specCache = {};
    function spec(r) {
      if (specCache[r.id]) return specCache[r.id];
      var sp = { lists: [], regexes: [], hasSpec: false, listBased: false }, tf = r.textFormat;
      if (r.textMustBeFromLists) { sp.lists = r.textMustBeFromLists; sp.listBased = true; sp.hasSpec = true; }
      if (tf === 'typicalFloorText') {
        sp.regexes.push({ re: typical.floor, fromExample: false, desc: 'FLOOR01, FLOOR02...-TYPICAL' });
        sp.regexes.push({ re: typical.block, fromExample: false, desc: 'BLOCK01, BLOCK02...-TYPICAL' });
        sp.hasSpec = true;
      } else if (tf && tf.regex) {
        sp.regexes.push({ re: new RegExp(tf.regex, 'i'), fromExample: !!tf.fromExample, desc: tf.example || tf.regex });
        sp.hasSpec = true;
      }
      specCache[r.id] = sp; return sp;
    }
    return { all: all, lists: lists, typical: typical, spec: spec, layerPatterns: rules.layerRules.patterns.map(function (p) { return { kind: p.kind, re: new RegExp(p.regex, 'i') }; }) };
  }

  /* ------------------------------------------------------------ main check */
  function check(dxfText, rules) {
    var idx = buildIndex(rules), S = rules.settings, issues = [];
    var notChecked = [
      'Floor labels (every floor labelled): the manual does not define how a floor is labelled.',
      'Password protection: cannot be detected in DXF.',
      'Scale 1:1: cannot be proven from DXF geometry. Only the drawing units are checked.',
      'Arc segments (bulges) are treated as straight chords in overlap, containment and self-intersection tests.',
      'Whether objects are physically correct (for example stair polyline inside the stair well wall).'
    ];

    function add(sev, code, message, ent, extra) {
      var l = ent ? loc(ent) : null;
      issues.push(Object.assign({
        severity: sev, code: code, title: CODES[code] || code, message: message, ruleId: null,
        layer: ent ? ent.layer : null, entityType: ent ? ent.type : null, handle: ent ? ent.handle : null,
        ei: ent ? ent.i : null, x: l ? l.x : null, y: l ? l.y : null
      }, extra || {}));
    }
    function finish(doc, processed, ignored) {
      var order = { error: 0, warning: 1, info: 2 };
      issues.sort(function (a, b) { return order[a.severity] - order[b.severity] || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0) || (a.ei || 0) - (b.ei || 0); });
      var counts = { error: 0, warning: 0, info: 0 };
      issues.forEach(function (i) { counts[i.severity]++; });
      var byLayer = {};
      (processed || []).forEach(function (e) { var b = byLayer[e.layer] || (byLayer[e.layer] = { total: 0, types: {} }); b.total++; b.types[e.type] = (b.types[e.type] || 0) + 1; });
      var ents = doc && doc.entities ? doc.entities.map(function (e) {
        var o = { i: e.i, type: e.type, layer: e.layer, kind: e.kind, ignored: e.kind === null, colorKind: e.color.kind, aci: e.color.index || null, rules: (e.matched || []).map(function (r) { return r.id; }), handle: e.handle };
        if (e.type === 'LINE') { o.p1 = e.p1; o.p2 = e.p2; } else if (e.verts) { o.verts = e.verts; o.closed = !!e.closed; } else if (e.type === 'TEXT') { o.text = e.text; o.pt = e.pt; o.height = e.height; o.rot = e.rotation; } else if (e.p) o.p = e.p;
        return o;
      }) : [];
      return {
        engineVersion: VERSION, rulesVersion: rules.meta.rulesVersion, manualVersion: rules.meta.manualVersion || '', pass: counts.error === 0,
        summary: { errors: counts.error, warnings: counts.warning, info: counts.info, entitiesTotal: doc && doc.entities ? doc.entities.length : 0, entitiesChecked: (processed || []).length, entitiesIgnored: (ignored || []).length, byLayer: byLayer },
        issues: issues, notChecked: notChecked,
        drawing: { entities: ents, layers: doc && doc.layers ? doc.layers : {}, header: doc ? { insUnits: doc.insUnits, acadVer: doc.acadVer } : {} }
      };
    }

    /* ---- parse ---- */
    var doc = parseDxf(String(dxfText));
    if (doc.binary) { add('error', 'F-BINARY', 'This is a binary DXF. Save as ASCII DXF (in AutoCAD: SAVEAS, choose AutoCAD 2018/2013/2010 DXF).'); return finish(null); }
    if (doc.invalid) { add('error', 'F-INVALID', 'Not a valid ASCII DXF file (bad group code at line ' + doc.line + ').'); return finish(null); }
    if (!doc.sectionsFound || !doc.entities.length) { add('error', 'F-INVALID', 'No ENTITIES section found, or the drawing is empty.'); return finish(doc); }

    doc.insUnits = doc.header['$INSUNITS'] ? parseInt(doc.header['$INSUNITS'][0][1], 10) : undefined;
    doc.acadVer = doc.header['$ACADVER'] ? doc.header['$ACADVER'][0][1].trim() : undefined;
    if (doc.acadVer === 'AC1009' || doc.acadVer === 'AC1006') add('info', 'F-VERSION', 'DXF version ' + doc.acadVer + ' (R12 or older) has no lightweight polylines. Save as a newer DXF version.');
    if (doc.insUnits === 6) { /* metres - ok */ } else if (doc.insUnits === undefined || doc.insUnits === 0)
      add('warning', 'F-UNITS', 'Drawing units are not set (unitless). The manual requires metres: set UNITS to Meters (INSUNITS = 6).');
    else add('error', 'F-UNITS', 'Drawing units are not metres (INSUNITS = ' + doc.insUnits + '). The manual requires metres at scale 1:1.');

    /* ---- layer classification ---- */
    var prefix = up(S.processedLayerPrefix);
    function classify(name) {
      if (up(name).indexOf(prefix) !== 0) return null;
      for (var k = 0; k < idx.layerPatterns.length; k++) if (idx.layerPatterns[k].re.test(name)) return idx.layerPatterns[k].kind === 'parking' ? 'ground' : idx.layerPatterns[k].kind;
      return 'unknown';
    }
    var processed = [], ignored = [];
    doc.entities.forEach(function (e) { e.kind = classify(e.layer); (e.kind === null ? ignored : processed).push(e); });
    if (!processed.length) { add('error', 'F-NOFLOOR', 'No objects found on layers starting with FLOOR. Smart DCR ignores every other layer.'); return finish(doc, processed, ignored); }

    var layerInfo = {};
    processed.forEach(function (e) { var u = up(e.layer); (layerInfo[u] = layerInfo[u] || { name: e.layer, count: 0 }).count++; });
    Object.keys(doc.layers).forEach(function (u) { if (classify(doc.layers[u].name) !== null && !layerInfo[u]) layerInfo[u] = { name: doc.layers[u].name, count: 0 }; });
    var lwWarned = {};
    Object.keys(layerInfo).forEach(function (u) {
      var li = layerInfo[u], kind = classify(li.name), L = doc.layers[u];
      if (kind === 'unknown')
        add(li.count ? 'error' : 'warning', 'L-NAME', 'Layer "' + li.name + '" starts with FLOOR but is not a valid Smart DCR layer name (' + li.count + ' objects). Allowed: FLOORnn, FLOOR-GROUND, FLOOR-PARKING, FLOOR-BFn, FLOOR-SERVICE, FLOOR-TERRACE, FLOOR-TERRACEINTERMEDIATE (01, 02...), FLOOR-MEZZANINE.' + (li.count ? '' : ' It is empty: purge it.'), null, { layer: li.name });
      if (L) {
        var st = []; if (L.locked) st.push('locked'); if (L.frozen) st.push('frozen'); if (L.off) st.push('turned off');
        if (st.length) add('error', 'L-STATE', 'Layer "' + li.name + '" is ' + st.join(', ') + '. Unlock, unfreeze and turn on all layers before submission.', null, { layer: li.name });
      }
    });

    /* ---- per-entity checks ---- */
    var polys = [], texts = [], badPolyKeys = {};
    function matchEntity(e) {
      var col = e.color.index, et = e.type;
      var byColor = idx.all.filter(function (r) { return r.color === col; });
      function names(rs) { var s = []; rs.forEach(function (r) { if (s.indexOf(r.name) < 0) s.push(r.name); }); return s.join(' / '); }
      if (!byColor.length) return { problem: 'Colour ' + col + ' is not used for any object in the manual.' };
      var byType = byColor.filter(function (r) { return r.types.indexOf(et) >= 0; });
      if (!byType.length) {
        var tn = []; byColor.forEach(function (r) { r.types.forEach(function (t) { if (t !== 'TEXT' || r.types.length === 1) { var n = TYPE_NAME[t]; if (tn.indexOf(n) < 0) tn.push(n); } else { if (tn.indexOf('Text') < 0) tn.push('Text'); } }); });
        return { problem: 'Colour ' + col + ' (' + names(byColor) + ') must be drawn as ' + tn.join(' or ') + ', not as ' + TYPE_NAME[et] + '.' };
      }
      var byLayer = byType.filter(function (r) { return r.kinds.indexOf(e.kind) >= 0; });
      if (!byLayer.length) {
        var ks = []; byType.forEach(function (r) { r.kinds.forEach(function (k) { if (ks.indexOf(KIND_NAME[k]) < 0) ks.push(KIND_NAME[k]); }); });
        return { problem: 'Colour ' + col + ' ' + TYPE_NAME[et] + ' (' + names(byType) + ') must be on layer ' + ks.join(' or ') + ', not on ' + e.layer + '.' };
      }
      return { rules: byLayer };
    }

    processed.forEach(function (e) {
      var ang;
      if (e.paper) { add('error', 'E-PAPER', 'Object is in paper space. All objects must be in model space.', e); e.skip = true; return; }
      if (FORBID[e.type]) { add('error', 'E-FORBIDDEN', FORBID[e.type] + '.', e); e.skip = true; return; }
      if (e.type === 'POLYLINE') {
        add('error', 'E-FORBIDDEN', e.is3D ? '3D polyline / mesh is not supported.' : 'Heavy 2D POLYLINE found. Only lightweight polylines (LWPOLYLINE) are supported: convert it.', e); e.skip = true; return;
      }
      if (S.allowedEntityTypes.indexOf(e.type) < 0) {
        add(S.unlistedEntityTypes === 'error' ? 'error' : 'warning', 'E-UNLISTED', e.type + ' on a FLOOR layer. Smart DCR processes only Lines, Polylines and Text; this object will be ignored or may fail Pre-Check.', e); e.skip = true; return;
      }

      /* geometry properties */
      var zbad = false;
      if (e.type === 'LINE') zbad = Math.abs(e.p1[2]) > ZERO || Math.abs(e.p2[2]) > ZERO;
      else if (e.type === 'LWPOLYLINE') zbad = Math.abs(e.elevation) > ZERO;
      else if (e.type === 'TEXT') zbad = Math.abs(e.p[2]) > ZERO;
      if (zbad) add('error', 'E-Z', 'Object has a non-zero Z coordinate / elevation. All objects must be 2D at elevation 0.', e);
      if (Math.abs(e.extrusion[0]) > ZERO || Math.abs(e.extrusion[1]) > ZERO || Math.abs(e.extrusion[2] - 1) > ZERO)
        add('error', 'E-EXTRUSION', 'Object is not in the XY plane (top view). Do not import data from 3D CAD.', e);
      if (Math.abs(e.thickness) > ZERO) add('error', 'E-THICK', 'Object thickness is ' + fmt(e.thickness) + '. It must be 0.00.', e);
      if (e.type === 'LWPOLYLINE') {
        var wbad = Math.abs(e.constWidth) > ZERO || e.verts.some(function (v) { return Math.abs(v.sw) > ZERO || Math.abs(v.ew) > ZERO; });
        if (wbad) add('error', 'E-WIDTH', 'Polyline has a non-zero global / segment width. It must be 0.00.', e);
      }
      var L = doc.layers[up(e.layer)];
      if (e.lineweight !== undefined && e.lineweight > 0) add('error', 'E-LW', 'Line weight is ' + (e.lineweight / 100) + ' mm. It must be 0.00.', e);
      else if ((e.lineweight === undefined || e.lineweight === -1) && L && L.lineweight > 0 && !lwWarned[up(e.layer)]) {
        lwWarned[up(e.layer)] = true;
        add('warning', 'E-LW', 'Layer "' + e.layer + '" has line weight ' + (L.lineweight / 100) + ' mm and objects inherit it. The manual requires line weight 0.00.', e);
      }
      if (e.type === 'LINE' && Math.hypot(e.p1[0] - e.p2[0], e.p1[1] - e.p2[1]) < EPS) add('warning', 'E-ZEROLEN', 'Line has zero length.', e);

      /* text */
      if (e.type === 'TEXT') {
        if (!e.text.trim()) add('error', 'E-TEXT-EMPTY', 'Text object is empty.', e);
        if (e.height <= S.minTextHeightExclusive + ZERO) add('error', 'E-TEXT-HEIGHT', 'Text height is ' + fmt(e.height) + ' m. It must be greater than ' + S.minTextHeightExclusive + ' m.', e);
        if (/\\P/i.test(e.text)) add('error', 'E-TEXT-MULTILINE', 'Text contains a line break. Text must be a single line.', e);
      }

      /* colour */
      var ck = e.color.kind;
      if (ck !== 'aci') {
        var why = ck === 'bylayer' ? 'ByLayer' : ck === 'byblock' ? 'ByBlock' : ck === 'truecolor' ? 'a true colour (RGB)' : 'invalid';
        add('error', 'E-COLOR', 'Object colour is ' + why + '. Set the colour on the object itself to an index colour (ACI) from the manual.', e);
        return;
      }
      if (e.kind === 'unknown') return;
      var m = matchEntity(e);
      if (m.problem) { add('error', 'E-MATCH', m.problem, e); return; }
      e.matched = m.rules;
      if (m.rules.length === 1) { /* attach for report */ }
      if (e.type === 'TEXT') { e.col = e.color.index; texts.push(e); validateText(e); }
      if (e.type === 'LWPOLYLINE') polyChecks(e);
    });

    function validateText(e) {
      var tr = e.matched.filter(function (r) { return r.types.indexOf('TEXT') >= 0; });
      var specs = tr.map(function (r) { return idx.spec(r); });
      if (!tr.length || specs.some(function (s) { return !s.hasSpec; })) return;
      var t = normText(e.text), ok = false, strict = false;
      specs.forEach(function (s) {
        if (s.lists.some(function (k) { return idx.lists[k].set.has(t); })) ok = true;
        if (s.regexes.some(function (x) { return x.re.test(t); })) ok = true;
        if (s.listBased || s.regexes.some(function (x) { return !x.fromExample; })) strict = true;
      });
      if (ok) return;
      var hint = '', hits = Object.keys(idx.lists).map(function (k) { return idx.lists[k]; }).filter(function (l) { return l.set.has(t); });
      if (hits.length) hint = ' This text belongs to ' + hits.map(function (l) { return l.title + ' (colour ' + l.color + ', section ' + l.section + ')'; }).join(' or ') + '.';
      else {
        var secs = [], fm = [];
        specs.forEach(function (s) { s.lists.forEach(function (k) { secs.push(idx.lists[k].section); }); s.regexes.forEach(function (x) { fm.push(x.desc); }); });
        if (secs.length) hint += ' It must be exactly one of the permitted texts in section ' + secs.join(', ') + '.';
        if (fm.length) hint += ' Expected format like: ' + fm.join(' | ') + '.';
      }
      add(strict ? 'error' : 'warning', 'E-TEXT-INVALID', 'Text "' + e.text.trim() + '" (colour ' + e.color.index + ') is not permitted here.' + (strict ? '' : ' (format taken from a manual example)') + hint, e, { ruleId: e.matched.map(function (r) { return r.id; }).join(',') });
    }

    function cleanPts(verts) {
      var pts = [];
      verts.forEach(function (v) { var p = { x: v.x, y: v.y }, l = pts[pts.length - 1]; if (!l || dist(l, p) > EPS) pts.push(p); });
      var dupClose = false;
      if (pts.length > 1 && dist(pts[0], pts[pts.length - 1]) <= EPS) { pts.pop(); dupClose = true; }
      return { pts: pts, dupClose: dupClose, dups: verts.length - pts.length - (dupClose ? 1 : 0) };
    }

    function polyChecks(e) {
      var c = cleanPts(e.verts), hasBulge = e.verts.some(function (v) { return Math.abs(v.bulge) > ZERO; });
      var requiresClosed = S.polylinesMustBeClosedDefault && e.matched.every(function (r) { return r.closed !== null; });
      var bad = function () { badPolyKeys[up(e.layer) + '|' + e.color.index] = true; };
      if (c.dups > 0) add('warning', 'E-DUPVERT', c.dups + ' duplicate vertex/vertices in polyline. Avoid unnecessary coordinates.', e);
      var geomClosed = e.closed || c.dupClose;
      if (requiresClosed) {
        if (!e.closed) {
          if (c.dupClose) add('warning', 'E-CLOSE-FLAG', 'Polyline ends where it starts but is not set to Closed. Use the Close option.', e);
          else { add('error', 'E-CLOSE', 'Polyline is not closed.', e); bad(); return; }
        }
        if (c.pts.length < 3) { add('error', 'E-VERTS', 'Closed polyline has fewer than 3 distinct vertices.', e); bad(); return; }
        if (!hasBulge && selfIntersects(c.pts)) { add('error', 'E-SELFX', 'Polyline crosses or touches itself.', e); bad(); return; }
        if (polyArea(c.pts) < 1e-9) { add('error', 'E-AREA', 'Polyline has zero area.', e); bad(); return; }
      }
      if (geomClosed && c.pts.length >= 3) {
        polys.push({ ent: e, pts: c.pts, hasBulge: hasBulge, bbox: bboxOfPts(c.pts), layerU: up(e.layer), color: e.color.index, ids: e.matched.map(function (r) { return r.id; }) });
      }
    }

    /* ---- helpers on polygons ---- */
    function polysByRule(ids) { return polys.filter(function (P) { return P.ids.some(function (id) { return ids.indexOf(id) >= 0; }); }); }
    function insideAny(P, containers, sameLayer) {
      return containers.some(function (C) { return (!sameLayer || C.layerU === P.layerU) && P.pts.every(function (p) { return pointInPoly(p, C.pts); }); });
    }

    /* ---- polygon <-> text association ---- */
    polys.forEach(function (P) {
      var tr = P.ent.matched.filter(function (r) { return r.types.indexOf('TEXT') >= 0; });
      if (!tr.length) return;
      var specs = tr.map(function (r) { return idx.spec(r); });
      var inside = texts.filter(function (T) { return up(T.layer) === P.layerU && T.col === P.color && pointInPoly(T.pt, P.pts); });
      P.texts = inside;
      var isBlock = tr.some(function (r) { return r.id === 'SITE-14'; });
      if (inside.length) return;
      if (isBlock) { add('error', 'E-BLOCK-LABEL', 'Block rectangle (colour 50) has no block name text (for example BLOCK-A) inside it, in the same colour.', P.ent, { ruleId: 'SITE-14' }); return; }
      if (specs.some(function (s) { return !s.hasSpec; })) return;
      var strong = specs.some(function (s) { return s.listBased || s.regexes.some(function (x) { return !x.fromExample; }); });
      var secs = []; specs.forEach(function (s) { s.lists.forEach(function (k) { secs.push(idx.lists[k].section); }); });
      add(strong ? 'error' : 'warning', 'E-TEXT-MISSING', 'No text inside this boundary. Colour ' + P.color + ' needs a text in the same colour' + (secs.length ? ' from the permitted list (section ' + secs.join(', ') + ')' : '') + ', placed inside the polyline.', P.ent, { ruleId: P.ids.join(',') });
    });
    texts.forEach(function (T) {
      var tr = T.matched.filter(function (r) { return r.types.indexOf('TEXT') >= 0; });
      if (!tr.length || !T.matched.every(function (r) { return r.types.indexOf('LWPOLYLINE') >= 0; })) return;
      if (tr.some(function (r) { return !idx.spec(r).hasSpec; })) return;
      if (badPolyKeys[up(T.layer) + '|' + T.col]) return;
      var inAny = polys.some(function (P) { return P.layerU === up(T.layer) && P.color === T.col && pointInPoly(T.pt, P.pts); });
      if (!inAny) add('warning', 'E-TEXT-ORPHAN', 'Text "' + T.text.trim() + '" is not inside a polyline of the same colour (' + T.col + ') on this layer.', T, { ruleId: T.matched.map(function (r) { return r.id; }).join(',') });
    });

    /* ---- containment ---- */
    var FAR = ['FLR-01', 'FLR-02', 'FLR-03', 'FLR-04', 'FLR-05'];
    function containment(ids, containerIds, sev, label, sameLayer) {
      var containers = polysByRule(containerIds);
      polysByRule(ids).forEach(function (P) {
        var cs = sameLayer ? containers.filter(function (C) { return C.layerU === P.layerU; }) : containers;
        if (!cs.length) { add(sev, 'E-CONTAIN', label + ': no required boundary found' + (sameLayer ? ' on layer ' + P.ent.layer : '') + '.', P.ent, { ruleId: ids[0] }); return; }
        if (!insideAny(P, cs, false)) add(sev, 'E-CONTAIN', label + ': object is not completely inside the required boundary.', P.ent, { ruleId: ids[0] });
      });
    }
    if (polysByRule(['SITE-02']).length) containment(['SITE-03'], ['SITE-02'], 'error', 'Duct area (colour 19) must be inside the setback / ground coverage boundary (colour 10)', false);
    containment(['FLR-11'], FAR, 'error', 'Facility area (colour 54) must be drawn inside the FAR boundary', true);
    containment(['FLR-07'], FAR, 'warning', 'Void / duct deduction (colour 3) should be within the FAR boundary', true);
    var blocks = polysByRule(['SITE-14']);
    if (blocks.length) {
      polys.filter(function (P) { return P.ids.some(function (id) { return FAR.indexOf(id) >= 0 || id === 'SITE-02'; }); }).forEach(function (P) {
        if (!insideAny(P, blocks, false)) add('error', 'E-BLOCK-OUTSIDE', 'Floor plan is not completely inside a block rectangle (colour 50).', P.ent, { ruleId: 'SITE-14' });
      });
    }

    /* ---- duplicates and overlaps ---- */
    var seen = {};
    function r6(n) { return (Math.round(n * 1e6) / 1e6).toFixed(6); }
    processed.forEach(function (e) {
      if (e.skip || e.color.kind !== 'aci' || !e.matched) return;
      var key = e.type + '|' + up(e.layer) + '|' + e.color.index + '|';
      if (e.type === 'LINE') { var a = r6(e.p1[0]) + ',' + r6(e.p1[1]), b = r6(e.p2[0]) + ',' + r6(e.p2[1]); key += a < b ? a + ';' + b : b + ';' + a; }
      else if (e.type === 'TEXT') key += normText(e.text) + '@' + r6(e.pt.x) + ',' + r6(e.pt.y);
      else key += e.verts.map(function (v) { return r6(v.x) + ',' + r6(v.y); }).join(';');
      if (seen[key]) add('warning', 'E-DUP', 'Duplicate of an identical object (handle ' + (seen[key].handle || '?') + '). Do not overlap objects.', e);
      else seen[key] = e;
    });
    var groups = {};
    polys.forEach(function (P) { (groups[P.layerU + '|' + P.color] = groups[P.layerU + '|' + P.color] || []).push(P); });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      if (g.length > 400) return;
      for (var i = 0; i < g.length; i++) for (var j = i + 1; j < g.length; j++) {
        if (g[i].hasBulge || g[j].hasBulge || !bboxOverlap(g[i].bbox, g[j].bbox)) continue;
        if (polysCross(g[i].pts, g[j].pts)) add('warning', 'E-OVERLAP', 'This polyline overlaps another of the same colour (handle ' + (g[j].ent.handle || '?') + '). Do not overlap objects.', g[i].ent);
      }
    });

    /* ---- bounding rectangle ---- */
    var rects = processed.filter(function (e) { return !e.skip && e.type === 'LWPOLYLINE' && e.matched && e.matched.some(function (r) { return r.id === 'SITE-15'; }); });
    if (rects.length) {
      if (rects.length > 1) add('warning', 'E-RECT-MULTI', rects.length + ' polylines use the bounding-rectangle colour 61. Keep one rectangle containing the whole drawing.', rects[1], { ruleId: 'SITE-15' });
      var R = rects[0], rc = cleanPts(R.verts), bb = bboxOfPts(rc.pts);
      var rectOk = rc.pts.length === 4 && !R.verts.some(function (v) { return Math.abs(v.bulge) > ZERO; }) &&
        rc.pts.every(function (p, i) { var q = rc.pts[(i + 1) % 4]; return Math.abs(p.x - q.x) < EPS || Math.abs(p.y - q.y) < EPS; });
      if (!rectOk) add('error', 'E-RECT-SHAPE', 'The colour 61 bounding polyline must be a rectangle (4 corners, horizontal and vertical sides).', R, { ruleId: 'SITE-15' });
      if (Math.abs(bb.minX) > 1e-3 || Math.abs(bb.minY) > 1e-3) add('error', 'E-RECT-ORIGIN', 'Lower-left corner of the bounding rectangle is at (' + fmt(bb.minX) + ', ' + fmt(bb.minY) + '). It must be at 0,0,0.', R, { ruleId: 'SITE-15' });
      processed.forEach(function (e) {
        if (e.skip || rects.indexOf(e) >= 0) return;
        var b = bboxOf(e);
        if (b && (b.minX < bb.minX - EPS || b.minY < bb.minY - EPS || b.maxX > bb.maxX + EPS || b.maxY > bb.maxY + EPS))
          add('error', 'E-OUTSIDE', 'Object lies outside the bounding rectangle. Anything outside it is not scrutinised.', e);
      });
    }

    /* ---- mandatory items ---- */
    (rules.mandatory || []).forEach(function (m) {
      var found = processed.some(function (e) { return e.matched && e.matched.some(function (r) { return m.anyOfRuleIds.indexOf(r.id) >= 0; }); });
      if (!found) add(m.severity || 'error', 'E-MANDATORY', 'Mandatory item missing: ' + m.name + '.', null, { ruleId: m.anyOfRuleIds.join(',') });
    });

    return finish(doc, processed, ignored);
  }

  return { version: VERSION, check: check, parseDxf: parseDxf, CODES: CODES };
});
