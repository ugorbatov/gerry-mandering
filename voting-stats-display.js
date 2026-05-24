// Voting Stats Display Module
// Inserts voting statistics below demographics in the sidebar

class VotingStatsDisplay {
  constructor() {
    this.template = `
      <div id="votingStats" class="voting-stats">
        <div class="voting-header">🗳️ Voting Results</div>
        
        <div class="voting-section">
          <div class="voting-section-title">2024 Presidential Election</div>
          <div class="voting-bars-container">
            <div class="voting-bar-item">
              <div class="voting-bar-label">Democratic</div>
              <div class="voting-bar-wrapper">
                <div class="voting-bar-segment voting-bar-dem" style="flex: {dem}; min-width: 30px;">
                  {dem}%
                </div>
              </div>
            </div>
            <div class="voting-bar-item">
              <div class="voting-bar-label">Republican</div>
              <div class="voting-bar-wrapper">
                <div class="voting-bar-segment voting-bar-rep" style="flex: {rep}; min-width: 30px;">
                  {rep}%
                </div>
              </div>
            </div>
            <div class="voting-bar-item">
              <div class="voting-bar-label">Other</div>
              <div class="voting-bar-wrapper">
                <div class="voting-bar-segment voting-bar-other" style="flex: {other}; min-width: 20px;">
                  {other}%
                </div>
              </div>
            </div>
          </div>
          <div class="voting-margin">
            Margin: <strong>{presMargin}%</strong> {presWinner}
          </div>
        </div>

        <div class="voting-section">
          <div class="voting-section-title">2024 House Election</div>
          <div class="voting-bars-container">
            <div class="voting-bar-item">
              <div class="voting-bar-label">Democratic</div>
              <div class="voting-bar-wrapper">
                <div class="voting-bar-segment voting-bar-dem" style="flex: {houseDem}; min-width: 30px;">
                  {houseDem}%
                </div>
              </div>
            </div>
            <div class="voting-bar-item">
              <div class="voting-bar-label">Republican</div>
              <div class="voting-bar-wrapper">
                <div class="voting-bar-segment voting-bar-rep" style="flex: {houseRep}; min-width: 30px;">
                  {houseRep}%
                </div>
              </div>
            </div>
            <div class="voting-bar-item">
              <div class="voting-bar-label">Other</div>
              <div class="voting-bar-wrapper">
                <div class="voting-bar-segment voting-bar-other" style="flex: {houseOther}; min-width: 20px;">
                  {houseOther}%
                </div>
              </div>
            </div>
          </div>
          <div class="voting-margin">
            Margin: <strong>{houseMargin}%</strong> {houseWinner}
          </div>
        </div>
      </div>
    `;
  }

  render(state, district) {
    // Get voting data
    const voting = getVotingStats(state, district);
    if (!voting) return null;

    // Calculate margins and winners
    const presMargin = Math.abs(voting.presidential.dem - voting.presidential.rep);
    const presWinner = voting.presidential.dem > voting.presidential.rep ? 'Democratic Win' : 'Republican Win';
    
    const houseMargin = Math.abs(voting.house.dem - voting.house.rep);
    const houseWinner = voting.house.dem > voting.house.rep ? 'Democratic Win' : 'Republican Win';

    // Fill template
    let html = this.template
      .replace(/{dem}/g, voting.presidential.dem)
      .replace(/{rep}/g, voting.presidential.rep)
      .replace(/{other}/g, voting.presidential.other)
      .replace(/{presMargin}/g, presMargin)
      .replace(/{presWinner}/g, presWinner)
      .replace(/{houseDem}/g, voting.house.dem)
      .replace(/{houseRep}/g, voting.house.rep)
      .replace(/{houseOther}/g, voting.house.other)
      .replace(/{houseMargin}/g, houseMargin)
      .replace(/{houseWinner}/g, houseWinner);

    return html;
  }

  insert(state, district) {
    const html = this.render(state, district);
    if (!html) return false;

    // Wait for demographics to exist, then insert after it
    const waitForDemographics = () => {
      const demographicsSection = document.querySelector('[id*="demographic"]') || 
                                 document.querySelector('.demographic') ||
                                 document.querySelector('[class*="demograph"]');
      
      if (demographicsSection) {
        // Remove existing voting stats if present
        const existing = document.getElementById('votingStats');
        if (existing) existing.remove();

        // Insert after demographics
        demographicsSection.insertAdjacentHTML('afterend', html);
        return true;
      }
      return false;
    };

    // Try to insert immediately, or wait up to 2 seconds
    if (!waitForDemographics()) {
      let attempts = 0;
      const interval = setInterval(() => {
        if (waitForDemographics() || attempts > 20) {
          clearInterval(interval);
        }
        attempts++;
      }, 100);
    }
  }
}

// Initialize and expose
const votingStatsDisplay = new VotingStatsDisplay();
window.votingStatsDisplay = votingStatsDisplay;
