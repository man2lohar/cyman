document.addEventListener('DOMContentLoaded', function() {
    const csvData = localStorage.getItem('csvData');
    if (csvData) {
        const commonAreaData = filterCommonAreaData(csvData);
        const filteredData = filterTenementData(csvData, commonAreaData);
        displayTable(filteredData, 'tenement-data-table', 'tenement-table-header');
        // Common area table will not be displayed
        displayTable(commonAreaData, 'common-area-data-table', 'common-area-table-header');
    }
});

function filterCommonAreaData(csv) {
    const rows = csv.split('\n');
    const headers = rows[0].split(',');

    const floorIndex = headers.indexOf('Color');
    const linetypeIndex = headers.indexOf('Linetype');
    const areaIndex = headers.indexOf('Area');
    const layerIndex = headers.indexOf('Layer');

    const commonAreaEntries = new Map();

    rows.slice(1).forEach(row => {
        const cells = row.split(',');
        const layer = cells[layerIndex];
        const linetype = cells[linetypeIndex];
        const area = parseFloat(cells[areaIndex]) || 0;

        if (layer === 'Common Area') {
            const key = cells[floorIndex];
            if (!commonAreaEntries.has(key)) {
                commonAreaEntries.set(key, {
                    floor: cells[floorIndex],
                    totalArea: 0, 
                    deductArea: 0 
                });
            }
            const entry = commonAreaEntries.get(key);
            if (linetype === 'DASHED') {
                entry.deductArea += area;
            } else {
                entry.totalArea += area;
            }
        }
    });

    const newTableHeaders = ['Floor', 'Total Area'];
    const commonAreaData = [newTableHeaders.join(',')];
    let totalArea = 0;

    commonAreaEntries.forEach(entry => {
        const finalTotalArea = entry.totalArea - entry.deductArea;
        commonAreaData.push([
            entry.floor,
            finalTotalArea.toFixed(3)
        ].join(','));

        totalArea += finalTotalArea;
    });

    commonAreaData.push([
        'Total',
        totalArea.toFixed(3)
    ].join(','));

    return commonAreaData.join('\n');
}

function filterTenementData(csv, commonAreaData) {
    const rows = csv.split('\n');
    const headers = rows[0].split(',');
    const commonAreaRows = commonAreaData.split('\n').slice(1, -1);
    const commonAreaMap = new Map();

    commonAreaRows.forEach(row => {
        const [floor, totalArea] = row.split(',');
        commonAreaMap.set(floor, parseFloat(totalArea));
    });

    const floorIndex = headers.indexOf('Color');
    const tenementTypeIndex = headers.indexOf('Layer');
    const lineweightIndex = headers.indexOf('Lineweight');
    const linetypeIndex = headers.indexOf('Linetype');
    const areaIndex = headers.indexOf('Area');

    const uniqueEntries = new Map();

    rows.slice(1).forEach(row => {
        const cells = row.split(',');
        const tenementType = cells[tenementTypeIndex];
        const linetype = cells[linetypeIndex];
        const area = parseFloat(cells[areaIndex]) || 0;

        if (['Tenement', 'Tenement_Ext_1'].includes(tenementType)) {
            const key = `${cells[floorIndex]},${cells[lineweightIndex]}`;
            if (!uniqueEntries.has(key)) {
                uniqueEntries.set(key, {
                    floor: cells[floorIndex],
                    tenementType: cells[tenementTypeIndex],
                    lineweight: cells[lineweightIndex],
                    coveredArea: linetype === 'ByLayer' ? area : 0,
                    deductArea: linetype === 'DASHED' ? area : 0,
                    shareOfCommonArea: 0, 
                    tenementArea: 0, 
                    tenementRange: ''
                });
            } else {
                const existing = uniqueEntries.get(key);
                if (linetype === 'ByLayer') {
                    existing.coveredArea += area;
                } else if (linetype === 'DASHED') {
                    existing.deductArea += area;
                }
            }
        } else if (['Tenement_Single', 'Tenement_Single_Ext_1'].includes(tenementType)) {
            const key = `${cells[tenementTypeIndex]},${cells[lineweightIndex]}`;
            if (!uniqueEntries.has(key)) {
                uniqueEntries.set(key, {
                    floor: cells[floorIndex],
                    tenementType: cells[tenementTypeIndex],
                    lineweight: cells[lineweightIndex],
                    coveredArea: linetype === 'ByLayer' ? area : 0,
                    deductArea: linetype === 'DASHED' ? area : 0,
                    shareOfCommonArea: 0, 
                    tenementArea: 0, 
                    tenementRange: ''
                });
            } else {
                const existing = uniqueEntries.get(key);
                if (cells[floorIndex] < existing.floor) {
                    existing.floor = cells[floorIndex];
                }
                if (linetype === 'ByLayer') {
                    existing.coveredArea += area;
                } else if (linetype === 'DASHED') {
                    existing.deductArea += area;
                }
            }
        }
    });

    let totalCoveredArea = 0;
    uniqueEntries.forEach(entry => {
        entry.coveredArea = entry.coveredArea - entry.deductArea; // Covered Area = Covered Area - Deducted Area
        totalCoveredArea += entry.coveredArea;
    });

    uniqueEntries.forEach(entry => {
        const commonAreaTotal = Array.from(commonAreaMap.values()).reduce((sum, area) => sum + area, 0);
        const coveredArea = entry.coveredArea;
        entry.shareOfCommonArea = (commonAreaTotal / totalCoveredArea) * coveredArea;
        entry.tenementArea = coveredArea + entry.shareOfCommonArea;

        if (entry.tenementType === 'Tenement' || entry.tenementType === 'Tenement_Ext_1') {
            if (entry.tenementArea < 50) {
                entry.tenementRange = 'BELOW 50';
            } else if (entry.tenementArea < 75) {
                entry.tenementRange = '50 - 75';
            } else if (entry.tenementArea < 100) {
                entry.tenementRange = '75 - 100';
            } else {
                entry.tenementRange = 'ABOVE 100';
            }
        } else if (entry.tenementType === 'Tenement_Single' || entry.tenementType === 'Tenement_Single_Ext_1') {
            if (entry.tenementArea < 100) {
                entry.tenementRange = 'BELOW 100';
            } else if (entry.tenementArea < 200) {
                entry.tenementRange = 'ABOVE 100';
            } else {
                entry.tenementRange = 'ABOVE 200';
            }
        }
    });

    const newTableHeaders = ['Floor', 'Flat Name', 'Tenement Type', 'Lineweight', 'Covered Area', 'Share of Common Area', 'Tenement Area', 'Tenement Range'];
    const filteredData = [newTableHeaders.join(',')];
    let totalShareOfCommonArea = 0;
    let totalTenementArea = 0;

    const floorGroup = new Map();

    uniqueEntries.forEach(entry => {
        if (!floorGroup.has(entry.floor)) {
            floorGroup.set(entry.floor, []);
        }
        floorGroup.get(entry.floor).push(entry);
    });

    floorGroup.forEach((entries, floor) => {
        entries.sort((a, b) => a.lineweight - b.lineweight);
        entries.forEach((entry, index) => {
            const flatName = String.fromCharCode(65 + index) + floor.slice(-2);
            filteredData.push([
                entry.floor,
                flatName,
                entry.tenementType,
                entry.lineweight,
                entry.coveredArea.toFixed(3), // Display updated covered area
                entry.shareOfCommonArea.toFixed(3),
                entry.tenementArea.toFixed(3),
                entry.tenementRange
            ].join(','));

            totalShareOfCommonArea += entry.shareOfCommonArea;
            totalTenementArea += entry.tenementArea;
        });
    });

    filteredData.push([
        'Total', '', '', '',
        totalCoveredArea.toFixed(3), // Update the total row to reflect the correct covered area
        totalShareOfCommonArea.toFixed(3),
        totalTenementArea.toFixed(3),
        ''
    ].join(','));

    return filteredData.join('\n');
}

function displayTable(data, tableId, headerId) {
    const rows = data.split('\n');
    const headers = rows[0].split(',');

    const table = document.getElementById(tableId);
    const tableHeader = document.getElementById(headerId);
    const tableBody = table.querySelector('tbody');
    const tableFooter = table.querySelector('tfoot');

    // Clear existing content
    tableHeader.innerHTML = '';
    tableBody.innerHTML = '';
    tableFooter.innerHTML = '';

    // Create table headers
    headers.forEach(header => {
    if (header !== 'Floor' && header !== 'Lineweight') { // Exclude Floor and Lineweight
        const th = document.createElement('th');
        th.textContent = header;
        tableHeader.appendChild(th);
    }
    });

    // Add the new "Nos. of Flats" header
    const nosOfFlatsHeader = document.createElement('th');
    nosOfFlatsHeader.textContent = 'Nos. of Flats';
    tableHeader.appendChild(nosOfFlatsHeader);

    // Add the "Req. Car Parking" header
    const reqCarParkingHeader = document.createElement('th');
    reqCarParkingHeader.textContent = 'Req. Car Parking';
    tableHeader.appendChild(reqCarParkingHeader);

    // Map to store unique entries
    const uniqueEntries = new Map();
    const tenementRangeTotals = new Map(); // New map to store total flats per range

    // Initialize total values
    let totalCoveredArea = 0;
    let totalShareOfCommonArea = 0;
    let totalTenementArea = 0;
    let totalNosOfFlats = 0;

    // Process rows, except the header and total row
    rows.slice(1, -1).forEach(row => {
    const cells = row.split(',');
    const flatName = cells[1];
    const tenementType = cells[2];
    const coveredArea = parseFloat(cells[4]);
    const shareOfCommonArea = parseFloat(cells[5]);
    const tenementArea = parseFloat(cells[6]); // Parse as float for area
    const tenementRange = cells[7];
    const key = `${tenementType}-${tenementArea}-${tenementRange}`;

    // Track total number of flats for each Tenement Range
    if (!tenementRangeTotals.has(tenementRange)) {
        tenementRangeTotals.set(tenementRange, 0);
    }
    tenementRangeTotals.set(tenementRange, tenementRangeTotals.get(tenementRange) + 1);

    if (uniqueEntries.has(key)) {
        // If entry exists, append the Flat Name
        uniqueEntries.get(key).flatNames.push(flatName);
    } else {
        // Otherwise, create a new entry
        uniqueEntries.set(key, {
            floor: cells[0],
            flatNames: [flatName],
            tenementType: tenementType,
            lineweight: cells[3],
            coveredArea: coveredArea,
            shareOfCommonArea: shareOfCommonArea,
            tenementArea: tenementArea,
            tenementRange: tenementRange,
            reqCarParking: 0 // Placeholder, calculation done after setting total flats
        });
    }
    });

    // Compute required parking spaces using correct total flats per row and range
    uniqueEntries.forEach(entry => {
    let totalFlatsForRange = 0;

    if (["BELOW 50", "50 - 75", "75 - 100"].includes(entry.tenementRange)) {
        totalFlatsForRange = Array.from(uniqueEntries.values())
            .filter(e => e.tenementRange === entry.tenementRange)
            .reduce((sum, e) => sum + e.flatNames.length, 0);
    } else {
        totalFlatsForRange = entry.flatNames.length;
    }

    entry.reqCarParking = calculateReqCarParking(entry.tenementType, entry.tenementArea, entry.tenementRange, totalFlatsForRange);

    // Update total values
    totalCoveredArea += entry.coveredArea * entry.flatNames.length;
    totalShareOfCommonArea += entry.shareOfCommonArea * entry.flatNames.length;
    totalTenementArea += entry.tenementArea * entry.flatNames.length;
    totalNosOfFlats += entry.flatNames.length;
    });

    // Convert unique entries to an array and sort by Tenement Area (highest first)
    const sortedEntries = Array.from(uniqueEntries.values()).sort((a, b) => b.tenementArea - a.tenementArea);

    // Variables for tracking merging and totals
    let lastTenementRange = null;
    let rowspan = 0;
    let firstRow = null;
    const rangeFlatNames = new Set();
    let totalReqCarParking = 0; // Initialize totalReqCarParking

    sortedEntries.forEach((entry, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${entry.flatNames.join(', ')}</td>
            <td>${entry.tenementType}</td>
            <td>${entry.coveredArea.toFixed(3)}</td>
            <td>${entry.shareOfCommonArea.toFixed(3)}</td>
            <td>${entry.tenementArea.toFixed(3)}</td>
            <td>${entry.tenementRange}</td>
            <td>${entry.flatNames.length}</td>
            <td>${entry.reqCarParking}</td>
        `;
        tableBody.appendChild(tr);

        if (['BELOW 50', '50 - 75', '75 - 100'].includes(entry.tenementRange)) {
            if (entry.tenementRange !== lastTenementRange && lastTenementRange !== null) {
                // Handle the end of the previous range
                if (rowspan > 0 && firstRow) {
                    mergeCells(firstRow, rowspan + 1, rangeFlatNames.size);
                }
                // Reset variables for new range
                rowspan = 0;
                rangeFlatNames.clear();
            }

            entry.flatNames.forEach(flatName => rangeFlatNames.add(flatName));

            // For the first row of the range, show the reqCarParking
            if (entry.tenementRange === lastTenementRange) {
                rowspan++;
                // Hide intermediate rows but do not count reqCarParking
                tr.children[5].style.display = 'none';
                tr.children[6].style.display = 'none';
                tr.children[7].style.display = 'none';
            } else {
                lastTenementRange = entry.tenementRange;
                firstRow = tr;
            }
        } else {
            // If not in range, add reqCarParking to the total as usual
            totalReqCarParking += entry.reqCarParking;
        }

        // If last row of the sorted entries, merge and count
        if (index === sortedEntries.length - 1 && rowspan > 0 && firstRow) {
            mergeCells(firstRow, rowspan + 1, rangeFlatNames.size);
        }
    });

    // Now, after looping through, handle the last row for each group in the specified ranges:
    // Loop through sorted entries and calculate total required parking
    sortedEntries.forEach((entry, index) => {
        const isLastRowOfRange = 
            (index === sortedEntries.length - 1) || 
            sortedEntries[index + 1].tenementRange !== entry.tenementRange;

        // Only sum up parking spaces for specific ranges at the last row of each range
        if (isLastRowOfRange && ['BELOW 50', '50 - 75', '75 - 100'].includes(entry.tenementRange)) {
            totalReqCarParking += entry.reqCarParking;
        }
    });

    // Log only once, after calculation
    if (totalReqCarParking > 0) {
        console.log('Nos. of Car Parking Required For Tenements:', totalReqCarParking);
        localStorage.setItem('totalReqCarParking', totalReqCarParking);
    }

    // Add total row
    const totalRow = document.createElement('tr');
    totalRow.classList.add('total-row');

    const totalFlatNamesCell = document.createElement('td');
    totalFlatNamesCell.textContent = 'Total';
    totalRow.appendChild(totalFlatNamesCell);

    const totalTenementTypeCell = document.createElement('td');
    totalTenementTypeCell.textContent = ''; // Empty since it's a total row
    totalRow.appendChild(totalTenementTypeCell);

    const totalCoveredAreaCell = document.createElement('td');
    totalCoveredAreaCell.textContent = totalCoveredArea.toFixed(3);
    totalRow.appendChild(totalCoveredAreaCell);

    const totalShareOfCommonAreaCell = document.createElement('td');
    totalShareOfCommonAreaCell.textContent = totalShareOfCommonArea.toFixed(3);
    totalRow.appendChild(totalShareOfCommonAreaCell);

    const totalTenementAreaCell = document.createElement('td');
    totalTenementAreaCell.textContent = totalTenementArea.toFixed(3);
    totalRow.appendChild(totalTenementAreaCell);

    const totalTenementRangeCell = document.createElement('td');
    totalTenementRangeCell.textContent = ''; // Empty since it's a total row
    totalRow.appendChild(totalTenementRangeCell);

    const totalNosOfFlatsCell = document.createElement('td');
    totalNosOfFlatsCell.textContent = totalNosOfFlats;
    totalRow.appendChild(totalNosOfFlatsCell);

    const totalReqCarParkingCell = document.createElement('td');
    totalReqCarParkingCell.textContent = totalReqCarParking;  // Correctly sum of the "Req. Car Parking" column
    totalRow.appendChild(totalReqCarParkingCell);

    tableFooter.appendChild(totalRow);
}

function mergeCells(row, rowSpan, totalNosOfFlats) {
    row.children[5].rowSpan = rowSpan; // Merge "Tenement Range"
    row.children[6].rowSpan = rowSpan; // Merge "Nos. of Flats"
    row.children[7].rowSpan = rowSpan; // Merge "Req. Car Parking"
    row.children[6].textContent = totalNosOfFlats; // Set the total number of flats for the merged rows
}

// Function to calculate the required car parking spaces based on Tenement Range
function calculateReqCarParking(tenementType, tenementArea, tenementRange, totalNosOfFlats) {
    let reqParkingSpaces = 0;

    if (tenementType === 'Tenement'|| tenementType === 'Tenement_Ext_1') {
        switch (tenementRange) {
            case 'BELOW 50':
                reqParkingSpaces = Math.floor(totalNosOfFlats / 6); // No parking required for BELOW 50
                break;
            case '50 - 75':
                reqParkingSpaces = Math.floor(totalNosOfFlats / 4); // No parking required for 50 - 75
                break;
            case '75 - 100':
                reqParkingSpaces = Math.floor(totalNosOfFlats / 2); // Req. Car Parking = Total Nos. of Flats / 2
                break;
            case 'ABOVE 100':
                // Calculate parking based on tenement area and number of flats
                // Adjust this formula based on your actual requirement
                reqParkingSpaces = Math.floor(tenementArea / 100) * totalNosOfFlats; 
                break;
            default:
                reqParkingSpaces = 0; // Default case if range is unknown
        }
    }
    if (tenementType === 'Tenement_Single'|| tenementType === 'Tenement_Single_Ext_1') {
        switch (tenementRange) {
            case 'BELOW 100':
                reqParkingSpaces = 0; // No parking required for BELOW 50
                break;                
            case 'ABOVE 100':
                // Calculate parking based on tenement area and number of flats
                // Adjust this formula based on your actual requirement
                reqParkingSpaces = Math.floor(totalNosOfFlats / 1); 
                break;
            case 'ABOVE 200':
                // Calculate parking based on tenement area and number of flats
                // Adjust this formula based on your actual requirement
                reqParkingSpaces = Math.floor(tenementArea / 200) * totalNosOfFlats; 
                break;
            default:
                reqParkingSpaces = 0; // Default case if range is unknown
        }
    }
    return reqParkingSpaces;
}

