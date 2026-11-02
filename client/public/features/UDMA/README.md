# UD&MA Smart DCR Pre-Check (unofficial)

Checks an ASCII DXF drawing against the Department of Urban Development & Municipal Affairs (UD&MA), Kolkata, “Smart DCR User Manual for Granting Construction Permit Integrated With CAD Scrutiny”, Version 10.0. This is an unofficial drawing-format Pre-Check only; it does not perform the full Smart DCR scrutiny or assess building regulations. Runs locally in your browser.

## Project: UD&MA Smart DCR Pre-Check (unofficial)

The rules in `rules.json` are based on the supplied UD&MA Smart DCR User Manual Version 10.0. Where the manual is silent or ambiguous, the checker records the limitation rather than presenting an assumption as an official requirement.

## Files to upload to GitHub Pages (repository root)
- `index.html`, `app.js`, `udma-smart-dcr-checker.js`, `report.js`, `rules.json`
- `vendor/jspdf.umd.min.js` (PDF library, MIT licence)
- `test/good.dxf`, `test/bad.dxf` (used by the "try a sample" links)

Open through the site URL or a local server (`python -m http.server`), not by double-clicking `index.html`.

## Important scope note
This utility is independent and is not an official UD&MA application. A pass here does not guarantee acceptance by the department's official Smart DCR system. Always follow the current official manual and submission process.

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
