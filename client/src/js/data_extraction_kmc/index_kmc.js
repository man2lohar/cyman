// Function to display data in the table
function displayData(csv) {
    const rows = csv.split('\n');
    // ── Sort rows: Layer A→Z, then Color low→high, then Lineweight low→high (ByLayer = lowest) ──
    (function sortRows() {
        if (rows.length < 2) return;
        const headerCells = rows[0].split(',');
        let layerIdx = -1, colorIdx = -1, lwIdx = -1;
        headerCells.forEach((h, i) => {
            const k = h.trim();
            if (k === 'Layer') layerIdx = i;
            if (k === 'Color') colorIdx = i;
            if (k === 'Lineweight') lwIdx = i;
        });
        if (layerIdx === -1) return;

        function sortLW(v) {
            if (!v) return 0;
            if (v.trim() === 'ByLayer') return 0;
            const n = parseFloat(v);
            return isNaN(n) ? 0 : n;
        }
        function sortColor(v) {
            const n = parseInt(v, 10);
            return isNaN(n) ? 0 : n;
        }

        const headerLine = rows[0];
        const dataLines = rows.slice(1).filter(r => r.trim() !== '');
        dataLines.sort((a, b) => {
            const ca = a.split(','), cb = b.split(',');
            const la = (ca[layerIdx] || '').trim(), lb = (cb[layerIdx] || '').trim();
            if (la !== lb) return la < lb ? -1 : 1;
            const cola = sortColor(ca[colorIdx]), colb = sortColor(cb[colorIdx]);
            if (cola !== colb) return cola - colb;
            const lwa = sortLW(ca[lwIdx]), lwb = sortLW(cb[lwIdx]);
            return lwa - lwb;
        });
        rows.length = 0;
        rows.push(headerLine, ...dataLines);
    })();
    const tableHeader = document.getElementById('table-header');
    const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];

    // Clear existing table content
    tableHeader.innerHTML = '';
    tableBody.innerHTML = '';

    // Add color-coded description dynamically
    const descriptionContainer = document.getElementById('description-container'); // ID of the container for description
    if (descriptionContainer) {
        // Clear previous description (if any)
        descriptionContainer.innerHTML = '';

        // Create the paragraph with color-coded descriptions
        const description = document.createElement('p');
        description.innerHTML = `
            <span style="color: orange;">'Orange'</span> color text denotes duplicate data |
            <span style="color: red;">'Red'</span> color text denotes wrong data
        `;
        descriptionContainer.appendChild(description);
    }


    // Track seen rows for duplication check
    const seenRows = new Set();
    const duplicateRows = new Set();

    // Define a set of valid layer names
    const validLayerNames = new Set([
        "Column","Plot", "Road", "Splay", "Strip", "Ground Coverage", "Tree Cover", "Open Space",
        "Open Space_Ext_1", "Residential", "Mercantile_wholesale", "Mercantile_retail", "Business", "Institutional", "Storage",
        "Assembly", "Hazardous", "Industrial", "Educational", "Internal Road", "Alignment", "Stair",
        "Lift", "Lift_Ext_1", "Loft", "Cupboard", "Tenement", "Tenement_Ext_1",
        "Tenement_Single", "Tenement_Single_Ext_1", "Height", "Floor Height",
        "Roof_Structure", "Terrace", "Parking", "Parking_Area", "Water body", "Heritage",
        "Existing", "Service_floor", "Common Area", "Wall", "Text", "Dimension",
        "Section", "Print", "Mis1", "Block_Text", "Fire Refuge", "Triple_Balcony", "Goomty",
        "Court Yard", "Shaft", "Corridor", "STP", "RWH", "Pavement", "EVCP", "Solar",
        "Baby Care Room"
    ]);

    // Define accepted layers as an array
    const acceptedLayers = ['Residential', 'Mercantile_wholesale', 'Mercantile_retail', 'Business',
        'Institutional', 'Storage', 'Assembly', 'Hazardous', 'Industrial', 'Educational'];

    // Lineweight always ByLayer
    const ByLayers = ['Common Area', 'Cupboard', 'Ground Coverage', 'Open Space', 'Roof_Structure', 'Terrace', 'Internal Road', 'Loft'];

    // Lineweight never ByLayer
    const NeverByLayers = ['Existing', 'Floor Height', 'Height', 'Parking', 'Parking_Area', 'Stair', 'Tenement', 'Tenement_Single',
        'Tenement_Ext_1', 'Tenement_Single_Ext_1', 'Tree Cover', 'Shaft', 'Court Yard', 'Heritage', 'Water body', 'Splay', 'Strip', 'Corridor', 'Lift'
    ];

    const LW_GROUP_A = new Set(['0.15 mm','0.20 mm','0.25 mm','0.30 mm','0.35 mm']);
    const LW_GROUP_B = new Set(['0.00 mm','0.05 mm','0.09 mm','0.13 mm','0.15 mm','0.18 mm','0.20 mm','0.25 mm','0.30 mm','0.35 mm','0.40 mm','0.50 mm','0.53 mm','0.60 mm','0.70 mm','0.90 mm','1.00 mm','1.06 mm','1.20 mm','1.40 mm','1.58 mm','2.00 mm','2.11 mm']);
    const LW_GROUP_C = new Set(['0.20 mm','0.25 mm','0.30 mm']);
    const LW_GROUP_DEFAULT = new Set(['0.15 mm','0.18 mm','0.20 mm','0.25 mm','0.30 mm','0.35 mm','0.40 mm','0.50 mm','0.53 mm','0.60 mm','0.70 mm','0.90 mm']);
    const LW_GROUP_A_LAYERS = new Set(['Splay','Strip']);
    const LW_GROUP_B_LAYERS = new Set(['Lift','Lift_Ext_1','Open Space','Stair','Tenement','Tenement_Ext_1','Tenement_Single','Tenement_Single_Ext_1','Height','Floor Height']);
    const LW_GROUP_C_LAYERS = new Set(['Parking']);
    function getAllowedLW(layer){
      if(LW_GROUP_A_LAYERS.has(layer)) return LW_GROUP_A;
      if(LW_GROUP_B_LAYERS.has(layer)) return LW_GROUP_B;
      if(LW_GROUP_C_LAYERS.has(layer)) return LW_GROUP_C;
      return LW_GROUP_DEFAULT;
    }
    // Layers where Linetype should NOT be DASHED
    const NoDashedLayers = ['Plot', 'Road', 'Splay', 'Strip', 'Tree Cover', 'Open Space',
        'Open Space_Ext_1', 'Internal Road', 'Loft', 'Cupboard', 'Height', 'Floor Height',
        'Alignment', 'Water body', 'Heritage', 'Existing', 'STP', 'RWH', 'Pavement',
        'Roof_Structure', 'Court Yard'
    ];

    // Define condition styles with flexible conditions
    const conditions = [
    { check: (cells, indices) => !validLayerNames.has(cells[indices.layer]), errorMessage: "Invalid Layer Name" },
    { check: (cells, indices) => cells[indices.count] !== '1', errorMessage: "Count must be 1" },
    { check: (cells, indices) => cells[indices.color] === 'ByLayer', errorMessage: "Color should not be ByLayer" },
    { check: (cells, indices) => !['ByLayer', 'DASHED', 'PHANTOM2'].includes(cells[indices.linetype]), errorMessage: "Invalid Linetype" },
    { check: (cells, indices) => NoDashedLayers.includes(cells[indices.layer]) && cells[indices.linetype] === 'DASHED', errorMessage: "Linetype should not be DASHED" },
    { check: (cells, indices) => cells[indices.name] === 'Polyline' && cells[indices.closed] == 0, errorMessage: "Polyline must be closed" },
    { check: (cells, indices) => !['Polyline', 'Line', 'Point'].includes(cells[indices.name]), errorMessage: "Invalid Object Name" },
    { check: (cells, indices) => cells[indices.name] === 'Polyline' && cells[indices.area].trim() === '', errorMessage: "Polyline area is missing" },
    { check: (cells, indices) => acceptedLayers.includes(cells[indices.layer]) && !['ByLayer', 'DASHED'].includes(cells[indices.linetype]), errorMessage: "Linetype should be ByLayer or DASHED" },
    { check: (cells, indices) => ByLayers.includes(cells[indices.layer]) && !(cells[indices.layer] === 'Open Space' && ['13','23','33','43'].includes(cells[indices.color])) && cells[indices.lineweight] !== 'ByLayer', errorMessage: "Lineweight must be ByLayer" },
    { check: (cells, indices) => NeverByLayers.includes(cells[indices.layer]) && cells[indices.name] === 'Polyline' && cells[indices.lineweight] === 'ByLayer', errorMessage: "Lineweight must not be ByLayer" },
    { check: (cells, indices) => cells[indices.layer] === 'Lift' && cells[indices.lineweight] === 'ByLayer', errorMessage: "Lineweight must not be ByLayer" },
    { check: (cells, indices) => {
        const lw = (cells[indices.lineweight] || '').trim();
        return lw !== '' && lw !== 'ByLayer' && !getAllowedLW(cells[indices.layer]).has(lw);
      }, errorMessage: "Invalid Lineweight" },
    { 
        check: (cells, indices) => {
            const colorValue = parseInt(cells[indices.color], 10);
            return (cells[indices.name] === 'Polyline' && cells[indices.layer] === 'Plot' && (colorValue !== 240 || cells[indices.lineweight] !== '0.50 mm')) ||
                   (cells[indices.layer] === 'Ground Coverage' && (colorValue < 53 || colorValue > 152) && cells[indices.name] === 'Polyline');
        }, 
        errorMessage: "Invalid color for Plot or Ground Coverage" 
    }
    ];

    // Function to apply styles based on conditions
    function applyStyles(cells, indices) {
        for (const { check, errorMessage } of conditions) {
            if (check(cells, indices)) {
                return { className: 'text-red', message: errorMessage }; // Return both class and message
            }
        }
        return { className: '', message: '' }; // No error
    }
    
    // First pass: Detect duplicates
    rows.forEach((row, index) => {
        const cells = row.split(',');

        if (index > 0 && row.trim() !== '') { // Skip header row
            const rowStr = cells.join(',');
            if (seenRows.has(rowStr)) {
                duplicateRows.add(rowStr);
            }
            seenRows.add(rowStr);
        }
    });

    // Track invalid layers
    const invalidLayers = new Set();

    // Track layers present in the data
    const foundLayers = new Set();

    let allErrorMessages = []; // Array to collect all error messages

    // Create a tracker for lineweights based on name
    const lineweightTracker = {
        'Strip': new Set(),
        'Splay': new Set(),
        'Plot': new Set(),
        'Tree Cover': new Set(),
        'Existing': new Set(),
        'Lift': {}
    };

    // Second pass: Create table and apply styles
    let columnIndices = {};

    // Ensure rows is defined and populated
    if (!rows || !Array.isArray(rows)) {
        console.error("Rows is undefined or not an array.");
        return;  // Exit early if rows is not valid
    }

    // Create a set to track reported errors
    const reportedErrors = new Set();

    rows.forEach((row, index) => {
        const cells = row.split(',');

        if (index === 0) {
            // Create table headers and determine column indices
            cells.forEach((cell, cellIndex) => {
                const th = document.createElement('th');
                th.textContent = cell;
                th.setAttribute('name', `header-${cellIndex}`);
                th.setAttribute('id', `header-${cellIndex}`);
                tableHeader.appendChild(th);

                // Store column indices
                if (cell.trim() === 'Count') columnIndices.count = cellIndex;
                if (cell.trim() === 'Name') columnIndices.name = cellIndex;
                if (cell.trim() === 'Color') columnIndices.color = cellIndex;
                if (cell.trim() === 'Layer') columnIndices.layer = cellIndex;
                if (cell.trim() === 'Length') columnIndices.length = cellIndex;
                if (cell.trim() === 'Linetype') columnIndices.linetype = cellIndex;
                if (cell.trim() === 'Lineweight') columnIndices.lineweight = cellIndex;
                if (cell.trim() === 'Area') columnIndices.area = cellIndex;
                if (cell.trim() === 'Closed') columnIndices.closed = cellIndex;
            });

        } else if (row.trim() !== '') {
            const newRow = tableBody.insertRow();
            const rowStr = cells.join(',');
            let errorMessages = [];

            // Apply styles and collect error messages for this row
            const rowStyles = applyStyles(cells, columnIndices);
            if (rowStyles.className) {
                newRow.classList.add(rowStyles.className);
                if (rowStyles.message) {
                    const layerForMsg = cells[columnIndices.layer]?.trim();
                    errorMessages.push(`In ${layerForMsg} Layer: ${rowStyles.message}`);
                }
            }

            // Ensure cells and columns are properly indexed
            const layer = cells[columnIndices.layer]?.trim();
            const name = cells[columnIndices.name]?.trim();
            const lineweight = cells[columnIndices.lineweight]?.trim();
            const color = cells[columnIndices.color]?.trim();   // ← NEW: needed for the key change below

            // Track the layers present in the data
            if (layer) {
                foundLayers.add(layer);
            }

            // Check for invalid layers
            if (layer && !validLayerNames.has(layer)) {
                invalidLayers.add(layer);
            }

            // Check for duplicate lineweights for below layers
            if (['Strip', 'Splay', 'Plot', 'Tree Cover', 'Existing', 'Lift'].includes(layer)) {
                if (layer === 'Tree Cover' && name === 'Point') {
                    // Skip Tree Cover points
                } else if (layer === 'Lift') {
                    // Lift: key = Color + Lineweight, allow up to 2 occurrences
                    const key = `${color}:${lineweight}`;
                    lineweightTracker.Lift[key] = (lineweightTracker.Lift[key] || 0) + 1;
                    if (lineweightTracker.Lift[key] > 2) {
                        newRow.classList.add('text-red');
                        errorMessages.push(`Duplicate Lift Layer found with lineweight ${lineweight}`);
                    }
                } else if (layer === 'Existing' || layer === 'Tree Cover') {
                    // Existing / Tree Cover: key = Color + Lineweight, error on first repeat
                    const key = `${color}:${lineweight}`;
                    if (lineweightTracker[layer].has(key)) {
                        newRow.classList.add('text-red');
                        errorMessages.push(`Duplicate lineweight found for ${layer} layer with lineweight ${lineweight}`);
                    } else {
                        lineweightTracker[layer].add(key);
                    }
                } else {
                    // Strip / Splay / Plot: unchanged, key = Lineweight + Name
                    const key = `${lineweight}:${name}`;
                    if (lineweightTracker[layer].has(key)) {
                        newRow.classList.add('text-red');
                        errorMessages.push(`Duplicate lineweight found for ${layer} layer with lineweight ${lineweight}`);
                    } else {
                        lineweightTracker[layer].add(key);
                    }
                }
            }

            // Check for missing lines for each expected lineweight in the Stair layer
            if (layer === 'Stair' && name === 'Polyline') {
                const matchingLineExists = rows.some((r) => {
                    const lineCells = r.split(',');
                    const lineLayer = lineCells[columnIndices.layer]?.trim();
                    const lineName = lineCells[columnIndices.name]?.trim();
                    const lineLineweight = lineCells[columnIndices.lineweight]?.trim();
                    return lineLayer === 'Stair' && lineName === 'Line' && lineLineweight === lineweight;
                });

                if (!matchingLineExists) {
                    const errorMessage = `Line of width is missing for the Stair with lineweight ${lineweight}`;
                    if (!reportedErrors.has(errorMessage)) {
                        reportedErrors.add(errorMessage);
                        newRow.classList.add('error');
                        errorMessages.push(errorMessage);
                    }
                }
            }

            // Check for missing Line for Lift layer, per lineweight
            if (layer === 'Lift' && name === 'Polyline') {
                const matchingLiftLineExists = rows.some((r) => {
                    const lineCells = r.split(',');
                    const lineLayer = lineCells[columnIndices.layer]?.trim();
                    const lineName = lineCells[columnIndices.name]?.trim();
                    const lineLW = lineCells[columnIndices.lineweight]?.trim();
                    return lineLayer === 'Lift' && lineName === 'Line' && lineLW === lineweight;
                });

                if (!matchingLiftLineExists) {
                    const errorMessage = `Line of width is missing for the Lift with lineweight ${lineweight}`;
                    if (!reportedErrors.has(errorMessage)) {
                        reportedErrors.add(errorMessage);
                        newRow.classList.add('error');
                        errorMessages.push(errorMessage);
                    }
                }
            }

            // Add duplicate style if necessary
            if (duplicateRows.has(rowStr)) {
                newRow.classList.add('duplicate');
            }

            // Add error messages to allErrorMessages array
            if (errorMessages.length > 0) {
                allErrorMessages.push(`Row ${index + 1}: ${errorMessages.join(', ')}`); // Track which row has the error
            }

            // Create table cells
            cells.forEach((cell, cellIndex) => {
                const newCell = newRow.insertCell();
                newCell.textContent = cell;
                newCell.setAttribute('name', `row${index}-cell${cellIndex}`);
                newCell.setAttribute('id', `row${index}-cell${cellIndex}`);
            });
        }
    });

    // Find missing layers by comparing validLayerNames with foundLayers
    const missingLayers = Array.from(validLayerNames).filter(layer => !foundLayers.has(layer));

    // After processing all rows, show the modal if there are any error messages or invalid layers
    if (allErrorMessages.length > 0 || invalidLayers.size > 0 || missingLayers.length > 0) {
        // Show error messages if any
        let errorMessageContent = allErrorMessages.length > 0 ? allErrorMessages.join('<br>') : '';

        // Add invalid layers to the message
        if (invalidLayers.size > 0) {
            const invalidLayersList = Array.from(invalidLayers).join(' , ');
            errorMessageContent += `<br><br><strong>Invalid Layers or Misspelled:</strong> ${invalidLayersList}`;
        }

        // Add missing layers to the message with alternate colors
        if (missingLayers.length > 0) {
            // Add layers you want bolded in error popup.
            const layersToBold = new Set([
                "Column", "Plot", "Road", "Splay", "Strip", "Ground Coverage", "Tree Cover", "Open Space", "Stair", "Lift", "Loft", "Cupboard", "Tenement",
                "Tenement_Single", "Height", "Floor Height", "Roof_Structure", "Terrace", "Parking", "Parking_Area", "Existing", "Common Area",
            ]); 
            let missingLayersContent = '<br><br><strong>Below Layers Are Not In This Drawing:</strong><br>' + missingLayers.map((layer, index) => {
                const colorStyle = index % 2 === 0 ? 'color: blue;' : 'color: green;';
                const boldStyle = layersToBold.has(layer) ? 'font-weight: bold; color: magenta;' : ''; // Apply bold only for specific layers
                return `<span style="${colorStyle} ${boldStyle}">${layer}</span>`;
            }).join(' , ');
            errorMessageContent += missingLayersContent;
        }
        // Display the error modal
        showModal(errorMessageContent);
    }
}

function showModal(errorMessages) {
    const modal = document.getElementById('errorModal');
    const modalBody = document.getElementById('modalBody');
    const closeModal = document.getElementsByClassName('close')[0];

    // Make error messages clickable
    modalBody.innerHTML = errorMessages.split('<br>').map((error) => {
        const match = error.match(/Row (\d+)/); // Extract the row number
        if (match) {
            const rowNum = match[1];
            return `<div class="error-item" data-row="${rowNum}" style="cursor: pointer; text-decoration: none;">${error}</div>`;
        }
        return `<div>${error}</div>`; // Non-row-specific errors
    }).join('');   

    // Display the modal
    modal.style.display = 'block';

    // Add event listener for error items
    const errorItems = document.querySelectorAll('.error-item');
    errorItems.forEach((item) => {
        const rowNumber = item.getAttribute('data-row');

        // Add hover functionality to show the tooltip
        item.addEventListener('mouseover', function (event) {
            // Create the tooltip and set its message
            const message = `Click here to go to the row ${rowNumber}`;
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip'; // Tooltip styling class
            tooltip.textContent = message;

            // Append tooltip to the body
            document.body.appendChild(tooltip);

            // Position the tooltip relative to the cursor
            tooltip.style.position = 'absolute';
            tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            tooltip.style.color = '#fff';
            tooltip.style.padding = '5px 10px';
            tooltip.style.borderRadius = '5px';
            tooltip.style.zIndex = '9999'; // Ensure it appears above other elements

            // Set the tooltip's position to be near the cursor, with a slight offset
            const offsetX = 10; // Horizontal distance from cursor
            const offsetY = 5; // Vertical distance from cursor
            tooltip.style.left = `${event.pageX + offsetX}px`;
            tooltip.style.top = `${event.pageY + offsetY}px`;
        });

        // Remove the tooltip when mouse leaves
        item.addEventListener('mouseleave', function () {
            const tooltip = document.querySelector('.tooltip');
            if (tooltip) {
                tooltip.remove();
            }
        });

        // Add click event to scroll and blink the corresponding row
        item.addEventListener('click', function () {
            scrollToTableRowAndBlink(rowNumber); // Scroll and blink the row
            modal.style.display = 'none'; // Close the modal
        });
    });


}

function scrollToTableRowAndBlink(rowNumber) {
    const targetRowNumber = rowNumber - 1; // Subtract 1 to target the previous row
    const row = document.querySelector(`#data-table tbody tr:nth-child(${targetRowNumber})`);
    
    if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Start blinking only after scrolling finishes
        setTimeout(() => {
            // Ensure we're blinking the correct row
            const targetRow = document.querySelector(`#data-table tbody tr:nth-child(${targetRowNumber})`);
            if (targetRow) {
                let blinkCount = 0;
                const blinkInterval = setInterval(() => {
                    targetRow.classList.toggle('blink-red');
                    blinkCount++;
                    if (blinkCount >= 8) { // Toggle on and off 2 times (4 intervals)
                        clearInterval(blinkInterval);
                        targetRow.classList.remove('blink-red'); // Ensure the class is removed
                    }
                }, 100); // Blink interval in milliseconds
            }
        }, 500); // Delay blinking by 500ms to allow scrolling to finish
    }
}

// Check for existing data when the page loads.
// Priority:
//   1. If ?uploadId=XXX is in the URL → load that specific file's CSV from Firebase.
//   2. Otherwise → fall back to localStorage (latest upload, normal flow).
window.onload = function () {
  const params   = new URLSearchParams(window.location.search);
  const uploadId = params.get('uploadId');

  if (uploadId) {
    // ── Load a specific historical upload from Firebase ──────────────
    function loadFromFirebase(user) {
      if (typeof firebase === 'undefined' || !firebase.database) {
        console.warn('[kmc] Firebase not available – falling back to localStorage');
        _loadFromLocalStorage();
        return;
      }
      const csvRef = firebase.database()
        .ref('users/' + user.uid + '/kmc_csv_data/' + uploadId);

      // Show a loading indicator while fetching
      const infoDiv = document.getElementById('info-container');
      const mainDiv = document.getElementById('main-container');
      if (infoDiv) infoDiv.style.display = 'none';
      const loadMsg = document.createElement('p');
      loadMsg.id          = '_kmc_loading_msg';
      loadMsg.textContent = 'Loading file from database…';
      loadMsg.style.cssText = 'text-align:center;padding:2rem;color:#2d98fd;font-size:1rem;';
      document.body.appendChild(loadMsg);

      csvRef.once('value')
        .then(function (snap) {
          const el = document.getElementById('_kmc_loading_msg');
          if (el) el.remove();
          const val = snap.val();
          if (val && val.csv) {
            // Also update localStorage so the tab system works normally
            localStorage.setItem('csvData', val.csv);
            if (typeof applyTabStates === 'function') applyTabStates(true);
            // Fetch the file name from metadata to show in the status bar
            const metaRef = firebase.database()
              .ref('users/' + user.uid + '/kmc_uploads/' + uploadId + '/name');
            metaRef.once('value').then(function (mSnap) {
              const name = mSnap.val();
              if (name) {
                localStorage.setItem('uploadedFileName', name);
                const txt = document.getElementById('status-text');
                if (txt) txt.textContent = "Uploaded - " + name;
                const fnEl = document.getElementById('loaded-filename');
                if (fnEl) fnEl.textContent = name;
              }
            });
            displayData(val.csv);
          } else {
            // CSV not in DB (uploaded before this fix) – show a clear notice
            const el = document.getElementById('_kmc_loading_msg');
            if (el) el.remove();
            console.warn('[kmc] No CSV found in DB for uploadId:', uploadId,
              '– this file was uploaded before history support was added');

            // Show a banner so the user knows what happened
            const banner = document.createElement('div');
            banner.style.cssText = [
              'position:fixed;top:70px;left:50%;transform:translateX(-50%)',
              'background:#1a2a3a;border:1px solid #2d98fd;border-radius:8px',
              'color:#c0d8f0;padding:14px 22px;font-size:.9rem;z-index:9999',
              'max-width:480px;text-align:center;line-height:1.5;box-shadow:0 4px 20px #0006'
            ].join(';');
            banner.innerHTML = [
              '<strong style="color:#2d98fd">⚠ File data not available</strong><br>',
              'This upload was recorded before per-file history was supported.<br>',
              'Please re-upload the file to view it here.',
              '<button onclick="this.parentElement.remove()" style="',
                'display:block;margin:10px auto 0;background:#2d98fd;color:#fff;',
                'border:none;border-radius:5px;padding:5px 16px;cursor:pointer">OK</button>'
            ].join('');
            document.body.appendChild(banner);
            // Still load localStorage data if available so the page isn't blank
            _loadFromLocalStorage();
          }
        })
        .catch(function (err) {
          const el = document.getElementById('_kmc_loading_msg');
          if (el) el.remove();
          console.error('[kmc] Firebase fetch error:', err);
          _loadFromLocalStorage();
        });
    }

    // Wait for auth then fetch from Firebase
    if (window.cymUser) {
      loadFromFirebase(window.cymUser);
    } else {
      document.addEventListener('cymAuthReady', function (e) {
        loadFromFirebase(e.detail.user);
      }, { once: true });
    }

  } else {
    // ── Normal flow: no uploadId in URL ─────────────────────────────
    _loadFromLocalStorage();
  }
};

function _loadFromLocalStorage() {
  var storedCsvData = localStorage.getItem('csvData');
  if (storedCsvData) {
    displayData(storedCsvData);
  }
}

function _safeOn(id, event, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(event, fn);
}

_safeOn('file-input', 'change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(worksheet);
            localStorage.setItem('csvData', csv);
            localStorage.setItem('uploadedFileName', file.name);
            localStorage.setItem('_tabsUnlocked', '1');

            var mc     = document.getElementById('main-container');
            var ic     = document.getElementById('info-container');
            var tc     = document.querySelector('.home-two-col');
            var dxfCol = document.getElementById('dxf-right-col');
            var fs     = document.getElementById('feature-strip');
            if (mc)     mc.style.display     = 'block';
            if (ic)     ic.style.display     = 'none';
            if (tc)     tc.style.display     = 'none';
            if (dxfCol) dxfCol.style.display = 'none';
            if (fs)     fs.style.display     = 'none';

            var dot  = document.getElementById('status-dot');
            var txt  = document.getElementById('status-text');
            var fnEl = document.getElementById('loaded-filename');
            var cb   = document.getElementById('clearStorageBtn');
            if (dot)  dot.classList.add('green');
            if (txt)  txt.textContent = 'Uploaded - ' + file.name;
            if (fnEl) fnEl.textContent = file.name;
            if (cb)   cb.style.display = 'inline-flex';

            if (typeof window.applyTabStates === 'function') window.applyTabStates(true);
            displayData(csv);
        };
        reader.readAsArrayBuffer(file);
    }
});

// Function to display the custom alert
function showCustomAlert(message) {
    const modal = document.getElementById('custom-alert');
    const messageElement = document.getElementById('alert-message');
    const closeBtn = document.getElementById('close-alert');
    if (!modal || !messageElement || !closeBtn) return;

    // Set the message and display the modal
    messageElement.textContent = message;
    modal.style.display = 'block';

    // Close the modal when clicking the close button
    closeBtn.onclick = function () {
        modal.style.display = 'none';
    };
}

