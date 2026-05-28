/**
 * Population Estimates & Shifts Display Module
 * Fetches Census Bureau population data and displays it in a formatted panel
 */

class PopulationEstimatesDisplay {
  constructor() {
    this.apiEndpoint = '/api/census-data';
    this.cache = new Map();
    this.cacheExpiry = 1000 * 60 * 60 * 24; // 24 hours
  }

  /**
   * Fetch population data from Netlify function
   */
  async fetchPopulationData(state) {
    const cached = this.cache.get(state);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      const response = await fetch(`${this.apiEndpoint}?state=${state}`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();
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
    const currentData = data[data.length - 1];

    return `
      <div class="population-estimates">
        <div class="pop-header">📊 Population Estimates (Census Bureau PEP)</div>

        <div class="pop-section">
          <div class="pop-section-title">Current Population (${currentData.year})</div>
          <div class="pop-current">
            <div class="pop-current-number">${this.formatNumber(currentData.population)}</div>
          </div>
        </div>

        <div class="pop-footer">
          <div class="pop-footer-text">Data from U.S. Census Bureau Population Estimates Program (PEP)</div>
        </div>
      </div>
    `;
  }

  /**
   * Insert into page - append to detail-panel
   */
  async insert(state) {
    // Fetch data
    const populationData = await this.fetchPopulationData(state);
    const html = this.render(state, populationData);

    // Wait for detail-panel to exist
    const waitForInsert = () => {
      const detailPanel = document.getElementById('detail-panel');
      if (detailPanel) {
        // Remove existing population estimates if present
        const existing = document.querySelector('.population-estimates');
        if (existing) existing.remove();

        // Append to detail panel
        detailPanel.insertAdjacentHTML('beforeend', html);
        console.log(`[population-estimates] Inserted for ${state}`);
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
