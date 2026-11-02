// Run: node test-report.js   (needs: npm i jspdf  for the PDF part)
const fs = require('fs'), path = require('path');
const { check, parseDxf } = require('./udma-smart-dcr-checker.js');
const { makeMarkedDxf, makePdf } = require('./report.js');
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, 'rules.json'), 'utf8'));
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };

for (const [name, crlf] of [['bad.dxf', false], ['bad.dxf', true], ['good.dxf', false]]) {
  let text = fs.readFileSync(path.join(__dirname, 'test', name), 'utf8'); if (crlf) text = text.replace(/\n/g, '\r\n');
  const res = check(text, rules), m = makeMarkedDxf(text, res), tag = name + (crlf ? ' (CRLF)' : '');
  const before = parseDxf(text), after = parseDxf(m.dxf), again = check(m.dxf, rules);
  const added = after.entities.length - before.entities.length;
  ok(added >= 0 && (name === 'good.dxf' ? added === 0 : added > 10), tag + ': ' + added + ' entities added, ' + m.marks + ' marks');
  ok(after.entities.slice(before.entities.length).every(e => e.layer === 'NONCOMPLIANT'), tag + ': every added object is on NONCOMPLIANT');
  ok(name === 'good.dxf' ? !after.layers['NONCOMPLIANT'] : !!after.layers['NONCOMPLIANT'], tag + ': NONCOMPLIANT layer defined in the layer table when needed');
  ok(again.summary.errors === res.summary.errors && again.summary.warnings === res.summary.warnings, tag + ': re-checking the marked DXF gives identical results (' + again.summary.errors + '/' + again.summary.warnings + ')');
  const L = m.dxf.split(/\r?\n/), hs = []; let seed = null;
  for (let i = 0; i + 1 < L.length; i += 2) { if (L[i].trim() === '5') { if (i >= 2 && L[i - 1].trim() === '$HANDSEED') seed = parseInt(L[i + 1], 16); else hs.push(parseInt(L[i + 1], 16)); } }
  ok(new Set(hs).size === hs.length && hs.length > 0, tag + ': ' + hs.length + ' handles, all unique');
  ok(seed !== null && Math.max(...hs) < seed, tag + ': $HANDSEED (' + seed.toString(16) + ') above every handle');
  ok(crlf ? /\r\n/.test(m.dxf) && !/[^\r]\n/.test(m.dxf) : !/\r/.test(m.dxf), tag + ': line endings preserved');
}
try { makeMarkedDxf('0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n', check(fs.readFileSync(path.join(__dirname, 'test/good.dxf'), 'utf8'), rules)); ok(false, 'missing ENTITIES should throw'); } catch (e) { ok(/ENTITIES/.test(e.message), 'missing ENTITIES section throws a clear error'); }

let JsPDF; try { JsPDF = require('jspdf').jsPDF; } catch (e) { try { JsPDF = require('/home/claude/t/node_modules/jspdf').jsPDF; } catch (e2) { console.log('(jspdf not installed: PDF test skipped)'); } }
if (JsPDF) {
  const res = check(fs.readFileSync(path.join(__dirname, 'test/bad.dxf'), 'utf8'), rules);
  const snap = fs.existsSync('/tmp/snap.png') ? { dataUrl: 'data:image/png;base64,' + fs.readFileSync('/tmp/snap.png').toString('base64'), w: 1600, h: 1000 } : null;
  const doc = makePdf(JsPDF, res, { fileName: 'sample-faulty.dxf', when: '2026-10-31 12:00' }, snap);
  const buf = Buffer.from(doc.output('arraybuffer')); fs.writeFileSync('/tmp/report-bad.pdf', buf);
  ok(buf.slice(0, 5).toString() === '%PDF-' && doc.getNumberOfPages() >= 2, 'PDF built: ' + buf.length + ' bytes, ' + doc.getNumberOfPages() + ' pages');
  const good = makePdf(JsPDF, check(fs.readFileSync(path.join(__dirname, 'test/good.dxf'), 'utf8'), rules), { fileName: 'weird \u0905\u0906 name <b>.dxf', when: 'now' }, null);
  ok(good.getNumberOfPages() === 1, 'clean-drawing PDF is one page and non-Latin file names do not crash');
  fs.writeFileSync('/tmp/report-good.pdf', Buffer.from(good.output('arraybuffer')));
}
console.log(fail ? fail + ' FAILED' : 'report tests passed'); process.exit(fail ? 1 : 0);
