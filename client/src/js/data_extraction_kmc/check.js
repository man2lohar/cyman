document.addEventListener('DOMContentLoaded', function () {
    const csvDataSecondary = localStorage.getItem('csvData');
    if (csvDataSecondary) {
        displayFilteredDataSecondary(csvDataSecondary);
    }
});

function displayFilteredDataSecondary(csv) {
    const validLayersSecondary = ["Residential"];
    const otherLayersSecondary = ["Common Area", "Parking_Area", "Tenement", "Tenement_Ext_1", "Tenement_Single", "Tenement_Single_Ext_1"];

    const rowsSecondary = csv.split('\n');
    const tableBodySecondary = document.getElementById('compare-table').getElementsByTagName('tbody')[0];
    const totalFloorAreaCellSecondary = document.getElementById('total-floor-area-seocndary');
    const otherAreaCellSecondary = document.getElementById('total-common-parking-tenements');
    const differenceCellSecondary = document.getElementById('Difference');

    const uniqueColorsSecondary = new Set();
    const totalAreasSecondary = {};
    const otherAreasSecondary = {};

    let totalSumSecondary = 0;
    let otherAreaSumSecondary = 0;
    let differenceAreaSumSecondary = 0;

    // Populate totalAreasSecondary and uniqueColorsSecondary
    rowsSecondary.forEach((row, index) => {
        const cellsSecondary = row.split(',');

        if (index !== 0 && row.trim() !== '') {
            const colorSecondary = cellsSecondary[2];
            const layerSecondary = cellsSecondary[3];

            if (validLayersSecondary.includes(layerSecondary)) {
                uniqueColorsSecondary.add(colorSecondary);

                // Total Floor Area calculation
                if (!totalAreasSecondary[colorSecondary]) {
                    totalAreasSecondary[colorSecondary] = 0;
                }
                if (cellsSecondary[5] === "ByLayer" && cellsSecondary[6] === "ByLayer" && cellsSecondary[1] === "Polyline" && cellsSecondary[8] === "-1" || cellsSecondary[8] === "TURE") {
                    totalAreasSecondary[colorSecondary] += parseFloat(cellsSecondary[7] || 0);
                }

                // Deduct from total if new condition is met
                if (cellsSecondary[5] === "DASHED" && cellsSecondary[6] === "ByLayer" && cellsSecondary[1] === "Polyline" && cellsSecondary[8] === "-1" || cellsSecondary[8] === "TURE") {
                    totalAreasSecondary[colorSecondary] -= parseFloat(cellsSecondary[7] || 0);
                }
            }

            if (otherLayersSecondary.includes(layerSecondary)) {
                uniqueColorsSecondary.add(colorSecondary);

                // Initialize the other area for this color if not already done
                if (!otherAreasSecondary[colorSecondary]) {
                    otherAreasSecondary[colorSecondary] = 0;
                }

                // Apply different conditions based on the layer
                switch (layerSecondary) {
                    case "Common Area":
                        if (cellsSecondary[5] === "ByLayer" && cellsSecondary[6] === "ByLayer" && cellsSecondary[1] === "Polyline" && cellsSecondary[8] === "-1") {
                            otherAreasSecondary[colorSecondary] += parseFloat(cellsSecondary[7] || 0);
                        }
                        if (cellsSecondary[5] === "DASHED" && cellsSecondary[6] === "ByLayer" && cellsSecondary[1] === "Polyline" && cellsSecondary[8] === "-1") {
                            otherAreasSecondary[colorSecondary] -= parseFloat(cellsSecondary[7] || 0);
                        }
                        break;

                    case "Parking_Area":
                        if (cellsSecondary[5] === "ByLayer" && cellsSecondary[6] !== "ByLayer" && cellsSecondary[1] === "Polyline" && cellsSecondary[8] === "-1") {
                            otherAreasSecondary[colorSecondary] += parseFloat(cellsSecondary[7] || 0);
                        }
                        if (cellsSecondary[5] === "DASHED" && cellsSecondary[6] !== "ByLayer" && cellsSecondary[1] === "Polyline" && cellsSecondary[8] === "-1") {
                            otherAreasSecondary[colorSecondary] -= parseFloat(cellsSecondary[7] || 0);
                        }
                        break;

                    case "Tenement":
                    case "Tenement_Ext_1":
                    case "Tenement_Single":
                    case "Tenement_Single_Ext_1":
                        if (cellsSecondary[5] === "ByLayer" && cellsSecondary[6] !== "ByLayer" && cellsSecondary[1] === "Polyline" && cellsSecondary[8] === "-1") {
                            otherAreasSecondary[colorSecondary] += parseFloat(cellsSecondary[7] || 0);
                        }
                        if (cellsSecondary[5] === "DASHED" && cellsSecondary[6] !== "ByLayer" && cellsSecondary[1] === "Polyline" && cellsSecondary[8] === "-1") {
                            otherAreasSecondary[colorSecondary] -= parseFloat(cellsSecondary[7] || 0);
                        }
                        break;

                    default:
                        console.warn(`Unknown layer encountered: ${layerSecondary}`);
                }
            }
        }
    });

    // Convert object data into an array to sort
    const sortedDataSecondary = Array.from(uniqueColorsSecondary).map(color => {
        return {
            color: color,
            totalArea: totalAreasSecondary[color] || 0,
            otherArea: otherAreasSecondary[color] || 0,
        };
    });

    // Sort the array by the first column (color in this case)
    sortedDataSecondary.sort((a, b) => a.color - b.color);

    // Loop through the sorted data to populate the table
    sortedDataSecondary.forEach(data => {
        const newRowSecondary = tableBodySecondary.insertRow();
        newRowSecondary.insertCell().textContent = data.color;

        const totalAreaSecondary = data.totalArea;
        newRowSecondary.insertCell().textContent = formatNumberSecondary(totalAreaSecondary.toFixed(3));

        const otherAreaSecondary = data.otherArea;
        newRowSecondary.insertCell().textContent = formatNumberSecondary(otherAreaSecondary.toFixed(3));

        const differenceAreaSecondary = totalAreaSecondary - otherAreaSecondary;
        newRowSecondary.insertCell().textContent = formatNumberSecondary(differenceAreaSecondary.toFixed(3));

        totalSumSecondary += totalAreaSecondary;
        otherAreaSumSecondary += otherAreaSecondary;
        differenceAreaSumSecondary += differenceAreaSecondary;
    });

    // Update the total cells with calculated sums
    totalFloorAreaCellSecondary.textContent = formatNumberSecondary(totalSumSecondary.toFixed(3));
    otherAreaCellSecondary.textContent = formatNumberSecondary(otherAreaSumSecondary.toFixed(3));
    differenceCellSecondary.textContent = formatNumberSecondary(differenceAreaSumSecondary.toFixed(3));

    console.log('Total Difference : ', differenceAreaSumSecondary.toFixed(3));
    // Calculate valid rows count
    const validRowCountSecondary = sortedDataSecondary.length;
    console.log('Nos. of rows in table : ', validRowCountSecondary);
    const tablerow = validRowCountSecondary/1000;
    console.log('Nos. of rows in table : ', tablerow);

    // Check if the absolute value of the number is below the threshold, effectively treating values near 0 as 0
    if (Math.abs(differenceAreaSumSecondary) <= validRowCountSecondary / 1000) {
        document.getElementById('compare-table-container').style.display = 'none'; // Hide the table if the condition is met
    } else {
        document.getElementById('compare-table-container').style.display = 'block'; // Show the table otherwise
        alert("Total residential area is not equal to Total common area, parking area & tenements area. (See Comparative Table)\n" +
            "I think there is a mismatch in layers. So, calculations might not be correct !\n" +
            "Please check the layers once !");      
    }
}

function formatNumberSecondary(value) {
    const numberSecondary = parseFloat(value);
    return isNaN(numberSecondary) ? '0.000' : numberSecondary.toFixed(3);
}
