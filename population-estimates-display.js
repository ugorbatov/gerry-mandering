/**
 * Population Estimates & Shifts Display Module
 * Fetches Census Bureau population data and displays it in a formatted panel
 * Follows the same pattern as votingStatsDisplay.js
 */

class PopulationEstimatesDisplay {
  constructor() {
    this.apiEndpoint = '/api/census-data';
    this.cache = new Map(); // Local browser cache
    this.cacheExpiry = 1000 * 60 * 60 * 24; // 24 hours
  }

  /**
   * Fetch population data from Netlify function
   */
  async fetchPopulationData(state) {
    // Check browser cache first
    const cached = this.cache.get(state);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      const response = await fetch(`${this.apiEndpoint}?state=${state}&shifts=true`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();
      
      // Store in browser cache
      this.cache.set(state, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error(`Failed to fetch population data for ${state}:`, error);
      return null;
    }
  }

  /**
   * Format population number with thousands separator
   */
  formatNumber(num) {
    if (typeof num !== 'number') return '—';
    return num.toLocaleString('en-US');
  }

  /**
   * Format percentage with sign and decimal
   */
  formatPercent(pct) {
    if (typeof pct !== 'number') return '—';
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
  }

  /**
   * Build HTML for population trends chart (mini bar chart)
   */
  buildTrendChart(data) {
    if (!data || data.length === 0) return '';

    // Find min/max for scaling
    const populations = data.map(d => d.population);
    const minPop = Math.min(...populations);
    const maxPop = Math.max(...populations);
    const range = maxPop - minPop || 1;

    // Build bars
    const bars = data.map(d => {
      const normalized = (d.population - minPop) / range;
      const height = Math.max(normalized * 60, 4); // Min 4px height
      const hasChange = d.changePercent !== undefined;
      const changeClass = hasChange && d.changePercent > 0 ? 'positive' : 'negative';
      
      return `
        <div class="pop-trend-bar" title="${d.year}: ${this.formatNumber(d.population)}">
          <div class="pop-trend-bar-fill ${changeClass}" style="height: ${height}px;"></div>
          <div class="pop-trend-year">${d.year}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="pop-trend-chart">
        <div class="pop-trend-label">Annual Population Trend</div>
        <div class="pop-trend-bars">
          ${bars}
        </div>
      </div>
    `;
  }

  /**
   * Render population estimates HTML
   */
  render(state, populationData) {
    if (!populationData || !populationData.data || populationData.data.length === 0) {
      return `
        <div class="population-estimates">
          <div class="pop-header">📊 Population Estimates</div>
          <div class="pop-section">
            <p style="color: var(--text-mute); font-size: 12px;">
              Unable to load population data for ${state}
            </p>
          </div>
        </div>
      `;
    }

    const data = populationData.data;
    const shifts = populationData.shifts;
    const trendChart = this.buildTrendChart(data);

    // Current year data (last in array)
    const currentData = data[data.length - 1];
    const previousData = data.length > 1 ? data[data.length - 2] : null;

    let shiftsHtml = '';
    if (shifts) {
      const trendArrow = shifts.totalChange > 0 ? '📈' : '📉';
      shiftsHtml = `
        <div class="pop-section">
          <div class="pop-section-title">${trendArrow} Population Shifts (${shifts.startYear}–${shifts.endYear})</div>
          <div class="pop-metric-row">
            <div class="pop-metric">
              <div class="pop-metric-label">Total Change</div>
              <div class="pop-metric-value">${this.formatNumber(shifts.totalChange)}</div>
              <div class="pop-metric-pct">${this.formatPercent(shifts.changePercent)}</div>
            </div>
            <div class="pop-metric">
              <div class="pop-metric-label">Avg Annual Growth</div>
              <div class="pop-metric-value">${shifts.avgAnnualGrowth > 0 ? '+' : ''}${shifts.avgAnnualGrowth.toFixed(3)}%</div>
            </div>
          </div>
        </div>
      `;
    }

    const yoyChange = previousData ? {
      change: currentData.population - previousData.population,
      pct: ((currentData.population - previousData.population) / previousData.population) * 100
    } : null;

    const yoyHtml = yoyChange ? `
      <div class="pop-yoy">
        <span class="pop-yoy-label">Year-over-Year (${previousData.year}–${currentData.year}):</span>
        <span class="pop-yoy-value">${this.formatNumber(yoyChange.change)} (${this.formatPercent(yoyChange.pct)})</span>
      </div>
    ` : '';

    return `
      <div class="population-estimates">
        <div class="pop-header">📊 Population Estimates (Census Bureau PEP)</div>

        <div class="pop-section">
          <div class="pop-section-title">Current Population (${currentData.year})</div>
          <div class="pop-current">
            <div class="pop-current-number">${this.formatNumber(currentData.population)}</div>
            ${yoyHtml}
          </div>
        </div>

        ${shiftsHtml}

        <div class="pop-section">
          ${trendChart}
        </div>

        <div class="pop-footer">
          <div class="pop-footer-text">Data from U.S. Census Bureau Population Estimates Program (PEP)</div>
        </div>
      </div>
    `;
  }

  /**
   * Insert into page (finds where to place it)
   */
  async insert(state) {
    // Fetch data
    const populationData = await this.fetchPopulationData(state);
    const html = this.render(state, populationData);

    // Wait for voting stats to exist, then insert after it
    const waitForInsert = () => {
      // Look for voting stats section or demographics
      const votingStats = document.getElementById('votingStats');
      const demographicsSection = document.querySelector('[id*="demographic"]') ||
                                 document.querySelector('.demographic') ||
                                 document.querySelector('[class*="demograph"]');

      const insertTarget = votingStats || demographicsSection;
      if (insertTarget) {
        // Remove existing population estimates if present
        const existing = document.querySelector('.population-estimates');
        if (existing) existing.remove();

        // Insert after target
        insertTarget.insertAdjacentHTML('afterend', html);
        return true;
      }
      return false;
    };

    // Try to insert immediately, or wait up to 2 seconds
    if (!waitForInsert()) {
      let attempts = 0;
      const interval = setInterval(() => {
        if (waitForInsert() || attempts > 20) {
          clearInterval(interval);
        }
        attempts++;
      }, 100);
    }
  }
}

// Initialize and expose globally
const populationEstimatesDisplay = new PopulationEstimatesDisplay();
window.populationEstimatesDisplay = populationEstimatesDisplay;
