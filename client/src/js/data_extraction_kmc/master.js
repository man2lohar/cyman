document.getElementById('back-button').addEventListener('click', function() {
    window.location.href = 'index_kmc.html';
});

document.addEventListener('DOMContentLoaded', function() {
    const csvData = localStorage.getItem('csvData');
    const totalParkingNos = localStorage.getItem('totalParkingNos');
    const totalParkingArea = localStorage.getItem('totalParkingArea');
    const storedSum = parseFloat(localStorage.getItem('layerSumTotal')) || 0;
    const effectiveFloorAreaSum = parseFloat(localStorage.getItem('effectiveFloorAreaSum')) || 0;
    const treecoversum = parseFloat(localStorage.getItem('treeCoverNetArea')) || 0;
    const cbloftsum = parseFloat(localStorage.getItem('cbLoftNetArea')) || 0;

    if (csvData) {
        displayFilteredData(csvData);
    }

    const highestPercentageItem = JSON.parse(localStorage.getItem('highestPercentageItem'));
    if (highestPercentageItem) {
        document.getElementById('usegroup').textContent = highestPercentageItem.layer;
    } else {
        document.getElementById('usegroup').textContent = 'No data available';
    }

    if (totalParkingNos) {
        document.getElementById('pro-car').textContent = totalParkingNos;
    } else {
        document.getElementById('pro-car').textContent = 0 ;
    }

    if (totalParkingArea) {
        document.getElementById('per-park-area').textContent = totalParkingArea + ' Sq.m.';
    } else {
        document.getElementById('per-park-area').textContent = 0 + ' Sq.m.';
    }
    // Displaying total floor area with proper formatting:
    if (effectiveFloorAreaSum) {
        document.getElementById('total-floor').textContent = `${effectiveFloorAreaSum.toFixed(3)} Sq.m.`;
    } else {
        document.getElementById('total-floor').textContent = 0 + ' Sq.m.';
    }
    // Displaying Additional floor area:
    if (storedSum) {
        document.getElementById('additional-floor').textContent = `${storedSum.toFixed(3)} Sq.m.`;
    } else {
        document.getElementById('additional-floor').textContent = 0 + ' Sq.m.';
    }
    // Displaying Total floor area for fess:
    const totalFeesArea = effectiveFloorAreaSum + storedSum;
    const SumFeesAreacell = document.getElementById('total-fees-area');
    if (SumFeesAreacell) {
        SumFeesAreacell.textContent = `${totalFeesArea.toFixed(3)} Sq.m.`;
    }
    
    // Displaying Cupboard / Loft area:
        // Proposed percentage of CB-Loft Area
        const proposedcbloftPercentage=(cbloftsum/totalFeesArea)*100
    if (cbloftsum) {
        document.getElementById('pro-cb').textContent = `${cbloftsum.toFixed(3)} Sq.m. (${proposedcbloftPercentage.toFixed(3)}%)`;
    } else {
        document.getElementById('pro-cb').textContent = 0 + ' Sq.m.';
    }

    calculateFAR();
    calculateGroundCoverage();
    showPopup();
    calculateHeight();
    extractOpenSpaces();
    TreeCover();

    // Proposed percentage of TreeCover Area
    const landAreaBoundary1 = parseFloat(document.getElementById('land-area-doc').textContent.replace(/,/g, '').split(' ')[0]);
        //console.log('Land Area Document (min):', landAreaBoundary1);
    const proposedTreecoverPercentage=(treecoversum/landAreaBoundary1)*100
    // Displaying Tree Cover area:
    if (treecoversum) {
        document.getElementById('pro-tree').textContent = `${treecoversum.toFixed(3)} Sq.m. (${proposedTreecoverPercentage.toFixed(3)}%)`;
    } else {
        document.getElementById('pro-tree').textContent = 0 + ' Sq.m.';
    }
    Compare();
});

// Retrieve the values from localStorage
const totalParkingRequired = parseInt(localStorage.getItem('totalParkingRequired')) || 0;
const totalReqCarParking = parseInt(localStorage.getItem('totalReqCarParking')) || 0;

console.log('Total Required Car Parking For Other Use-group:', totalParkingRequired);
console.log('Total Required Car Parking for Tenements:', totalReqCarParking);
// Sum the values
const totalSum = totalParkingRequired + totalReqCarParking;
console.log('Total Required Car Parking:', totalSum);

// Display the result in the cell with id="car-parking-sum"
const sumCell = document.getElementById('per-car');
if (sumCell) {
    sumCell.textContent = totalSum;
}

function calculateGroundCoverage() {
    // Get land area values and remove commas for proper float conversion
    const landAreaBoundary = parseFloat(document.getElementById('land-area').textContent.replace(/,/g, '').split(' ')[0]);
    const landAreaDoc = parseFloat(document.getElementById('land-area-doc').textContent.replace(/,/g, '').split(' ')[0]);
    const proposedGroundCoverage = parseFloat(document.getElementById('pro-ground-coverage').textContent.replace(/,/g, '').split(' ')[0]);
    const buildingType = document.getElementById('usegroup').textContent.toLowerCase();

    // Determine the minimum land area
    const minLandArea = Math.min(landAreaBoundary, landAreaDoc);

    // Coverage Table for different building types
    const coverageTable = {
        residential: { upTo200: 60, upTo500: 50, above500: 50, above5000: 45 },
        educational: { upTo200: 50, upTo500: 45, above500: 45, above5000: 35 },
        institutional: { upTo200: 40, upTo500: 40, above500: 40, above5000: 35 },
        assembly: { upTo200: 40, upTo500: 40, above500: 40, above5000: 35 },
        mercantile_retail: { upTo200: 40, upTo500: 40, above500: 40, above5000: 35 },
        mercantile_wholesale: { upTo200: 40, upTo500: 40, above500: 40, above5000: 35 },
        industrial: { upTo200: 40, upTo500: 40, above500: 40, above5000: 35 },
        storage: { upTo200: 40, upTo500: 40, above500: 40, above5000: 35 },
        hazardous: { upTo200: 40, upTo500: 40, above500: 40, above5000: 35 },
        business: { upTo200: 40, upTo500: 40, above500: 40, above5000: 35 }
    };

    function getPermissibleCoveragePercentage(plotSize, buildingType) {
        if (plotSize <= 200) {
            return coverageTable[buildingType].upTo200;
        } else if (plotSize > 200 && plotSize <= 500) {
            return interpolate(200, 500, coverageTable[buildingType].upTo200, coverageTable[buildingType].upTo500, plotSize);
        } else if (plotSize > 500 && plotSize <= 5000) {
            return coverageTable[buildingType].above500;
        } else if (plotSize > 5000) {
            return coverageTable[buildingType].above5000;
        } else {
            return 0;
        }
    }

    // Calculate Permissible Coverage Percentage and Area
    const permissibleCoveragePercentage = getPermissibleCoveragePercentage(minLandArea, buildingType);
    const permissibleCoverageArea = (minLandArea * permissibleCoveragePercentage) / 100;

    // Calculate Proposed Ground Coverage Percentage
    const proposedCoveragePercentage = (proposedGroundCoverage / minLandArea) * 100;

    // Update the elements with calculated values
    const permissibleCoverageElement = document.getElementById('per-ground-coverage');
    permissibleCoverageElement.textContent = `${permissibleCoverageArea.toFixed(3)} Sq. m. (${permissibleCoveragePercentage.toFixed(3)}%)`;

    const proposedCoverageElement = document.getElementById('pro-ground-coverage');
    proposedCoverageElement.textContent = `${proposedGroundCoverage.toFixed(3)} Sq. m. (${proposedCoveragePercentage.toFixed(3)}%)`;

    // **Add style changes if proposed coverage exceeds permissible coverage**
    if (proposedCoveragePercentage > permissibleCoveragePercentage) {
        proposedCoverageElement.classList.add('text-red');
    } else {
        proposedCoverageElement.classList.remove('text-red');
    }
}

function interpolate(minValue, maxValue, minPercent, maxPercent, size) {
    const ratio = (size - minValue) / (maxValue - minValue);
    return minPercent + ratio * (maxPercent - minPercent);
}

function showPopup() {
    const popup = document.getElementById('popup');
    const manualLandAreaInput = document.getElementById('manual-land-area');
    const manualFARInput = document.getElementById('manual-far');
    const manualParkingAreaInput = document.getElementById('manual-parking-area');
    const updateButton = document.getElementById('update-button');
    const closeButton = document.getElementById('close-button');

    // Show the popup
    popup.style.display = 'flex';

    // Event listener for the update button
    updateButton.addEventListener('click', function() {
        const landAreaDoc = parseFloat(manualLandAreaInput.value);
        const far = parseFloat(manualFARInput.value);
        const park = parseFloat(manualParkingAreaInput.value);
        
        if (!isNaN(landAreaDoc)) {
            document.getElementById('land-area-doc').textContent = formatNumber(landAreaDoc.toFixed(3)) + " Sq.m.";
            calculateGroundCoverage(); // Recalculate after update
        }

        if (!isNaN(far)) {
            document.getElementById('per-far').textContent = formatNumber(far.toFixed(3));
        }

        if (!isNaN(park)) {
            document.getElementById('per-park-area').textContent = formatNumber(park.toFixed(3)) + " Sq.m.";

            // Store the new parking area in localStorage (optional if you want persistence)
            localStorage.setItem('totalParkingArea', park);
        }
        // Recalculate Proposed FAR after updating parking area
        calculateProposedFAR();
        Compare();
    });
   

    // Event listener for the close button
    closeButton.addEventListener('click', function() {
        popup.style.display = 'none';
    });
}

function calculateFAR() {
    const widthOfAccess = parseFloat(document.getElementById('roadwidth').textContent);
    const buildingType = document.getElementById('usegroup').textContent.toLowerCase();
    const permissibleFarElement = document.getElementById('per-far');

    if (isNaN(widthOfAccess) || widthOfAccess === 0) {
        permissibleFarElement.textContent = 'No width of access';
        permissibleFarElement.classList.add('text-red');
        return;
    }
    const floorAreaRatioTable = [
        { width: [0, 2.4], residential: 0, educational: 0, industrial: 0, storage: 0, hazardous: 0, assembly: 0 , business: 0, institutional: 0, mercantile_retail:0, Mercantile_wholesale:0},
        { width: [2.4, 3.5], residential: 1.25, educational: 0, industrial: 0, storage: 0, hazardous: 0, assembly: 0, business: 0, institutional: 0, mercantile_retail:0, Mercantile_wholesale:0 },
        { width: [3.5, 7.0], residential: 1.75, educational: 0, industrial: 0, storage: 0, hazardous: 0, assembly: 0 , business: 0, institutional: 0, mercantile_retail:0, Mercantile_wholesale:0},
        { width: [7.0, 9.0], residential: 2.0, educational: 2.0, industrial: 0, storage: 0, hazardous: 0, assembly: 0 , business: 0, institutional: 0, mercantile_retail:0, Mercantile_wholesale:0},
        { width: [9.0, 15.0], residential: 2.25, educational: 2.25, industrial: 2.0, storage: 2.0, hazardous: 2.0, assembly: 2.0 , business: 2.0, institutional: 2.0, mercantile_retail:2.0, Mercantile_wholesale:2.0},
        { width: [15.0, 21.5], residential: 2.5, educational: 2.5, industrial: 2.0, storage: 2.0, hazardous: 2.0, assembly: 2.25 , business: 2.25, institutional: 2.25, mercantile_retail:2.25, Mercantile_wholesale:2.25},
        { width: [21.5, 24.0], residential: 2.75, educational: 2.75, industrial: 2.0, storage: 2.0, hazardous: 2.0, assembly: 2.5 , business: 2.5, institutional: 2.5, mercantile_retail:2.5, Mercantile_wholesale:2.5},
        { width: [24.0, Infinity], residential: 3.0, educational: 3.0, industrial: 2.0, storage: 2.0, hazardous: 2.0, assembly: 2.75 , business: 2.75, institutional: 2.75, mercantile_retail:2.75, Mercantile_wholesale:2.75}
    ];

    function getFloorAreaRatio(widthOfAccess, buildingType) {
        for (let row of floorAreaRatioTable) {
            if (widthOfAccess > row.width[0] && widthOfAccess <= row.width[1]) {
                return row[buildingType];
            }
        }
        return null;
    }

    const farValue = getFloorAreaRatio(widthOfAccess, buildingType);
    if (farValue !== null) {
        document.getElementById('per-far').textContent = farValue;
    } else {
        document.getElementById('per-far').textContent = "";
    }
    Compare();
}

//  Calculate proposed F.A.R.
function calculateProposedFAR() {
    const LandArea = parseFloat(document.getElementById('land-area').textContent.replace(/,/g, '')) || 0;
    const minLandDoc = parseFloat(document.getElementById('land-area-doc').textContent.replace(/,/g, '')) || 0;
    const totalParkingArea = parseFloat(localStorage.getItem('totalParkingArea')) || 0;
    const netFloorAreaSum = parseFloat(localStorage.getItem('netFloorAreaSum')) || 0;
    

    // Ensure all necessary data is available for calculations
    if (ParkingAreaSum >= 0) {
        const minLandArea = Math.min(LandArea, minLandDoc);
        const netParkingArea = Math.min(totalParkingArea, ParkingAreaSum);
        const proposedFAR = (netFloorAreaSum - netParkingArea) / minLandArea;

        // Display the calculated FAR
        const proFAR = document.getElementById('pro-far');
        if (proFAR) {
            proFAR.textContent = proposedFAR.toFixed(3);
        }
    } else {
        console.log('Insufficient data for FAR calculation');
    }
}

function TreeCover(){
    const landAreaBoundary = parseFloat(document.getElementById('land-area').textContent.replace(/,/g, '').split(' ')[0]);
    const totalfloorarea =parseFloat(document.getElementById('total-fees-area').textContent.replace(/,/g, '').split(' ')[0]);

    const treecover =(0.0025 * totalfloorarea)*landAreaBoundary/100
    const permissibleTreecoverPercentage = (0.0025 * totalfloorarea)

    const cbloftArea =0.03 * totalfloorarea
    const permissiblecbloftAreaPercentage=3

    const treecoverCell = document.getElementById('per-tree');
    if (treecoverCell) {
        treecoverCell.textContent = `${treecover.toFixed(3)} Sq. m. (${permissibleTreecoverPercentage.toFixed(3)}%)`;
    }
    const cbloftAreaCell = document.getElementById('per-cb');
    if (cbloftAreaCell) {
        cbloftAreaCell.textContent =`${cbloftArea.toFixed(3)} Sq. m. (${permissiblecbloftAreaPercentage.toFixed(3)}%)`;
    }
}
function Compare() {
    const permissibleFarElement = document.getElementById('per-far'); // Get permissible FAR element for comparison
    const proposedFarElement = document.getElementById('pro-far'); // Get proposed FAR element for comparison
    const permissibleTreeCoverElement = document.getElementById('per-tree'); // Get permissible TreeCover element for comparison
    const proposedTreeCoverElement = document.getElementById('pro-tree'); // Get proposed TreeCover element for comparison
    const permissiblecbloftAreaElement = document.getElementById('per-cb'); // Get permissible cbloftArea element for comparison
    const proposedcbloftAreaElement = document.getElementById('pro-cb'); // Get proposed cbloftArea element for comparison
    const requiredcarparkingElement = document.getElementById('per-car'); // Get proposed cbloftArea element for comparison
    const proposedcarparkingElement = document.getElementById('pro-car'); // Get proposed cbloftArea element for comparison

    const permissibleFARValue = parseFloat(permissibleFarElement.textContent.trim());
    const proposedFARValue = parseFloat(proposedFarElement.textContent.trim());
    const permissibleTreeCoverValue = parseFloat(permissibleTreeCoverElement.textContent.replace(/ Sq.m./, '')) || 0;
    const proposedTreeCoverValue = parseFloat(proposedTreeCoverElement.textContent.replace(/ Sq.m./, '')) || 0; //
    const permissiblecbloftAreaValue = parseFloat(permissiblecbloftAreaElement.textContent.replace(/ Sq.m./, '')) || 0; 
    const proposedcbloftAreaValue = parseFloat(proposedcbloftAreaElement.textContent.replace(/ Sq.m./, '')) || 0;
    const requiredcarValue = parseFloat(requiredcarparkingElement.textContent.trim());
    const proposedcarValue = parseFloat(proposedcarparkingElement.textContent.trim());

    // Ensure permissible and proposed FAR values are valid numbers before comparison
    if (isNaN(permissibleFARValue) || isNaN(proposedFARValue)) {
        return;
    }

    // Compare values and apply class to the proposed FAR element
    if (proposedFARValue > permissibleFARValue) {
        proposedFarElement.classList.add('text-red');
    } else {
        proposedFarElement.classList.remove('text-red'); 
    }
    // Compare values and apply class to the proposed TreeCover element
    if (proposedTreeCoverValue < permissibleTreeCoverValue) {
        proposedTreeCoverElement.classList.add('text-red');
    } else {
        proposedTreeCoverElement.classList.remove('text-red');
    }
    // Compare values and apply class to the proposed TreeCover element
    if (permissiblecbloftAreaValue < proposedcbloftAreaValue) {
        proposedcbloftAreaElement.classList.add('text-red');
    } else {
        proposedcbloftAreaElement.classList.remove('text-red');
    }
    // Compare values and apply class to the proposed Car-Parking element
    if (proposedcarValue < requiredcarValue) {
        proposedcarparkingElement.classList.add('text-red');
    } else {
        proposedcarparkingElement.classList.remove('text-red');
    }

            // COMAPARISON OF THE OPEN SPACES//
    // Check if table cells are found
    const frontCell = document.getElementById('per-front');
    const side1Cell = document.getElementById('per-side1');
    const side2Cell = document.getElementById('per-side2');
    const rearCell = document.getElementById('per-rear');

    // Compare Open Spaces (use different IDs for each proposed cell)
    const FrontOpenSpaceCell = document.getElementById('pro-front');
    const Side1OpenSpaceCell = document.getElementById('pro-side1');
    const Side2OpenSpaceCell = document.getElementById('pro-side2');
    const RearOpenSpaceCell = document.getElementById('pro-rear');

    // Parse and retrieve numeric values for proposed and permitted open spaces
    const FrontOpenValue = parseFloat(FrontOpenSpaceCell.textContent.replace(/ M./, '')) || 0;
    const Side1OpenValue = parseFloat(Side1OpenSpaceCell.textContent.replace(/ M./, '')) || 0;
    const Side2OpenValue = parseFloat(Side2OpenSpaceCell.textContent.replace(/ M./, '')) || 0;
    const RearOpenValue = parseFloat(RearOpenSpaceCell.textContent.replace(/ M./, '')) || 0;

    const frontCell0 = parseFloat(frontCell.textContent.replace(/ M./, '')) || 0;
    const side1Cell0 = parseFloat(side1Cell.textContent.replace(/ M./, '')) || 0;
    const side2Cell0 = parseFloat(side2Cell.textContent.replace(/ M./, '')) || 0;
    const rearCell0 = parseFloat(rearCell.textContent.replace(/ M./, '')) || 0;

    // Ensure all values are valid for comparison
    if (isNaN(frontCell0) || isNaN(FrontOpenValue) || 
        isNaN(side1Cell0) || isNaN(Side1OpenValue) || 
        isNaN(side2Cell0) || isNaN(Side2OpenValue) || 
        isNaN(rearCell0) || isNaN(RearOpenValue)) {
        console.error("Invalid Open Spaces for comparison.");
        return;
    }

    // Compare values and apply class to the proposed TreeCover element
    if (frontCell0 > FrontOpenValue) {
        FrontOpenSpaceCell.classList.add('text-red');
    } else {
        FrontOpenSpaceCell.classList.remove('text-red');
    }
    if (side1Cell0 > Side1OpenValue) {
        Side1OpenSpaceCell.classList.add('text-red');
    } else {
        Side1OpenSpaceCell.classList.remove('text-red');
    }
    if (side2Cell0 > Side2OpenValue) {
        Side2OpenSpaceCell.classList.add('text-red');
    } else {
        Side2OpenSpaceCell.classList.remove('text-red');
    }
    if (rearCell0 > RearOpenValue) {
        RearOpenSpaceCell.classList.add('text-red');
    } else {
        RearOpenSpaceCell.classList.remove('text-red');
    }    
    
}

function calculateHeight() {
    const widthOfAccess = parseFloat(document.getElementById('roadwidth').textContent);
    const permissibleHeightElement = document.getElementById('per-height');

    if (isNaN(widthOfAccess) || widthOfAccess === 0) {
        permissibleHeightElement.textContent = 'No width of access';
        permissibleHeightElement.classList.add('text-red');
        return;
    }

    const HeightTable = [
        { width: [0, 2.4], height: 7.0 },
        { width: [2.4, 3.5], height: 10.0 },
        { width: [3.5, 7.0], height: 12.5 },
        { width: [7.0, 9.0], height: 21.5 },
        { width: [9.0, 12.0], height: 40.0 },
        { width: [12.0, 15.0], height: 60.0 },
        { width: [15.0, Infinity], height: Infinity }
    ];

    function getHeight(widthOfAccess) {
        for (let row of HeightTable) {
            if (widthOfAccess > row.width[0] && widthOfAccess <= row.width[1]) {
                return row.height;
            }
        }
        return null;
    }

    const heightValue = getHeight(widthOfAccess); // Call getHeight instead of getFloorAreaRatio

    if (heightValue !== null) {
        permissibleHeightElement.textContent = heightValue.toFixed(2)+ " M."; // Use heightValue instead of farValue
    } else {
        permissibleHeightElement.textContent = "No permissible height";
        permissibleHeightElement.classList.add('text-red');
    }
    const proposedHeightElement = document.getElementById('pro-height');
    const proposedHeight = parseFloat(proposedHeightElement.textContent.replace(/ M./, '')) || 0; // Retrieve proposed height and convert to number
    const permissibleHeight = parseFloat(permissibleHeightElement.textContent.replace(/ M./, '')) || 0; // Retrieve permissible height and convert to number

    if (proposedHeight > permissibleHeight) {
        // Change text color to red if proposed height exceeds permissible height
        proposedHeightElement.classList.add('text-red');
    } else {
        // Remove red color class if within permissible height
        proposedHeightElement.classList.remove('text-red');
    }
}
let ParkingAreaSum = 0;

function displayFilteredData(csv) {
    const validLayers = [
        "Residential", "Mercantile_wholesale", "Mercantile_retail", "Business",
        "Institutional", "Storage", "Assembly", "Hazardous", "Industrial", "Educational"
    ];

    const mainTableData = parseCSVToArray(csv);
    const RoadWidthCell = document.getElementById('roadwidth');
    const HeightCell = document.getElementById('pro-height');
    const landAreaCell = document.getElementById('land-area');
    const landAreaDocCell = document.getElementById('land-area-doc');
    const groundCoverageCell = document.getElementById('pro-ground-coverage');
    const FrontOpenSpaceCell = document.getElementById('pro-front');
    const Side1OpenSpaceCell = document.getElementById('pro-side1');
    const Side2OpenSpaceCell = document.getElementById('pro-side2');
    const RearOpenSpaceCell = document.getElementById('pro-rear');
    

    let RoadWidthSum = 0;
    let HeightSum = 0;
    let landAreaSum = 0;
    let GroundCoverageSum = 0;
    let FrontOpenSpaceSum=0;
    let Side1OpenSpaceSum=0;
    let Side2OpenSpaceSum=0;
    let RearOpenSpaceSum=0;
    ParkingAreaSum = 0;  // Reset ParkingAreaSum before each calculation


    mainTableData.forEach(row => {
        const name = row.column2;
        const color = row.column3;
        const layer = row.column4;
        const length = row.column5;
        const linetype = row.column6;
        const lineweight = row.column7;
        const area = row.column8;
        const closed = row.column9;

            //Extract Main Means of Access (Road)
        if (name === "Line" && color === "230" && layer === "Road" && linetype === "ByLayer" && lineweight === "0.15 mm") {
            RoadWidthSum += length;
        }
            //Extract Proposed Height
        if (name === "Line" && color === "magenta" && layer === "Height" && linetype === "ByLayer" && lineweight === "0.15 mm") {
            HeightSum += length;
        }
            //Extract Plot
        if (name === "Polyline" && color === "240" && layer === "Plot" && linetype === "PHANTOM2" && lineweight === "0.50 mm" && closed === "-1") {
            landAreaSum += area;
        }
            //Extract Parking Area
        if (name === "Polyline" && layer === "Parking_Area" && lineweight === "0.15 mm" && closed === "-1") {
            ParkingAreaSum += area;
        }
            //Extract Ground Coverage
        if (name === "Polyline" && (color <= 53 || color >= 152) && layer === "Ground Coverage" && closed === "-1") {
            if (linetype === "DASHED") {
                GroundCoverageSum -= area;  // Deduct the area if linetype is "DASHED"
            } else {
                GroundCoverageSum += area;  // Add the area if linetype is not "DASHED"
            }
        }
            //Extract Open Spaces
        if (name === "Line" && color === "53" && layer === "Open Space" && linetype === "ByLayer" && lineweight === "ByLayer") {
            FrontOpenSpaceSum += length;
        }
        if (name === "Line" && color === "73" && layer === "Open Space" && linetype === "ByLayer" && lineweight === "ByLayer") {
            Side1OpenSpaceSum += length;
        }
        if (name === "Line" && color === "83" && layer === "Open Space" && linetype === "ByLayer" && lineweight === "ByLayer") {
            Side2OpenSpaceSum += length;
        }
        if (name === "Line" && color === "63" && layer === "Open Space" && linetype === "ByLayer" && lineweight === "ByLayer") {
            RearOpenSpaceSum += length;
        }
        });
    
    RoadWidthCell.textContent = formatNumber(RoadWidthSum) + " M.";
    HeightCell.textContent = formatNumber(HeightSum) + " M.";
    landAreaCell.textContent = formatNumber(landAreaSum.toFixed(3)) + " Sq.m.";
    landAreaDocCell.textContent = formatNumber(landAreaSum.toFixed(3)) + " Sq.m.";
    groundCoverageCell.textContent = formatNumber(GroundCoverageSum.toFixed(3)) + " Sq.m.";
    FrontOpenSpaceCell.textContent = formatNumber(FrontOpenSpaceSum) + " M.";
    Side1OpenSpaceCell.textContent = formatNumber(Side1OpenSpaceSum) + " M.";
    Side2OpenSpaceCell.textContent = formatNumber(Side2OpenSpaceSum) + " M.";
    RearOpenSpaceCell.textContent = formatNumber(RearOpenSpaceSum) + " M.";
    
     // Display the calculated ParkingAreaSum
     document.getElementById('pro-park-area').textContent = formatNumber(ParkingAreaSum.toFixed(3)) + " Sq.m.";
    
     // After calculating the sums, move on to calculate FAR
     calculateProposedFAR();
}

const minimumOpenSpaces = {
    residential: [
        { height: "Up to 7.0 M.", front: "1.2 M.", side1: "1.2 M.", side2: "1.2 M.", rear: "2.0 M." },
        { height: "Above 7.0 M. up to 10.0 M.", front: "1.2 M.", side1: "1.2 M.", side2: "1.2 M.", rear: "3.0 M." },
        { height: "Above 10.0 M. up to 12.5 M.", front: "1.2 M.", side1: "1.2 M.", side2: "1.5 M.", rear: "3.0 M." },
        { height: "Above 12.5 M. up to 15.5 M.", front: "2.0 M.", side1: "1.5 M.", side2: "2.5 M.", rear: "4.0 M." },
        { height: "Above 15.5 M. up to 21.5 M.", front: "3.5 M.", side1: "4.0 M.", side2: "4.0 M.", rear: "5.0 M." },
        { height: "Above 21.5 M. up to 25.5 M.", front: "5.0 M.", side1: "5.0 M.", side2: "5.0 M.", rear: "6.5 M." },
        { height: "Above 25.5 M. up to 40.0 M.", front: "6.0 M.", side1: "6.5 M.", side2: "6.5 M.", rear: "8.5 M." },
        { height: "Above 40.0 M. up to 60.0 M.", front: "8.0 M.", side1: "8.0 M.", side2: "8.0 M.", rear: "10.0 M." },
        { height: "Above 60.0 M. up to 80.0 M.", front: "10.0 M.", side1: "15% of height or 11.0 M., whichever is less", side2: "15% of height or 11.0 M., whichever is less", rear: "12.0 M." },
        { height: "Above 80.0 M.", front: "12.0 M.", side1: "15% of height or 14.0 M., whichever is less", side2: "15% of height or 14.0 M., whichever is less", rear: "14.0 M." }
    ],
    educational: [
        { height: "Up to 10.0 M. for land area up to 500.0 sq. M.", front: "2.0 M.", side1: "1.8 M.", side2: "4.0 M.", rear: "3.5 M." },
        { height: "Up to 10.0 M. for land area above 500.0 sq. M.", front: "3.5 M.", side1: "3.5 M.", side2: "4.0 M.", rear: "4.0 M." },
        { height: "Above 10.0 M. up to 15.5 M.", front: "3.5 M.", side1: "4.0 M.", side2: "4.0 M.", rear: "5.0 M." },
        { height: "Above 15.5 M. up to 21.5 M.", front: "5.0 M.", side1: "5.0 M.", side2: "5.0 M.", rear: "6.0 M." },
        { height: "Above 21.5 M.", front: "20% of the height of building or 6 M., whichever is more", side1: "20% of the height of building or 5 M., whichever is more", side2: "20% of the height of building or 5 M., whichever is more", rear: "20% of the height of building or 8 M., whichever is more" }
    ],
    institutional: [
        { height: "Up to 10.0 M. for land area up to 500.0 sq. M.", front: "2.0 M.", side1: "1.2 M.", side2: "4.0 M.", rear: "4.0 M." },
        { height: "Up to 10.0 M. for land area above 500.0 sq. M.", front: "3.0 M.", side1: "3.5 M.", side2: "4.0 M.", rear: "4.0 M." },
        { height: "Above 10.0 M. up to 21.5 M.", front: "4.0 M.", side1: "4.0 M.", side2: "4.0 M.", rear: "5.0 M." },
        { height: "Above 21.5 M. up to 25.5 M.", front: "5.0 M.", side1: "5.0 M.", side2: "5.0 M.", rear: "6.0 M." },
        { height: "Above 25.5 M. up to 40.0 M.", front: "6.0 M.", side1: "6.5 M.", side2: "6.5 M.", rear: "9.0 M." },
        { height: "Above 40.0 M. up to 60.0 M.", front: "8.0 M.", side1: "9.0 M.", side2: "9.0 M.", rear: "10.0 M." },
        { height: "Above 60.0 M. up to 80.0 M.", front: "10.0 M.", side1: "15% of the height of building or 11.0 M., whichever is less", side2: "15% of the height of building or 11.0 M., whichever is less", rear: "12.0 M." },
        { height: "Above 80.0 M.", front: "12.0 M.", side1: "15% of the height of building or 14.0 M., whichever is less", side2: "15% of the height of building or 14.0 M., whichever is less", rear: "14.0 M." }
    ],
    assembly: [
        { height: "Up to 10.0 M. for land area up to 500.0 sq. M.", front: "2.0 M.", side1: "1.2 M.", side2: "4.0 M.", rear: "4.0 M." },
        { height: "Up to 10.0 M. for land area above 500.0 sq. M.", front: "3.0 M.", side1: "3.5 M.", side2: "4.0 M.", rear: "4.0 M." },
        { height: "Above 10.0 M. up to 21.5 M.", front: "4.0 M.", side1: "4.0 M.", side2: "4.0 M.", rear: "5.0 M." },
        { height: "Above 21.5 M. up to 25.5 M.", front: "5.0 M.", side1: "5.0 M.", side2: "5.0 M.", rear: "6.0 M." },
        { height: "Above 25.5 M. up to 40.0 M.", front: "6.0 M.", side1: "6.5 M.", side2: "6.5 M.", rear: "9.0 M." },
        { height: "Above 40.0 M. up to 60.0 M.", front: "8.0 M.", side1: "9.0 M.", side2: "9.0 M.", rear: "10.0 M." },
        { height: "Above 60.0 M. up to 80.0 M.", front: "10.0 M.", side1: "15% of the height of building or 11.0 M., whichever is less", side2: "15% of the height of building or 11.0 M., whichever is less", rear: "12.0 M." },
        { height: "Above 80.0 M.", front: "12.0 M.", side1: "15% of the height of building or 14.0 M., whichever is less", side2: "15% of the height of building or 14.0 M., whichever is less", rear: "14.0 M." }
    ],
    business: [
        { height: "Up to 10.0 M. for land area up to 500.0 sq. M.", front: "2.0 M.", side1: "1.2 M.", side2: "4.0 M.", rear: "4.0 M." },
        { height: "Up to 10.0 M. for land area above 500.0 sq. M.", front: "3.0 M.", side1: "3.5 M.", side2: "4.0 M.", rear: "4.0 M." },
        { height: "Above 10.0 M. up to 21.5 M.", front: "4.0 M.", side1: "4.0 M.", side2: "4.0 M.", rear: "5.0 M." },
        { height: "Above 21.5 M. up to 25.5 M.", front: "5.0 M.", side1: "5.0 M.", side2: "5.0 M.", rear: "6.0 M." },
        { height: "Above 25.5 M. up to 40.0 M.", front: "6.0 M.", side1: "6.5 M.", side2: "6.5 M.", rear: "9.0 M." },
        { height: "Above 40.0 M. up to 60.0 M.", front: "8.0 M.", side1: "9.0 M.", side2: "9.0 M.", rear: "10.0 M." },
        { height: "Above 60.0 M. up to 80.0 M.", front: "10.0 M.", side1: "15% of the height of building or 11.0 M., whichever is less", side2: "15% of the height of building or 11.0 M., whichever is less", rear: "12.0 M." },
        { height: "Above 80.0 M.", front: "12.0 M.", side1: "15% of the height of building or 14.0 M., whichever is less", side2: "15% of the height of building or 14.0 M., whichever is less", rear: "14.0 M." }
    ],
    Mercantile_retail: [
        { height: "Up to 10.0 M. for land area up to 500.0 sq. M.", front: "2.0 M.", side1: "1.2 M.", side2: "4.0 M.", rear: "4.0 M." },
        { height: "Up to 10.0 M. for land area above 500.0 sq. M.", front: "3.0 M.", side1: "3.5 M.", side2: "4.0 M.", rear: "4.0 M." },
        { height: "Above 10.0 M. up to 21.5 M.", front: "4.0 M.", side1: "4.0 M.", side2: "4.0 M.", rear: "5.0 M." },
        { height: "Above 21.5 M. up to 25.5 M.", front: "5.0 M.", side1: "5.0 M.", side2: "5.0 M.", rear: "6.0 M." },
        { height: "Above 25.5 M. up to 40.0 M.", front: "6.0 M.", side1: "6.5 M.", side2: "6.5 M.", rear: "9.0 M." },
        { height: "Above 40.0 M. up to 60.0 M.", front: "8.0 M.", side1: "9.0 M.", side2: "9.0 M.", rear: "10.0 M." },
        { height: "Above 60.0 M. up to 80.0 M.", front: "10.0 M.", side1: "15% of the height of building or 11.0 M., whichever is less", side2: "15% of the height of building or 11.0 M., whichever is less", rear: "12.0 M." },
        { height: "Above 80.0 M.", front: "12.0 M.", side1: "15% of the height of building or 14.0 M., whichever is less", side2: "15% of the height of building or 14.0 M., whichever is less", rear: "14.0 M." }
    ],
    Mercantile_wholesale: [
        { height: "Up to 10.0 M. for land area up to 500.0 sq. M.", front: "2.0 M.", side1: "1.2 M.", side2: "4.0 M.", rear: "4.0 M." },
        { height: "Up to 10.0 M. for land area above 500.0 sq. M.", front: "3.0 M.", side1: "3.5 M.", side2: "4.0 M.", rear: "4.0 M." },
        { height: "Above 10.0 M. up to 21.5 M.", front: "4.0 M.", side1: "4.0 M.", side2: "4.0 M.", rear: "5.0 M." },
        { height: "Above 21.5 M. up to 25.5 M.", front: "5.0 M.", side1: "5.0 M.", side2: "5.0 M.", rear: "6.0 M." },
        { height: "Above 25.5 M. up to 40.0 M.", front: "6.0 M.", side1: "6.5 M.", side2: "6.5 M.", rear: "9.0 M." },
        { height: "Above 40.0 M. up to 60.0 M.", front: "8.0 M.", side1: "9.0 M.", side2: "9.0 M.", rear: "10.0 M." },
        { height: "Above 60.0 M. up to 80.0 M.", front: "10.0 M.", side1: "15% of the height of building or 11.0 M., whichever is less", side2: "15% of the height of building or 11.0 M., whichever is less", rear: "12.0 M." },
        { height: "Above 80.0 M.", front: "12.0 M.", side1: "15% of the height of building or 14.0 M., whichever is less", side2: "15% of the height of building or 14.0 M., whichever is less", rear: "14.0 M." }
    ],
    industrial: [
        { height: "Up to 10.0 M.", front: "12.5 M.", side1: "5.0 M.", side2: "4.0 M.", rear: "4.0 M." },
        { height: "Above 10.0 M. up to 21.5 M.", front: "12.5 M.", side1: "6.0 M.", side2: "6.5 M.", rear: "10.0 M." },
        { height: "Above 21.5 M.", front: "20% of the height of building or 6 M., whichever is more", side1: "20% of the height of building or 6.5 M., whichever is more", side2: "20% of the height of building or 6.5 M., whichever is more", rear: "20% of the height of building or 10.0 M., whichever is more" }
    ],
    Storage: [
        { height: "Up to 10.0 M.", front: "12.5 M.", side1: "5.0 M.", side2: "4.0 M.", rear: "4.0 M." },
        { height: "Above 10.0 M. up to 21.5 M.", front: "12.5 M.", side1: "6.0 M.", side2: "6.5 M.", rear: "10.0 M." },
        { height: "Above 21.5 M.", front: "20% of the height of building or 6 M., whichever is more", side1: "20% of the height of building or 6.5 M., whichever is more", side2: "20% of the height of building or 6.5 M., whichever is more", rear: "20% of the height of building or 10.0 M., whichever is more" }
    ],
    Hazardous: [
        { height: "Up to 10.0 M.", front: "12.5 M.", side1: "5.0 M.", side2: "4.0 M.", rear: "4.0 M." },
        { height: "Above 10.0 M. up to 21.5 M.", front: "12.5 M.", side1: "6.0 M.", side2: "6.5 M.", rear: "10.0 M." },
        { height: "Above 21.5 M.", front: "20% of the height of building or 6 M., whichever is more", side1: "20% of the height of building or 6.5 M., whichever is more", side2: "20% of the height of building or 6.5 M., whichever is more", rear: "20% of the height of building or 10.0 M., whichever is more" }
    ]
};

function extractOpenSpaces() {
    const useGroup = document.getElementById('usegroup').textContent.toLocaleLowerCase();
    const heightElement = document.getElementById('pro-height');
    let buildingHeight = heightElement ? parseFloat(heightElement.textContent.replace(/[^\d.]/g, '')) : NaN;

    const landAreaElement = document.getElementById('land-area');
    let landArea = landAreaElement ? parseFloat(landAreaElement.textContent.replace(/[^\d.]/g, '')) : NaN;

    console.log(`Use Group: ${useGroup}`);
    console.log(`Building Height: ${buildingHeight}`);
    console.log(`Land Area: ${landArea}`);

    const categoryData = minimumOpenSpaces[useGroup];
    if (!categoryData) {
        alert('Invalid use group selected or data not found!');
        return;
    }

    const openSpaceData = categoryData.find(entry => {
        // Extract height range using a regex
        const heightRange = entry.height.match(/(Up to|Above)? ?(\d*\.?\d+) ?M.( up to (\d*\.?\d+) ?M.)?/);

        if (!heightRange) {
            console.error(`Could not parse height from entry: ${entry.height}`);
            return false; // Unable to parse height, skip this entry
        }

        // Determine minHeight and maxHeight based on the entry
        let minHeight = 0;
        let maxHeight = Infinity;

        if (heightRange[1] === "Up to") {
            maxHeight = parseFloat(heightRange[2]);
        } else if (heightRange[1] === "Above") {
            minHeight = parseFloat(heightRange[2]);
        }

        // If there is an "up to" specified, we update maxHeight
        if (heightRange[4]) {
            maxHeight = parseFloat(heightRange[4]);
        }

        console.log(`Parsed height range: [${minHeight}, ${maxHeight}] for entry: ${entry.height}`);

        // Check if the building height falls within this range
        const matches = (buildingHeight > minHeight && buildingHeight <= maxHeight);
        console.log(`Checking if ${buildingHeight} is within range: ${matches}`);
        return matches;
    });

    if (openSpaceData) {
        console.log('Matching Open Space Data:', openSpaceData);
        
        // Calculate side open space based on building height
        let side1Value, side2Value;
        if (buildingHeight > 80) {
            // Side calculation for heights above 80.0 m
            side1Value = side2Value = Math.min(buildingHeight * 0.15, 14.0).toFixed(2) + ' m';
        } else if (buildingHeight > 60) {
            // Side calculation for heights above 60.0 m up to 80.0 m
            side1Value = side2Value = Math.min(buildingHeight * 0.15, 11.0).toFixed(2) + ' m';
        } else {
            side1Value = openSpaceData.side1;
            side2Value = openSpaceData.side2;
        }

        // Check if table cells are found
        const frontCell = document.getElementById('per-front');
        const side1Cell = document.getElementById('per-side1');
        const side2Cell = document.getElementById('per-side2');
        const rearCell = document.getElementById('per-rear');

        if (frontCell && side1Cell && side2Cell && rearCell) {
            console.log('Populating Open Space Table Cells:');
            console.log(`Front: ${openSpaceData.front}`);
            console.log(`Side 1: ${side1Value}`);
            console.log(`Side 2: ${side2Value}`);
            console.log(`Rear: ${openSpaceData.rear}`);

            // Set inner text of table cells with values from openSpaceData and calculated values
            frontCell.innerText = openSpaceData.front;
            side1Cell.innerText = side1Value;
            side2Cell.innerText = side2Value;
            rearCell.innerText = openSpaceData.rear;
        } else {
            console.error('One or more table cells are not found in the DOM.');
        }
    } else {
        alert('No matching data found for the selected height and land area!');
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

function formatNumber(value) {
    const number = parseFloat(value);
    return isNaN(number) ? value : number.toLocaleString('en-US', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3
    });
}



