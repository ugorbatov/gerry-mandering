# Integration Guide: Adding Demographics to Your Website

## Overview
This package contains three demographic fields that were missing from your state data:
- **Population Density** (per square mile)
- **Foreign Born Population** (percentage)
- **U.S. Citizenship** (percentage)

## Files Included

### 1. `United_States_State_Enhanced.csv`
Your original CSV with three new columns added:
- `Density_Per_SqMile` - Population density per square mile
- `Foreign_Born_Percent` - Percentage of foreign-born population
- `Citizenship_Percent` - Percentage of U.S. citizens

**Use this when:** You want to import all your data with demographics into a database or processing system.

### 2. `state_demographics_clean.csv`
A clean, readable reference CSV with key demographics:
- State name
- Median Income
- Population Density
- Foreign Born %
- U.S. Citizenship %
- Housing Units
- Median Rent
- Crime Rate
- Hate Crimes

**Use this when:** You need a quick reference or want to manually verify the data.

### 3. `state_demographics_enhanced.js`
JavaScript object ready to paste into your code:
```javascript
const STATE_DEMOGRAPHICS_ENHANCED = {
  "Alabama": {medianIncome: 63999, density: 94.65, foreignBorn: 3.7, citizenship: 98.1},
  "Alaska": {medianIncome: 92788, density: 1.19, foreignBorn: 7.2, citizenship: 98.5},
  // ... all 50 states
}
```

**Use this when:** Updating your `index.html` or JavaScript modules.

---

## How to Integrate Into Your Website

### Option 1: Replace STATE_DEMOGRAPHICS in index.html (Recommended)

1. **Open your `index.html`**
2. **Find the existing `STATE_DEMOGRAPHICS` object** (should be around line with demographic data)
3. **Open `state_demographics_enhanced.js`** and copy the `STATE_DEMOGRAPHICS_ENHANCED` object
4. **Replace the old object** with the new one, or rename it:

```javascript
// OLD:
const STATE_DEMOGRAPHICS = {
  "Alabama": {race:{white:64.0, ...}, income: 60660, poverty: 16.0, density: 94.65, ...},
  // ...
}

// NEW - Keep your existing fields and add the new ones:
const STATE_DEMOGRAPHICS = {
  "Alabama": {
    race:{white:64.0, black:25.6, hispanic: 5.3, ...},
    income: 60660,
    poverty: 16.0,
    density: 94.65,        // ← Now has real Census data
    foreignBorn: 3.7,      // ← Now has real Census data
    citizenship: 98.1,     // ← Now has real Census data
    // ... keep your other fields
  },
  // ...
}
```

### Option 2: Merge with Existing Data

If you want to keep all your existing demographic fields and just update these three:

```javascript
// In your merge/update script:
const updates = {
  "Alabama": {density: 94.65, foreignBorn: 3.7, citizenship: 98.1},
  "Alaska": {density: 1.19, foreignBorn: 7.2, citizenship: 98.5},
  // ... etc
}

Object.keys(updates).forEach(state => {
  STATE_DEMOGRAPHICS[state] = {
    ...STATE_DEMOGRAPHICS[state],
    ...updates[state]
  };
});
```

### Option 3: Use the CSV in Your Backend

If you're using a backend server:

1. **Import `United_States_State_Enhanced.csv`** into your database
2. **Query the new columns** when rendering state data
3. **Serve the data through your API** to the frontend

---

## Data Sources & Notes

All demographic data comes from:
- **U.S. Census Bureau** - American Community Survey 5-Year Estimates (2023-2024)
- **Population Density** - Census data (persons per square mile)
- **Foreign Born %** - ACS estimates (percentage of population)
- **Citizenship %** - ACS estimates (percentage of population)

### Data Coverage
- **50 U.S. States** - Complete data in all three files
- **District of Columbia** - Included in enhanced CSV, excluded from JavaScript (separate handling)
- **Puerto Rico** - Included in enhanced CSV, excluded from JavaScript (U.S. territory)

### Accuracy
- Data reflects 2023-2024 estimates
- Citizenship percentage = % of population that are U.S. citizens
- Foreign born percentage = % of population born outside U.S.
- Density = persons per square mile

---

## Verification Checklist

After integrating, verify:

- [ ] All 50 states have non-zero density values
- [ ] Foreign born percentages are between 0-100
- [ ] Citizenship percentages are between 90-100 (most U.S. residents)
- [ ] High density states match expectations:
  - New Jersey (1195.5) - highest
  - DC (11294.5) - highest overall
  - Wyoming (5.84) - among lowest
  - Montana (7.0) - among lowest
- [ ] High foreign-born percentages match expectations:
  - California (27.0%)
  - New York (23.5%)
  - New Jersey (21.7%)
  - Florida (20.3%)

---

## Troubleshooting

### "Missing data for state X"
Check that the state name exactly matches the CSV. State names are case-sensitive:
- ✓ "New York" 
- ✗ "new york"
- ✗ "NY"

### "Citizenship > 100%"
This won't happen with the provided data, but if implementing custom data:
- Citizenship % should never exceed 100
- Typically ranges from 90-99%

### "Density = 0"
This indicates the state wasn't found in the data source. Verify the spelling in your code matches the CSV exactly.

---

## FAQ

**Q: Can I use this data commercially?**
A: Yes. Census Bureau data is in the public domain.

**Q: How often should I update this?**
A: Census releases new ACS estimates annually. Update when new data is available (typically fall/winter).

**Q: Why are these specific demographics missing?**
A: Your original CSV focused on economic data (income, housing, rent) and crime statistics. Demographics like density, foreign-born %, and citizenship come from different Census tables.

**Q: Can I request additional demographic data?**
A: Yes. Census Bureau offers many metrics:
- Education levels
- Age distribution  
- Race/ethnicity breakdown (more detailed)
- Disability status
- Language spoken at home
- And many more

---

## Next Steps

1. **Choose your integration option** (1, 2, or 3 above)
2. **Test with one state** to verify data is displaying correctly
3. **Deploy to production**
4. **Monitor for data accuracy** in your application

For questions about Census data definitions, visit:
https://data.census.gov/

---

**Generated:** May 24, 2026  
**Data Source:** U.S. Census Bureau ACS 5-Year Estimates (2023-2024)  
**Files Created:** 3 (Enhanced CSV, Clean CSV, JavaScript)
