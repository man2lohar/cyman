// Generates test/good.dxf and test/bad.dxf for the UD&MA checker.  Run: node make-test-dxf.js
const fs = require('fs'), path = require('path');

class Dxf {
  constructor(units) { this.units = units; this.layers = []; this.ents = []; this.h = 0x100; }
  layer(name, o = {}) { this.layers.push({ name, color: o.color || 7, flags: o.flags || 0, lw: o.lw }); return this; }
  hd() { return (this.h++).toString(16).toUpperCase(); }
  base(type, layer, color, extra) {
    const a = [[0, type], [5, this.hd()], [100, 'AcDbEntity'], [8, layer]];
    if (color !== null && color !== undefined) a.push([62, color]);
    (extra || []).forEach(p => a.push(p));
    return a;
  }
  line(layer, color, p1, p2, extra) {
    const a = this.base('LINE', layer, color, extra);
    a.push([100, 'AcDbLine'], [10, p1[0]], [20, p1[1]], [30, p1[2] || 0], [11, p2[0]], [21, p2[1]], [31, p2[2] || 0]);
    this.ents.push(a); return this;
  }
  poly(layer, color, pts, o = {}) {
    const a = this.base('LWPOLYLINE', layer, color, o.pre);
    a.push([100, 'AcDbPolyline'], [90, pts.length], [70, o.closed === false ? 0 : 1], [43, o.width || 0]);
    if (o.elevation) a.push([38, o.elevation]);
    if (o.thickness) a.push([39, o.thickness]);
    pts.forEach(p => { a.push([10, p[0]], [20, p[1]]); });
    this.ents.push(a); return this;
  }
  rect(layer, color, x1, y1, x2, y2, o) { return this.poly(layer, color, [[x1, y1], [x2, y1], [x2, y2], [x1, y2]], o); }
  text(layer, color, pt, h, str, extra) {
    const a = this.base('TEXT', layer, color, extra);
    a.push([100, 'AcDbText'], [10, pt[0]], [20, pt[1]], [30, 0], [40, h], [1, str], [100, 'AcDbText']);
    this.ents.push(a); return this;
  }
  raw(type, layer, color, extra) { this.ents.push(this.base(type, layer, color, extra)); return this; }
  toString() {
    const o = [];
    const w = (c, v) => o.push(String(c), String(v));
    w(0, 'SECTION'); w(2, 'HEADER'); w(9, '$ACADVER'); w(1, 'AC1027'); w(9, '$INSUNITS'); w(70, this.units); w(9, '$HANDSEED'); w(5, (this.h + 16).toString(16).toUpperCase()); w(0, 'ENDSEC');
    w(0, 'SECTION'); w(2, 'TABLES'); w(0, 'TABLE'); w(2, 'LAYER'); w(70, this.layers.length);
    this.layers.forEach(l => { w(0, 'LAYER'); w(2, l.name); w(70, l.flags); w(62, l.color); w(6, 'Continuous'); if (l.lw !== undefined) w(370, l.lw); });
    w(0, 'ENDTAB'); w(0, 'ENDSEC');
    w(0, 'SECTION'); w(2, 'ENTITIES');
    this.ents.forEach(a => a.forEach(p => w(p[0], p[1])));
    w(0, 'ENDSEC'); w(0, 'EOF');
    return o.join('\n') + '\n';
  }
}

function good() {
  const d = new Dxf(6);
  ['FLOOR-GROUND', 'FLOOR01', 'FLOOR-TERRACE', 'A-WALL'].forEach(n => d.layer(n));
  const G = 'FLOOR-GROUND', F = 'FLOOR01', T = 'FLOOR-TERRACE';
  d.rect(G, 61, 0, 0, 100, 80);
  d.rect(G, 7, 10, 10, 90, 70);
  d.rect(G, 10, 20, 20, 80, 60);
  d.rect(G, 19, 30, 30, 34, 34);
  d.line(G, 4, [10, 10], [90, 10]); d.line(G, 3, [10, 70], [90, 70]);
  d.line(G, 6, [10, 10], [10, 70]); d.line(G, 2, [90, 10], [90, 70]);
  d.line(G, 41, [50, 2], [50, 10]);
  d.line(G, 151, [95, 10], [95, 25]); d.line(G, 233, [97, 10], [97, 28]);
  d.rect(G, 140, 22, 22, 24.5, 27.5); d.rect(G, 140, 25, 22, 27.5, 27.5); d.rect(G, 140, 28, 22, 30.5, 27.5);
  d.rect(G, 4, 12, 12, 16, 15); d.text(G, 4, [13, 13], 0.3, 'GATE GOOMTI');
  d.rect(F, 6, 20, 20, 80, 60); d.text(F, 6, [50, 40], 0.3, 'OFFICE');
  d.rect(F, 3, 60, 30, 62, 32);
  d.rect(F, 22, 40, 40, 42, 42); d.text(F, 22, [40.2, 40.2], 0.3, 'L1-START');
  d.rect(F, 115, 70, 50, 75, 58);
  d.rect(F, 4, 25, 50, 28, 54); d.text(F, 4, [25.5, 51], 0.3, 'PUMP ROOM');
  d.text(F, 7, [30, 15], 0.5, 'FLOOR01-TYPICAL');
  d.rect(T, 227, 20, 20, 80, 60);
  d.rect(T, 4, 70, 50, 75, 58); d.text(T, 4, [71, 52], 0.3, 'STAIRCASE HEADROOM');
  // ignored layer: forbidden things here must NOT be reported, and may lie outside the rectangle
  d.raw('MTEXT', 'A-WALL', 1, [[10, 500], [20, 500], [1, 'ignored']]);
  d.raw('INSERT', 'A-WALL', 1, [[2, 'BLK'], [10, 600], [20, 600]]);
  d.line('A-WALL', null, [500, 500], [510, 500]);
  return d.toString();
}

function bad() {
  const d = new Dxf(4);
  d.layer('FLOOR-GROUND').layer('FLOOR01').layer('FLOOR-XYZ').layer('FLOOR02', { flags: 1 }).layer('FLOOR03', { flags: 4 }).layer('A-WALL');
  const G = 'FLOOR-GROUND', F = 'FLOOR01';
  d.rect(G, 61, 5, 5, 105, 85);                                  // wrong origin
  d.rect(G, 7, 10, 10, 90, 70);
  d.rect(G, 10, 20, 20, 80, 60);
  d.poly(G, 2, [[10, 10], [90, 10]], { closed: false });         // setback side2 drawn as polyline
  d.rect(F, 140, 22, 22, 24.5, 27.5);                            // car stall on wrong layer
  d.line(G, null, [11, 11], [12, 11]);                           // ByLayer colour
  d.line(G, null, [13, 11], [14, 11], [[420, 16711680]]);        // true colour
  d.raw('MTEXT', G, 4, [[10, 15], [20, 15], [1, 'x']]);          // MTEXT
  d.raw('INSERT', G, 4, [[2, 'BLK'], [10, 16], [20, 15]]);       // block
  d.line(G, 3, [15, 12, 5], [16, 12, 5]);                        // Z != 0
  d.rect(G, 19, 30, 30, 34, 34, { elevation: 3, thickness: 0.2 }); // elevation + thickness
  d.text(G, 4, [17, 12], 0.03, 'GATE GOOMTI');                   // text too small
  d.line(G, 41, [500, 500], [510, 500]);                         // outside rectangle
  d.rect(G, 140, 22, 22, 24.5, 27.5); d.rect(G, 140, 24, 24, 26.5, 29.5); // overlapping stalls
  d.rect(F, 134, 20, 20, 40, 40); d.text(F, 134, [25, 25], 0.3, 'OFFICE');  // wrong-colour use text
  d.poly(F, 6, [[50, 20], [60, 20], [60, 30]], { closed: false });         // open polyline (colour 6)
  d.poly(F, 33, [[20, 45], [30, 55], [30, 45], [20, 55]]); d.text(F, 33, [25, 50], 0.3, 'HOSPITAL'); // bowtie
  d.rect(F, 22, 40, 41, 42, 43); d.text(F, 22, [40.2, 41.2], 0.3, 'LIFT1');  // lift text format
  d.rect(F, 122, 60, 40, 70, 50); d.rect(F, 122, 60, 40, 70, 50); d.text(F, 122, [65, 45], 0.3, 'school'); // duplicate poly, lowercase ok
  d.rect(F, 4, 25, 56, 28, 59); d.text(F, 4, [25.5, 57], 0.3, 'SHOP'); // not a non-FAR text
  d.rect(F, 6, 72, 20, 80, 28);                                   // colour 6 polygon with no text
  d.line('FLOOR-XYZ', 7, [20, 20], [30, 20]);                    // unknown layer
  d.line('FLOOR02', 7, [20, 21], [30, 21]);                      // frozen layer
  return d.toString();
}


// Uses what manual v10.0 added: intermediate terrace layer, new assembly words, free block names, driveway polyline + text
function v3() {
  const d = new Dxf(6);
  ['FLOOR-GROUND', 'FLOOR-PARKING', 'FLOOR01', 'FLOOR-TERRACE', 'FLOOR-TERRACEINTERMEDIATE 01', 'FLOOR-TERRACEINTERMEDIATE 02'].forEach(n => d.layer(n));
  const G = 'FLOOR-GROUND', F = 'FLOOR01';
  d.rect(G, 61, 0, 0, 100, 80);
  d.rect(G, 7, 10, 10, 90, 70);
  d.rect(G, 10, 20, 20, 80, 60);
  d.rect(G, 50, 5, 5, 95, 75); d.text(G, 50, [40, 7], 0.5, 'SERVICE BUILDING');            // block names are free text in v10.0
  d.poly('FLOOR-PARKING', 39, [[12, 12], [12, 30], [30, 30]], { closed: false }); d.text('FLOOR-PARKING', 39, [13, 20], 0.3, '4MT WIDE DRIVEWAY FOR CAR');
  d.rect(F, 6, 20, 20, 80, 60); d.text(F, 6, [50, 40], 0.3, 'POLICE STATION');              // new assembly word
  d.rect(F, 4, 25, 50, 28, 54); d.text(F, 4, [25.5, 51], 0.3, 'STP');
  d.rect('FLOOR-TERRACE', 227, 20, 20, 80, 60);
  d.rect('FLOOR-TERRACEINTERMEDIATE 01', 227, 20, 20, 50, 40);
  d.rect('FLOOR-TERRACEINTERMEDIATE 02', 227, 50, 20, 80, 40);
  return d.toString();
}

const dir = path.join(__dirname, 'test');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'good.dxf'), good());
fs.writeFileSync(path.join(dir, 'bad.dxf'), bad());
fs.writeFileSync(path.join(dir, 'v3.dxf'), v3());
console.log('wrote test/good.dxf, test/bad.dxf and test/v3.dxf');
