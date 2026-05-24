// IMPLEMENTATION EXAMPLE: Adding Demographics to index.html
// ============================================================

// STEP 1: Replace this old STATE_DEMOGRAPHICS object in your index.html:
// ========================================================================

const STATE_DEMOGRAPHICS = {
  "Alabama":             {race:{white:64.0, black:25.6, hispanic: 5.3, asian: 1.5, native: 0.5, other: 3.1}, income: 60660, poverty: 16.0, density: 94.65, foreignBorn: 3.7, medianAge: 38.2, bachelorsPlus: 28.9, unemployment: 3.8, uninsured: 9.2, medianIncome: 58432, disability: 15.2, citizenship: 98.1},
  "Alaska":              {race:{white:57.5, black: 3.0, hispanic: 7.6, asian: 6.5, native:14.9, other:10.5}, income: 89740, poverty: 10.7, density: 1.19, foreignBorn: 7.2, medianAge: 37.9, bachelorsPlus: 32.7, unemployment: 4.2, uninsured: 14.5, medianIncome: 84648, disability: 10.8, citizenship: 98.5},
  "Arizona":             {race:{white:52.3, black: 4.6, hispanic:32.5, asian: 3.7, native: 4.1, other: 2.8}, income: 76872, poverty: 12.4, density: 57.05, foreignBorn: 13.9, medianAge: 38.3, bachelorsPlus: 32.4, unemployment: 3.5, uninsured: 10.1, medianIncome: 71044, disability: 12.1, citizenship: 96.8},
  // ... etc for all states
};

// ============================================================================
// STEP 2: If you DON'T have these fields in your current STATE_DEMOGRAPHICS,
// add them using this data. Use the values from state_demographics_enhanced.js
// ============================================================================

// Example for just 3 states to show the structure:
const STATE_DEMOGRAPHICS_UPDATES = {
  "Alabama": {
    density: 94.65,
    foreignBorn: 3.7,
    citizenship: 98.1,
  },
  "Alaska": {
    density: 1.19,
    foreignBorn: 7.2,
    citizenship: 98.5,
  },
  "Arizona": {
    density: 57.05,
    foreignBorn: 13.9,
    citizenship: 96.8,
  },
  // ... get all 50 states from state_demographics_enhanced.js
};

// Apply updates to existing demographics:
Object.keys(STATE_DEMOGRAPHICS_UPDATES).forEach(state => {
  if (STATE_DEMOGRAPHICS[state]) {
    STATE_DEMOGRAPHICS[state] = {
      ...STATE_DEMOGRAPHICS[state],
      ...STATE_DEMOGRAPHICS_UPDATES[state]
    };
  }
});

// ============================================================================
// STEP 3: Update your UI display functions to show these fields
// ============================================================================

// Example function that displays state demographics on the page:
function displayStateDemographics(stateName) {
  const demo = STATE_DEMOGRAPHICS[stateName];
  
  if (!demo) return;
  
  const demographicHTML = `
    <div class="state-demographics">
      <h3>${stateName}</h3>
      
      <div class="demo-row">
        <label>Population Density:</label>
        <span>${demo.density?.toFixed(2)} people per sq. mile</span>
      </div>
      
      <div class="demo-row">
        <label>Foreign Born Population:</label>
        <span>${demo.foreignBorn?.toFixed(1)}%</span>
      </div>
      
      <div class="demo-row">
        <label>U.S. Citizenship Rate:</label>
        <span>${demo.citizenship?.toFixed(1)}%</span>
      </div>
      
      <!-- Your other demographics -->
      <div class="demo-row">
        <label>Median Income:</label>
        <span>$${(demo.medianIncome || demo.income)?.toLocaleString()}</span>
      </div>
      
      <div class="demo-row">
        <label>Poverty Rate:</label>
        <span>${demo.poverty?.toFixed(1)}%</span>
      </div>
    </div>
  `;
  
  document.getElementById('demographics-container').innerHTML = demographicHTML;
}

// ============================================================================
// STEP 4: Add CSS styling for the new demographic displays
// ============================================================================

const demographicsCSS = `
.state-demographics {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.state-demographics h3 {
  margin-top: 0;
  color: #333;
  border-bottom: 2px solid #007bff;
  padding-bottom: 10px;
}

.demo-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #ddd;
}

.demo-row:last-child {
  border-bottom: none;
}

.demo-row label {
  font-weight: bold;
  color: #555;
  flex: 1;
}

.demo-row span {
  color: #007bff;
  font-weight: 500;
  text-align: right;
}
`;

// ============================================================================
// STEP 5: Use in comparison/search features
// ============================================================================

function compareStates(state1, state2) {
  const demo1 = STATE_DEMOGRAPHICS[state1];
  const demo2 = STATE_DEMOGRAPHICS[state2];
  
  return {
    densityComparison: {
      [state1]: demo1.density,
      [state2]: demo2.density,
      difference: (demo1.density - demo2.density).toFixed(2),
      denser: demo1.density > demo2.density ? state1 : state2,
    },
    foreignBornComparison: {
      [state1]: demo1.foreignBorn,
      [state2]: demo2.foreignBorn,
      difference: (demo1.foreignBorn - demo2.foreignBorn).toFixed(1),
      higher: demo1.foreignBorn > demo2.foreignBorn ? state1 : state2,
    },
    citizenshipComparison: {
      [state1]: demo1.citizenship,
      [state2]: demo2.citizenship,
      difference: (demo1.citizenship - demo2.citizenship).toFixed(1),
      higher: demo1.citizenship > demo2.citizenship ? state1 : state2,
    },
  };
}

// Example usage:
// const comparison = compareStates("California", "Wyoming");
// console.log(comparison);
// Output:
// {
//   densityComparison: {
//     California: 251.3,
//     Wyoming: 5.84,
//     difference: "245.46",
//     denser: "California"
//   },
//   ...
// }

// ============================================================================
// STEP 6: Filter/sort functionality
// ============================================================================

// Get states sorted by population density
function getStatesSortedByDensity(ascending = false) {
  return Object.entries(STATE_DEMOGRAPHICS)
    .map(([name, data]) => ({
      state: name,
      density: data.density,
      foreignBorn: data.foreignBorn,
      citizenship: data.citizenship,
    }))
    .sort((a, b) => ascending ? a.density - b.density : b.density - a.density);
}

// Get states with highest foreign-born population
function getStatesByForeignBorn(limit = 10) {
  return Object.entries(STATE_DEMOGRAPHICS)
    .map(([name, data]) => ({
      state: name,
      foreignBorn: data.foreignBorn,
      citizenship: data.citizenship,
      density: data.density,
    }))
    .sort((a, b) => b.foreignBorn - a.foreignBorn)
    .slice(0, limit);
}

// Example usage:
// console.log(getStatesSortedByDensity(false)); // highest density first
// console.log(getStatesByForeignBorn(5));       // top 5 by foreign-born %

// ============================================================================
// REFERENCE: Complete Example for One State
// ============================================================================

// Here's what the complete demographic entry looks like for Alabama:

const ALABAMA_EXAMPLE = {
  // Original fields you likely have:
  race: {
    white: 64.0,
    black: 25.6,
    hispanic: 5.3,
    asian: 1.5,
    native: 0.5,
    other: 3.1
  },
  income: 60660,
  poverty: 16.0,
  medianAge: 38.2,
  bachelorsPlus: 28.9,
  unemployment: 3.8,
  uninsured: 9.2,
  medianIncome: 58432,
  disability: 15.2,
  
  // New fields - USE THESE VALUES from state_demographics_enhanced.js:
  density: 94.65,        // persons per square mile
  foreignBorn: 3.7,      // percentage of population
  citizenship: 98.1,     // percentage of population
};

// ============================================================================
// DATA VALIDATION FUNCTION
// ============================================================================

function validateDemographicsData() {
  let issues = [];
  
  Object.entries(STATE_DEMOGRAPHICS).forEach(([state, data]) => {
    // Check density
    if (!data.density || data.density <= 0) {
      issues.push(`${state}: Missing or invalid density`);
    }
    
    // Check foreign born (should be 0-50%)
    if (data.foreignBorn === undefined || data.foreignBorn < 0 || data.foreignBorn > 50) {
      issues.push(`${state}: Invalid foreignBorn value: ${data.foreignBorn}`);
    }
    
    // Check citizenship (should be 90-100%)
    if (data.citizenship === undefined || data.citizenship < 90 || data.citizenship > 100) {
      issues.push(`${state}: Invalid citizenship value: ${data.citizenship}`);
    }
  });
  
  if (issues.length === 0) {
    console.log('✓ All demographic data validated successfully');
  } else {
    console.error('⚠ Data validation issues found:');
    issues.forEach(issue => console.error(`  - ${issue}`));
  }
  
  return issues.length === 0;
}

// Run before deploying:
// validateDemographicsData();

// ============================================================================
// TESTING: Check your data is loaded
// ============================================================================

console.log('=== Demographics Data Check ===');
console.log('Total states:', Object.keys(STATE_DEMOGRAPHICS).length);
console.log('Sample states with new data:');
['Alabama', 'California', 'Wyoming'].forEach(state => {
  const d = STATE_DEMOGRAPHICS[state];
  console.log(`\n${state}:`);
  console.log(`  Density: ${d.density} persons/sq mi`);
  console.log(`  Foreign Born: ${d.foreignBorn}%`);
  console.log(`  Citizenship: ${d.citizenship}%`);
});
