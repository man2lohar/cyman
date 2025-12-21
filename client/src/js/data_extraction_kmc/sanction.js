document.getElementById('back-button').addEventListener('click', function() {
    window.location.href = 'filtered.html';
});
document.getElementById('parking-button').addEventListener('click', function() {
    window.location.href = 'parking.html';
});

document.addEventListener('DOMContentLoaded', function() {
    const csvData = localStorage.getItem('csvData');
    if (csvData) {
        displayFilteredData(csvData);
    }
});

function displayFilteredData(csv) {
    const validLayers = [
        "Residential", "Mercantile_wholesale", "Mercantile_retail", "Business",
        "Institutional", "Storage", "Assembly", "Hazardous", "Industrial", "Educational"
    ];

    const rows = csv.split('\n');
    const tableBody = document.getElementById('filtered-table').getElementsByTagName('tbody')[0];
    const totalFloorAreaCell = document.getElementById('total-floor-area');
    const totalStairWellCell = document.getElementById('total-stair-well');
    const totalLiftWellCell = document.getElementById('total-lift-well');
    const totalDuctCutoutCell = document.getElementById('total-duct-cutout');
    const totalEffectiveFloorAreaCell = document.getElementById('total-effective-floor-area');
    const totalStairwayCell = document.getElementById('total-stairway');
    const totalLiftLobbyCell = document.getElementById('total-lift-lobby');
    const totalNetFloorAreaCell = document.getElementById('total-net-floor-area');
    
    const mainTableData = parseCSVToArray(csv);

    const uniqueColors = new Set();
    const totalAreas = {};
    const stairWellAreas = {};
    const liftWellAreas = {};
    const ductCutoutAreas = {};
    const stairwayAreas = {};
    const liftLobbyAreas = {};
    
    // Storage for minimum color by unique lineweight for Stair and Lift layers
    const stairMinColorByLineweight = {};
    const liftMinColorByLineweight = {};

    // Populate totalAreas and uniqueColors
    rows.forEach((row, index) => {
        const cells = row.split(',');

        if (index !== 0 && row.trim() !== '') {
            const color = cells[2];
            const layer = cells[3];

            if (validLayers.includes(layer)) {
                uniqueColors.add(color);

                // Total Floor Area calculation
                if (!totalAreas[color]) {
                    totalAreas[color] = 0;
                }
                if (cells[5] === "ByLayer" && cells[6] === "ByLayer" && cells[1] === "Polyline" && cells[8] === "-1") {
                    totalAreas[color] += parseFloat(cells[7] || 0);
                }
            }
        }
    });

    // Calculate Stair Well, Lift Well, Duct/Cutout, Stairway, and Lift Lobby areas
    mainTableData.forEach(row => {
        const name = row.column2;
        const color = row.column3;
        const layer = row.column4;
        const linetype = row.column6;
        const lineweight = row.column7;
        const area = row.column8;
        const closed = row.column9;

        // Track the minimum color for each unique lineweight for Stair and Lift layers
        if (layer === "Stair" && name === "Polyline" && closed === "-1") {
            if (!stairMinColorByLineweight[lineweight]) {
                stairMinColorByLineweight[lineweight] = color;
            } else {
                stairMinColorByLineweight[lineweight] = Math.min(stairMinColorByLineweight[lineweight], color);
            }
        }

        if (layer === "Lift" && name === "Polyline" && closed === "-1") {
            if (!liftMinColorByLineweight[lineweight]) {
                liftMinColorByLineweight[lineweight] = color;
            } else {
                liftMinColorByLineweight[lineweight] = Math.min(liftMinColorByLineweight[lineweight], color);
            }
        }

        // Calculate Stair Well Area
        if (layer === "Stair" && linetype === "DASHED" && name === "Polyline" && closed === "-1") {
            if (!stairWellAreas[color]) {
                stairWellAreas[color] = 0;
            }
            stairWellAreas[color] += area;
        }

        // Calculate Lift Well Area
        if (layer === "Lift" && linetype === "ByLayer" && name === "Polyline" && closed === "-1") {
            if (!liftWellAreas[color]) {
                liftWellAreas[color] = 0;
            }
            liftWellAreas[color] += area;
        }

        // Calculate Duct/Cutout Area
        if (validLayers.includes(layer) && linetype === "DASHED" && name === "Polyline" && closed === "-1") {
            if (!ductCutoutAreas[color]) {
                ductCutoutAreas[color] = 0;
            }
            ductCutoutAreas[color] += area;
        }

        // Calculate Stairway Area (without DASHED Linetype)
        if (layer === "Stair" && linetype !== "DASHED" && name === "Polyline" && closed === "-1") {
            if (!stairwayAreas[color]) {
                stairwayAreas[color] = 0;
            }
            stairwayAreas[color] += area;
        }

        // Calculate Lift Lobby Area
        if (layer === "Lift" && linetype === "DASHED" && name === "Polyline" && closed === "-1") {
            if (!liftLobbyAreas[color]) {
                liftLobbyAreas[color] = 0;
            }
            liftLobbyAreas[color] += area;
        }
    });

    // Adjust Stairway area by directly deducting the specific areas
    mainTableData.forEach(row => {
        const name = row.column2;
        const color = row.column3;
        const layer = row.column4;
        const linetype = row.column6;
        const area = row.column8;
        const closed = row.column9;

        if (layer === "Stair" && linetype === "DASHED" && name === "Polyline" && closed === "-1") {
            if (stairwayAreas[color]) {
                stairwayAreas[color] -= area; // Directly deduct from Stairway area
            }
        }
    });

// Initialize Duct Cutout Areas properly for each unique color
uniqueColors.forEach(color => {
    const totalDuctArea = ductCutoutAreas[color] || 0;  // This holds the original total Duct Area value
    const stairWellArea = stairWellAreas[color] || 0;   // Stair Well Area for the current color
    const liftWellArea = liftWellAreas[color] || 0;     // Lift Well Area for the current color

    // Add detailed logging to verify the values step by step
    console.log(`Color: ${color}`);
    console.log(`Total Duct Area: ${totalDuctArea}`);
    console.log(`Stair Well Area: ${stairWellArea}`);
    console.log(`Lift Well Area: ${liftWellArea}`);

    // The calculation is simple: ductCutoutAreas should subtract the Stair and Lift areas
    const calculatedDuctCutoutArea = totalDuctArea - stairWellArea - liftWellArea;

    // Log the final result of the calculation before assigning
    console.log(`Final Duct/Cutout Area (Total - Stair - Lift) for Color ${color}: ${calculatedDuctCutoutArea}`);

    // Assign the calculated value to the ductCutoutAreas object
    ductCutoutAreas[color] = calculatedDuctCutoutArea;
});

    // Calculate areas by minimum color and lineweight combinations
    const filteredData = filterAndFindMinColorByLineweight(mainTableData);
    const areasByCombination = calculateAreasByCombination(filteredData, mainTableData);

    // Deduct areas for Stair Well and Lift Well based on unique lineweight and minimum color combinations
    Object.entries(areasByCombination.Stair).forEach(([lineweight, colorAreas]) => {
        Object.entries(colorAreas).forEach(([color, area]) => {
            if (stairWellAreas[color]) {
                stairWellAreas[color] -= area; // Deduct the area for this color and lineweight
                ductCutoutAreas[color] += area;
            }
        });
    });

    Object.entries(areasByCombination.Lift).forEach(([lineweight, colorAreas]) => {
        Object.entries(colorAreas).forEach(([color, area]) => {
            if (liftWellAreas[color]) {
                liftWellAreas[color] -= area; // Deduct the area for this color and lineweight
                ductCutoutAreas[color] += area;
            }
        });
    });

    // Convert object data into an array to sort
    const sortedData = Array.from(uniqueColors).map(color => {
        return {
            color: color,
            totalArea: totalAreas[color] || 0,
            stairWellArea: stairWellAreas[color] || 0,
            liftWellArea: liftWellAreas[color] || 0,
            ductCutoutArea: ductCutoutAreas[color] || 0,
            stairwayArea: stairwayAreas[color] || 0,
            liftLobbyArea: liftLobbyAreas[color] || 0
        };
    });

    // Sort the array by the first column (color in this case)
    sortedData.sort((a, b) => a.color - b.color);

    let totalSum = 0;
    let stairWellSum = 0;
    let liftWellSum = 0;
    let ductCutoutSum = 0;
    let effectiveFloorAreaSum = 0;
    let stairwaySum = 0;
    let liftLobbySum = 0;
    let netFloorAreaSum = 0;

    // Loop through the sorted data to populate the table
    sortedData.forEach(data => {
        const newRow = tableBody.insertRow();
        newRow.insertCell().textContent = data.color;
        const totalArea = data.totalArea;
        newRow.insertCell().textContent = formatNumber(totalArea.toFixed(3));

        // Add Stair Well column value after deduction
        const stairWellArea = data.stairWellArea;
        newRow.insertCell().textContent = formatNumber(stairWellArea.toFixed(3));

        // Add Lift Well column value after deduction
        const liftWellArea = data.liftWellArea;
        newRow.insertCell().textContent = formatNumber(liftWellArea.toFixed(3));

        // Add Duct/Cutout column value
        const ductCutoutArea = data.ductCutoutArea;
        newRow.insertCell().textContent = formatNumber(ductCutoutArea.toFixed(3));

        // Calculate Effective Floor Area (Total Area - Duct/Cutout Area)
        const effectiveFloorArea = totalArea - stairWellArea - liftWellArea - ductCutoutArea;
        newRow.insertCell().textContent = formatNumber(effectiveFloorArea.toFixed(3));

        // Add Stairway column value
        const stairwayArea = data.stairwayArea;
        newRow.insertCell().textContent = formatNumber(stairwayArea.toFixed(3));

        // Add Lift Lobby column value
        const liftLobbyArea = data.liftLobbyArea;
        newRow.insertCell().textContent = formatNumber(liftLobbyArea.toFixed(3));

        // Calculate Net Floor Area (Effective Floor Area - Stairway Area - Lift Lobby Area)
        const netFloorArea = effectiveFloorArea - stairwayArea - liftLobbyArea;
        newRow.insertCell().textContent = formatNumber(netFloorArea.toFixed(3));

        
        // Update totals
        totalSum += totalArea;
        stairWellSum += stairWellArea;
        liftWellSum += liftWellArea;
        ductCutoutSum += ductCutoutArea;
        effectiveFloorAreaSum += effectiveFloorArea;
        stairwaySum += stairwayArea;
        liftLobbySum += liftLobbyArea;
        netFloorAreaSum += netFloorArea;
    });

    // Update the total cells with calculated sums
    totalFloorAreaCell.textContent = formatNumber(totalSum.toFixed(3));
    totalStairWellCell.textContent = formatNumber(stairWellSum.toFixed(3));
    totalLiftWellCell.textContent = formatNumber(liftWellSum.toFixed(3));
    totalDuctCutoutCell.textContent = formatNumber(ductCutoutSum.toFixed(3));
    totalEffectiveFloorAreaCell.textContent = formatNumber(effectiveFloorAreaSum.toFixed(3));
    totalStairwayCell.textContent = formatNumber(stairwaySum.toFixed(3));
    totalLiftLobbyCell.textContent = formatNumber(liftLobbySum.toFixed(3));
    totalNetFloorAreaCell.textContent = formatNumber(netFloorAreaSum.toFixed(3));

    localStorage.setItem('effectiveFloorAreaSum', effectiveFloorAreaSum);
    console.log('Total Effective Floor Area:', effectiveFloorAreaSum);

    localStorage.setItem('netFloorAreaSum', netFloorAreaSum);
    console.log('Total Net Floor Area:', netFloorAreaSum);
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

function formatNumber(value) {
    const number = parseFloat(value);
    return isNaN(number) ? '0.000' : number.toFixed(3);
}


document.addEventListener('DOMContentLoaded', function () {
    const csvData = localStorage.getItem('csvData');

    // Check if CSV data is loaded
    if (!csvData) {
        console.error('No CSV data found in localStorage.');
        return;
    }

    // Parse the CSV data
    const mainTableData = parseCSVToArray(csvData);

    // Filter for "Lift" and "Stair" layers and find minimum color for each lineweight
    const filteredData = filterAndFindMinColorByLineweight(mainTableData);

    // Calculate areas for unique lineweight and minimum color combinations
    const areasByCombination = calculateAreasByCombination(filteredData, mainTableData);

    // Log the results
    console.log('Areas for Unique Lineweight and Minimum Color Combinations:', areasByCombination);
});

function filterAndFindMinColorByLineweight(data) {
    // Find minimum color for each lineweight for "Stair" and "Lift" layers
    const stairMinColorByLineweight = {};
    const liftMinColorByLineweight = {};

    data.forEach(row => {
        if (row.column2 === "Polyline" && row.column9 === "-1") {
            const layer = row.column4;
            const lineweight = row.column7;
            const color = parseInt(row.column3, 10);

            if (layer === "Stair") {
                if (!stairMinColorByLineweight[lineweight] || color < stairMinColorByLineweight[lineweight]) {
                    stairMinColorByLineweight[lineweight] = color;
                }
            } else if (layer === "Lift") {
                if (!liftMinColorByLineweight[lineweight] || color < liftMinColorByLineweight[lineweight]) {
                    liftMinColorByLineweight[lineweight] = color;
                }
            }
        }
    });

    return { stairMinColorByLineweight, liftMinColorByLineweight };
}

function calculateAreasByCombination({ stairMinColorByLineweight, liftMinColorByLineweight }, data) {
    const areas = {
        Stair: {},
        Lift: {}
    };

    // Function to accumulate areas based on layer, lineweight, minColor, and linetype
    function accumulateAreas(layer, minColorByLineweight, linetypeFilter, areasObject) {
        Object.entries(minColorByLineweight).forEach(([lineweight, minColor]) => {
            data.forEach(row => {
                const rowColor = parseInt(row.column3, 10);
                const rowLineweight = row.column7;
                const rowLinetype = row.column6;
                const rowLayer = row.column4;
                const rowClosed = row.column9;

                // Ensure we only accumulate areas for valid rows
                if (rowLayer === layer && rowLineweight === lineweight && rowColor === minColor && rowLinetype === linetypeFilter && rowClosed === "-1") {
                    const color = row.column3; // Color
                    const area = row.column8;  // Area

                    if (!areasObject[lineweight]) {
                        areasObject[lineweight] = {};
                    }
                    if (!areasObject[lineweight][color]) {
                        areasObject[lineweight][color] = 0;
                    }
                    areasObject[lineweight][color] += area;
                }
            });
        });
    }

    // Accumulate areas for both Stair and Lift layers
    accumulateAreas('Stair', stairMinColorByLineweight, 'DASHED', areas.Stair);
    accumulateAreas('Lift', liftMinColorByLineweight, 'ByLayer', areas.Lift);

    console.log('Accumulated areas for Stair and Lift layers:', areas); // Log for debugging

    return areas;
}




