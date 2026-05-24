// Rep Integration - Handles district clicks and shows profile popup
// This manages the interaction between district clicks and the rep profile

class RepProfileManager {
  constructor() {
    this.currentDistrict = null;
    this.currentState = null;
    this.tooltip = null;
  }

  onDistrictClick(districtNum) {
    // Get current state from the URL or active state
    const activeState = document.querySelector('[data-state]')?.getAttribute('data-state') || 
                       window.activeState;
    
    if (!activeState) return;

    this.currentState = activeState;
    this.currentDistrict = districtNum;

    // Show a message - in real usage, this would trigger the full profile panel
    console.log(`District clicked: ${activeState}-${districtNum}`);
    
    // You can trigger other actions here like:
    // - Opening a sidebar with rep details
    // - Fetching additional data from APIs
    // - Showing detailed profile information
  }

  // Optional: Handle profile panel closing
  closeProfile() {
    this.currentDistrict = null;
    this.currentState = null;
  }
}

// Initialize the profile manager
const repProfileManager = new RepProfileManager();

// Make it globally available
window.repProfileManager = repProfileManager;
