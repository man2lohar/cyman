
document.addEventListener('DOMContentLoaded', function() {
    const csvData = localStorage.getItem('csvData');
    if (csvData) {
        displayFilteredData(csvData);
    }
});

function displayFilteredData(csv) {
    const layers = [
        "Mercantile_wholesale", "Mercantile_retail", "Business",
        "Institutional", "Storage", "Assembly", "Hazardous", "Industrial", "Educational"
    ];

    const rows = csv.split('\n');
    const parsedData = parseCSVToArray(csv);

    let totalParkingRequired = 0;  // To store the total parking count

    layers.forEach(layer => {
        const layerData = getLayerData(layer, rows, parsedData);
        if (layerData.length > 0) {
            const layerParking = createTableForLayer(layer, layerData);
            totalParkingRequired += layerParking;  // Add parking spaces from each layer
        }
    });

    // Add a row to show the total parking required
    addTotalParkingRow(totalParkingRequired);
}


function getLayerData(layer, rows, parsedData) {
    const layerData = [];
    const seen = new Set();

    rows.forEach((row, index) => {
        const cells = row.split(',');

        if (index !== 0 && row.trim() !== '') {
            const rowLayer = cells[3];
            const key = cells[2] + ',' + cells[3]; // Unique key for Floor and Layer
            if (rowLayer === layer && !seen.has(key)) {
                seen.add(key);
                const rowData = {
                    floor: cells[2], // 3rd column
                    layer: cells[3], // 4th column
                    totalFloorArea: formatNumber(calculateTotalFloorArea(cells, parsedData)),
                    deductedArea: formatNumber(calculateDeductedArea(cells, parsedData)),
                    netArea: formatNumber(calculateNetArea(
                        formatNumber(calculateTotalFloorArea(cells, parsedData)),
                        formatNumber(calculateDeductedArea(cells, parsedData))
                    )),
                    carpetArea: formatNumber(calculateCarpetArea(cells, parsedData))
                };
                layerData.push(rowData);
            }
        }
    });

    return layerData;
}

function createTableForLayer(layer, layerData) {
    const container = document.getElementById('tables-container');
    
    // Create a section for the layer
    const section = document.createElement('div');
    section.classList.add('table-container');
    container.appendChild(section);

    // Add heading for each layer
    const heading = document.createElement('h3');
    heading.textContent = layer;
    section.appendChild(heading);

    const table = document.createElement('table');
    table.classList.add('layer-table');
    section.appendChild(table);

    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    table.appendChild(thead);
    table.appendChild(tbody);

    const headerRow = document.createElement('tr');
    thead.appendChild(headerRow);

    // Add headers for the table
    headerRow.innerHTML = `
        <th>Floor</th>
        <th>Net Area</th>
        <th>Carpet Area</th>
    `;

    let totalNetArea = 0;
    let totalCarpetArea = 0;

    layerData.forEach(data => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${data.floor}</td>
            <td>${data.netArea}</td>
            <td>${data.carpetArea}</td>
        `;
        tbody.appendChild(row);

        // Update totals
        totalNetArea += parseFloat(data.netArea);
        totalCarpetArea += parseFloat(data.carpetArea);
    });

    // Add total row
    const totalRow = document.createElement('tr');
    totalRow.classList.add('total-row');
    totalRow.innerHTML = `
        <td>Total</td>
        <td>${formatNumber(totalNetArea)}</td>
        <td>${formatNumber(totalCarpetArea)}</td>
    `;
    tbody.appendChild(totalRow);

    // Add footer row for parking
    const footerRow = document.createElement('tr');
    footerRow.classList.add('footer-row');
    const parkingRequired = calculateCarParkingRequired(layerData);
    footerRow.innerHTML = `
        <td class="green-text">Nos. of Car Parking Required:</td>
        <td class="green-text" colspan="2">${parkingRequired}</td>
    `;
    tbody.appendChild(footerRow);

    return parseFloat(parkingRequired) || 0;  // Return the parking required for this layer
}


function calculateCarParkingRequired(layerData) {
    // Determine the layer type
    const isBusinessLayer = layerData.length > 0 && layerData[0].layer === "Business";
    const isMercantileRetailLayer = layerData.length > 0 && layerData[0].layer === "Mercantile_retail";
    const isAssemblyLayer = layerData.length > 0 && layerData[0].layer === "Assembly";
    const isInstitutionalLayer = layerData.length > 0 && layerData[0].layer === "Institutional";

    if (isBusinessLayer) {
        // Calculate total carpet area for "Business" layer
        const totalCarpetArea = layerData.reduce((sum, data) => sum + parseFloat(data.carpetArea), 0);

        // Calculate the number of car parking spaces required based on the formula
        let carParkingSpaces;
        if (totalCarpetArea <= 1500) {
            carParkingSpaces = totalCarpetArea / 50;
        } else if (totalCarpetArea > 1500 && totalCarpetArea <= 5000) {
            carParkingSpaces = (totalCarpetArea - 1500) / 75 + 30;
        } else {
            carParkingSpaces = (totalCarpetArea - 5000) / 100 + 76;
        }

        return Math.floor(carParkingSpaces); // Round down to the nearest whole number
    } else if (isMercantileRetailLayer) {
        // Calculate total carpet area for "Mercantile_retail" layer
        const totalCarpetArea = layerData.reduce((sum, data) => sum + parseFloat(data.carpetArea), 0);

        // Calculate the number of car parking spaces required based on the formula
        let carParkingSpaces;
        if (totalCarpetArea > 25) {
            carParkingSpaces = totalCarpetArea / 35;
        } else {
            carParkingSpaces = 0; // No parking spaces required if total carpet area <= 25
        }

        return Math.floor(carParkingSpaces); // Round down to the nearest whole number
    } else if (isAssemblyLayer) {
        // Calculate total carpet area for "Mercantile_retail" layer
        const totalCarpetArea = layerData.reduce((sum, data) => sum + parseFloat(data.carpetArea), 0);

        // Calculate the number of car parking spaces required based on the formula
        let carParkingSpaces;
        if (totalCarpetArea > 35) {
            carParkingSpaces = totalCarpetArea / 35;
        } else {
            carParkingSpaces = 0; // No parking spaces required if total carpet area <= 25
        }

        return Math.floor(carParkingSpaces); // Round down to the nearest whole number
    } else if (isInstitutionalLayer) {
        // Calculate total carpet area for "Mercantile_retail" layer
        const totalCarpetArea = layerData.reduce((sum, data) => sum + parseFloat(data.carpetArea), 0);

        // Calculate the number of car parking spaces required based on the formula
        let carParkingSpaces;
        if (totalCarpetArea > 75) {
            carParkingSpaces = totalCarpetArea / 75;
        } else {
            carParkingSpaces = 0; // No parking spaces required if total carpet area <= 25
        }

        return Math.floor(carParkingSpaces); // Round down to the nearest whole number
    }else {
        return 'N/A'; // No car parking requirement for other layers
    }
}

function parseCSVToArray(csv) {
    const rows = csv.split('\n');
    const data = [];
    rows.forEach((row, index) => {
        if (index !== 0 && row.trim() !== '') {
            const cells = row.split(',');
            data.push({
                column1: cells[0], // 1st column (0-indexed)--Count
                column2: cells[1], // 2nd column (0-indexed)--Name
                column3: cells[2], // 3rd column (0-indexed)--Color
                column4: cells[3], // 4th column (0-indexed)--Layer
                column5: cells[4], // 5th column (0-indexed)--Length
                column6: cells[5], // 6th column (0-indexed)--Linetype
                column7: cells[6], // 7th column (0-indexed)--Lineweight
                column8: parseFloat(cells[7]) || 0, // 8th column (0-indexed)--Area
                column9: cells[8], // 9th column (0-indexed)--Closed
            });
        }
    });
    return data;
}

function calculateTotalFloorArea(filteredRow, mainTableData) {
    const column3Value = filteredRow[2];
    const column4Value = filteredRow[3];
    let sum = 0;

    mainTableData.forEach(data => {
        if (data.column3 === column3Value && data.column4 === column4Value && data.column6 === "ByLayer" && data.column7 === "ByLayer") {
            sum += data.column8;
        }
    });

    return sum.toFixed(3);
}

function calculateDeductedArea(filteredRow, mainTableData) {
    const column3Value = filteredRow[2];
    const column4Value = filteredRow[3];
    let sum = 0;

    mainTableData.forEach(data => {
        if (data.column3 === column3Value && data.column4 === column4Value && data.column6 === "DASHED") {
            sum += data.column8;
        }
    });

    return sum.toFixed(3);
}

function calculateNetArea(totalFloorArea, deductedArea) {
    return (parseFloat(totalFloorArea) - parseFloat(deductedArea)).toFixed(3);
}

function calculateCarpetArea(filteredRow, mainTableData) {
    const column3Value = filteredRow[2];
    const column4Value = filteredRow[3];
    let sum = 0;

    mainTableData.forEach(data => {
        if (data.column3 === column3Value && data.column4 === column4Value && data.column7 === "0.15 mm") {
            sum += data.column8;
        }
    });

    return sum.toFixed(3);
}

function formatNumber(value) {
    const number = parseFloat(value);
    return isNaN(number) ? '0.000' : number.toFixed(3);
}

function addTotalParkingRow(totalParkingRequired) {
    const container = document.getElementById('tables-container');

    // Create a section for the total row
    const section = document.createElement('div');
    section.classList.add('table-container');
    container.appendChild(section);

    const table = document.createElement('table');
    table.classList.add('layer-table');
    section.appendChild(table);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    // Add a row showing the total number of parking spaces required
    const totalRow = document.createElement('tr');
    totalRow.classList.add('total-row');
    totalRow.innerHTML = `
        <td style="width: 57.4%;">Total Nos. of Car Parking Required For Other Use-Groups:</td>
        <td colspan="2">${totalParkingRequired}</td>
    `;
    tbody.appendChild(totalRow);

    console.log('Nos. of Car Parking Required For Other Use-Groups:', totalParkingRequired);
    localStorage.setItem('totalParkingRequired', totalParkingRequired);
}