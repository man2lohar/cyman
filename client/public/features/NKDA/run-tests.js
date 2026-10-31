// Run: node make-test-dxf.js && node run-tests.js   (optional: node run-tests.js yourfile.dxf)
const fs = require('fs'), path = require('path');
const { check } = require('./nkda-checker.js');
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, 'rules.json'), 'utf8'));

function report(name, res) {
  console.log('\n=== ' + name + ' === ' + (res.pass ? 'PASS' : 'FAIL') + '  errors ' + res.summary.errors + ', warnings ' + res.summary.warnings + ', info ' + res.summary.info +
    '  (checked ' + res.summary.entitiesChecked + ', ignored ' + res.summary.entitiesIgnored + ')');
  res.issues.forEach(i => console.log('  [' + i.severity.toUpperCase().padEnd(7) + '] ' + i.code.padEnd(15) + (i.layer ? i.layer + ' ' : '') + '- ' + i.message));
}

if (process.argv[2]) { report(process.argv[2], check(fs.readFileSync(process.argv[2], 'utf8'), rules)); process.exit(0); }

let failed = 0;
function expect(cond, msg) { if (!cond) { failed++; console.log('  ASSERT FAILED: ' + msg); } }

const good = check(fs.readFileSync(path.join(__dirname, 'test/good.dxf'), 'utf8'), rules);
report('good.dxf', good);
expect(good.pass, 'good.dxf must pass');
expect(good.summary.errors === 0 && good.summary.warnings === 0, 'good.dxf must have no errors or warnings');
expect(good.summary.entitiesIgnored === 3, 'A-WALL objects (3) must be ignored');

const bad = check(fs.readFileSync(path.join(__dirname, 'test/bad.dxf'), 'utf8'), rules);
report('bad.dxf', bad);
const codes = new Set(bad.issues.map(i => i.code));
['F-UNITS', 'L-NAME', 'L-STATE', 'E-FORBIDDEN', 'E-Z', 'E-THICK', 'E-TEXT-HEIGHT', 'E-COLOR', 'E-MATCH', 'E-TEXT-INVALID', 'E-TEXT-MISSING',
 'E-CLOSE', 'E-SELFX', 'E-OUTSIDE', 'E-RECT-ORIGIN', 'E-DUP', 'E-OVERLAP'].forEach(c => expect(codes.has(c), 'bad.dxf should report ' + c));
expect(!bad.pass, 'bad.dxf must fail');
const msg = c => bad.issues.filter(i => i.code === c).map(i => i.message).join(' | ');
expect(/Business/.test(msg('E-TEXT-INVALID')), 'wrong-colour OFFICE should hint at Business');
expect(!bad.issues.some(i => /school/i.test(i.message)), 'lowercase "school" must be accepted');

// layer strictness: floor-area objects must not be on FLOOR-GROUND
const onGround = fs.readFileSync(path.join(__dirname, 'test/good.dxf'), 'utf8').replace(/8\nFLOOR01\n62\n6\n/, '8\nFLOOR-GROUND\n62\n6\n');
const og = check(onGround, rules);
expect(og.issues.some(i => i.code === 'E-MATCH' && /FLOOR01, FLOOR02/.test(i.message) && i.layer === 'FLOOR-GROUND'), 'colour 6 floor area on FLOOR-GROUND must be an E-MATCH error naming FLOOR01, FLOOR02...');

// empty / ignored-only drawing, binary and garbage input
const only = '0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nA-WALL\n10\n0\n20\n0\n11\n1\n21\n1\n0\nENDSEC\n0\nEOF\n';
expect(check(only, rules).issues.some(i => i.code === 'F-NOFLOOR'), 'no FLOOR layers should be reported');
expect(check('AutoCAD Binary DXF\r\n', rules).issues.some(i => i.code === 'F-BINARY'), 'binary DXF should be reported');
expect(check('hello world', rules).issues.some(i => i.code === 'F-INVALID'), 'garbage should be reported');

console.log('\n' + (failed ? failed + ' assertion(s) FAILED' : 'All assertions passed'));
process.exit(failed ? 1 : 0);
