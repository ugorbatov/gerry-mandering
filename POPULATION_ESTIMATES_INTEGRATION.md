# Population Estimates Integration Guide

## Files to Add

### 1. Netlify Function
**Location:** `netlify/functions/census-data.mts`
- Downloads the provided `census-data.mts` file
- This calls Census Bureau API using your `CENSUS_DATA_API` key

### 2. Frontend Display Module
**Location:** `population-estimates-display.js`
- Class that manages fetching and rendering population data
- Follows same pattern as `votingStatsDisplay.js`

### 3. CSS Styles
**Location:** Add to your `<style>` block in `index.html` or create `population-estimates.css`
- Styling for the population panel
- Matches your site's design system (colors, spacing, typography)

---

## Integration Steps

### Step 1: Add Netlify Function
1. Download `census-data.mts`
2. Save to: `netlify/functions/census-data.mts`
3. Commit to GitHub
4. Netlify auto-deploys (watch Deploy settings)

### Step 2: Add JavaScript & CSS to index.html

In your `<head>` section, add the CSS:
```html
<!-- Population Estimates Styles -->
<style>
  /* ============================================================
     POPULATION ESTIMATES DISPLAY - CSS Styles
     ... (copy all CSS from population-estimates.css here)
  ============================================================ */
</style>
```

Before closing `</body>`, add the script:
```html
<!-- Population Estimates Display Module -->
<script src="population-estimates-display.js"></script>
```

### Step 3: Hook Into Your Existing Code

Find where you call `votingStatsDisplay.insert()` in your code.
This is likely in the rep-popup.js or similar file where you handle district selection.

Add this line **right after** the voting stats line:
```javascript
// After voting stats are inserted
if (populationEstimatesDisplay) {
  populationEstimatesDisplay.insert(state);
}
```

**Example:** In `rep-popup.js`, find where you have:
```javascript
votingStatsDisplay.insert(state, district);
```

Add below it:
```javascript
populationEstimatesDisplay.insert(state);
```

### Step 4: Test

1. Deploy to Netlify
2. Click a state on the map
3. Scroll down in the popup—you should see:
   - 📊 Population Estimates header
   - Current year population (large green number)
   - Year-over-year change
   - Population shifts (2020-2023 summary)
   - Trend chart showing annual population

---

## How It Works

### API Endpoint
**URL:** `https://your-netlify-domain/api/census-data?state=NJ&shifts=true`

**Response:**
```json
{
  "state": "NJ",
  "data": [
    {"year": 2020, "state": "NJ", "population": 8882190},
    {"year": 2021, "state": "NJ", "population": 8843618, "change": -38572, "changePercent": -0.43},
    {"year": 2022, "state": "NJ", "population": 8837490, "change": -6128, "changePercent": -0.07},
    {"year": 2023, "state": "NJ", "population": 8835732, "change": -1758, "changePercent": -0.02}
  ],
  "shifts": {
    "startYear": 2020,
    "endYear": 2023,
    "startPop": 8882190,
    "endPop": 8835732,
    "totalChange": -46458,
    "changePercent": -0.52,
    "avgAnnualGrowth": -0.17
  },
  "cached": false,
  "timestamp": "2026-05-28T16:45:32.123Z"
}
```

### Caching Strategy

**Netlify Function:** 24-hour in-memory cache per function instance
- First request for a state fetches from Census Bureau
- Subsequent requests return cached result
- Cache resets after 24 hours or function restart

**Browser:** 24-hour localStorage cache per state
- Reduces redundant API calls
- Survives page reload
- Configured in `populationEstimatesDisplay.cacheExpiry`

---

## CSS Variables Used (matches your site)

Your site already defines these in `:root`:
- `--bg`: Dark background
- `--surface`: Panel background
- `--surface-2`: Secondary surface (lighter)
- `--border`: Standard border color
- `--border-hi`: Highlighted border
- `--text`: Main text
- `--text-dim`: Dimmed text
- `--text-mute`: Muted text
- `--green`: Growth indicator
- `--amber`: Decline indicator

The CSS uses these existing variables, so it will match your color scheme automatically.

---

## Troubleshooting

### Data Not Loading?
1. Check browser console (F12 → Console)
2. Verify `CENSUS_DATA_API` environment variable is set on Netlify
3. Test endpoint directly: `https://your-domain/api/census-data?state=NJ`

### Styling Looks Wrong?
1. Verify CSS is in `<style>` block or loaded before closing `</body>`
2. Check that your site's CSS variables are defined in `:root`
3. Open DevTools → inspect `.population-estimates` element
4. Look for CSS override issues

### Module Not Defined?
1. Verify `population-estimates-display.js` is loaded before it's used
2. Script tag should come before any code that calls `populationEstimatesDisplay.insert()`
3. Check browser console for 404 errors on script load

---

## Optional Customizations

### Change the Header Icon
In `population-estimates-display.js`, find:
```javascript
<div class="pop-header">📊 Population Estimates (Census Bureau PEP)</div>
```

Change `📊` to any emoji:
- 📈 for growth focus
- 🗳️ for voting context
- 🌍 for geographic

### Adjust Time Range
In `census-data.mts`, find:
```typescript
url.searchParams.set("time", "from 2020 to 2023");
```

Change to:
```typescript
url.searchParams.set("time", "from 2010 to 2023"); // Longer history
```

### Disable Year-Over-Year Change
In `population-estimates-display.js`, comment out the `yoyHtml` variable:
```javascript
const yoyHtml = ''; // Disable YoY display
```

---

## Data Sources

- **Census Bureau Population Estimates Program (PEP):** 2020-2023 annual estimates
- **API:** https://api.census.gov/data/2023/pep/population
- **Documentation:** https://www.census.gov/programs-surveys/popest.html

---

## Questions?

If the module isn't appearing:
1. Check console for JavaScript errors
2. Verify state code is being passed correctly (2-letter abbreviation)
3. Confirm Netlify function deployment succeeded
4. Test API directly in browser address bar

Good luck! 🎉
