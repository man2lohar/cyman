# NKDA Smart DCR Pre-Check (unofficial)

Checks a DXF drawing against the NKDA Smart DCR User Manual v2.0 (Pre-Check only: layers, colours, object types, text, geometry). Runs fully in the browser.

## Files to upload to GitHub Pages (repository root)
- `index.html`, `app.js`, `nkda-checker.js`, `report.js`, `rules.json`
- `vendor/jspdf.umd.min.js` (PDF library, MIT licence)
- `test/good.dxf`, `test/bad.dxf` (used by the "try a sample" links)

Open through the site URL or a local server (`python -m http.server`), not by double-clicking `index.html`.

## Changing a rule
All manual tables live in `rules.json`. Edit that file only. Conflicts and assumptions are listed in its `knownConflicts` and `mandatory` sections.

## Tests (Node 18+)
```
node make-test-dxf.js      # regenerates test/good.dxf and test/bad.dxf
node run-tests.js          # engine tests
node run-tests.js my.dxf   # check any DXF and print the issues
node test-report.js        # PDF and marked-up DXF tests (needs: npm i jspdf)
node test/smoke-page.js    # page test (needs: npm i jsdom jspdf)
```
