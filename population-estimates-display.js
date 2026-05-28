class PopulationEstimatesDisplay {
  constructor() {
    this.apiEndpoint = '/api/census-data';
    this.cache = new Map();
    this.cacheExpiry = 1000 * 60 * 60 * 24;
  }

  async fetchPopulationData(state) {
    const cached = this.cache.get(state);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      const response = await fetch(`${this.apiEndpoint}?state=${state}`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      this.cache.set(state, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error(`Failed to fetch population data for ${state}:`, error);
      return null;
    }
  }

  formatNumber(num) {
    if (typeof num !== 'number') return '—';
    return num.toLocaleString('en-US');
  }

  render(state, populationData) {
    if (!populationData || !populationData.data || !populationData.data.population) {
      return '';
    }

    const population = populationData.data.population;

    return `
      <div class="population-estimates">
        <div class="pop-header">📊 POPULATION (2023 CENSUS BUREAU)</div>
        <div class="pop-section" style="margin-bottom: 0; padding-bottom: 0; border-bottom: none;">
          <div class="pop-current-number" style="font-size: 28px; color: var(--green); font-weight: 700;">${this.formatNumber(population)}</div>
          <div class="pop-footer-text" style="margin-top: 6px;">U.S. Census Bureau Population Estimates Program (PEP) 2023</div>
        </div>
      </div>
    `;
  }

  async insert(state) {
    const populationData = await this.fetchPopulationData(state);
    const html = this.render(state, populationData);

    if (!html) return;

    const waitForInsert = () => {
      const detailPanel = document.getElementById('detail-panel');
      if (detailPanel) {
        const existing = document.querySelector('.population-estimates');
        if (existing) existing.remove();

        detailPanel.insertAdjacentHTML('beforeend', html);
        console.log(`[population-estimates] Inserted for ${state}`);
        return true;
      }
      return false;
    };

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

const populationEstimatesDisplay = new PopulationEstimatesDisplay();
window.populationEstimatesDisplay = populationEstimatesDisplay;
