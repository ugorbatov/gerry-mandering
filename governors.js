/* ============================================================
   STATE GOVERNORS DATA & INTEGRATION
   ============================================================
   Shows the current governor when hovering/clicking a state on
   the national map, and in the state detail panel.
   ============================================================ */

(function() {
  'use strict';

  // Current US Governors as of 2026
  // Source: National Governors Association
  const GOVERNORS = {
    'Alabama': { name: 'Kay Ivey', party: 'Republican', termEnd: 2027, since: 2017 },
    'Alaska': { name: 'Mike Dunleavy', party: 'Republican', termEnd: 2026, since: 2018 },
    'Arizona': { name: 'Katie Hobbs', party: 'Democrat', termEnd: 2027, since: 2023 },
    'Arkansas': { name: 'Sarah Huckabee Sanders', party: 'Republican', termEnd: 2027, since: 2023 },
    'California': { name: 'Gavin Newsom', party: 'Democrat', termEnd: 2027, since: 2019 },
    'Colorado': { name: 'Jared Polis', party: 'Democrat', termEnd: 2027, since: 2019 },
    'Connecticut': { name: 'Ned Lamont', party: 'Democrat', termEnd: 2027, since: 2019 },
    'Delaware': { name: 'Matt Meyer', party: 'Democrat', termEnd: 2029, since: 2025 },
    'Florida': { name: 'Ron DeSantis', party: 'Republican', termEnd: 2027, since: 2019 },
    'Georgia': { name: 'Brian Kemp', party: 'Republican', termEnd: 2027, since: 2019 },
    'Hawaii': { name: 'Josh Green', party: 'Democrat', termEnd: 2027, since: 2022 },
    'Idaho': { name: 'Brad Little', party: 'Republican', termEnd: 2027, since: 2019 },
    'Illinois': { name: 'JB Pritzker', party: 'Democrat', termEnd: 2027, since: 2019 },
    'Indiana': { name: 'Mike Braun', party: 'Republican', termEnd: 2029, since: 2025 },
    'Iowa': { name: 'Kim Reynolds', party: 'Republican', termEnd: 2027, since: 2017 },
    'Kansas': { name: 'Laura Kelly', party: 'Democrat', termEnd: 2027, since: 2019 },
    'Kentucky': { name: 'Andy Beshear', party: 'Democrat', termEnd: 2027, since: 2019 },
    'Louisiana': { name: 'Jeff Landry', party: 'Republican', termEnd: 2028, since: 2024 },
    'Maine': { name: 'Janet Mills', party: 'Democrat', termEnd: 2027, since: 2019 },
    'Maryland': { name: 'Wes Moore', party: 'Democrat', termEnd: 2027, since: 2023 },
    'Massachusetts': { name: 'Maura Healey', party: 'Democrat', termEnd: 2027, since: 2023 },
    'Michigan': { name: 'Gretchen Whitmer', party: 'Democrat', termEnd: 2027, since: 2019 },
    'Minnesota': { name: 'Tim Walz', party: 'Democrat', termEnd: 2027, since: 2019 },
    'Mississippi': { name: 'Tate Reeves', party: 'Republican', termEnd: 2028, since: 2020 },
    'Missouri': { name: 'Mike Kehoe', party: 'Republican', termEnd: 2029, since: 2025 },
    'Montana': { name: 'Greg Gianforte', party: 'Republican', termEnd: 2029, since: 2021 },
    'Nebraska': { name: 'Jim Pillen', party: 'Republican', termEnd: 2027, since: 2023 },
    'Nevada': { name: 'Joe Lombardo', party: 'Republican', termEnd: 2027, since: 2023 },
    'New Hampshire': { name: 'Kelly Ayotte', party: 'Republican', termEnd: 2027, since: 2025 },
    'New Jersey': { name: 'Mikie Sherrill', party: 'Democrat', termEnd: 2030, since: 2026 },
    'New Mexico': { name: 'Michelle Lujan Grisham', party: 'Democrat', termEnd: 2027, since: 2019 },
    'New York': { name: 'Kathy Hochul', party: 'Democrat', termEnd: 2027, since: 2021 },
    'North Carolina': { name: 'Josh Stein', party: 'Democrat', termEnd: 2029, since: 2025 },
    'North Dakota': { name: 'Kelly Armstrong', party: 'Republican', termEnd: 2029, since: 2025 },
    'Ohio': { name: 'Mike DeWine', party: 'Republican', termEnd: 2027, since: 2019 },
    'Oklahoma': { name: 'Kevin Stitt', party: 'Republican', termEnd: 2027, since: 2019 },
    'Oregon': { name: 'Tina Kotek', party: 'Democrat', termEnd: 2027, since: 2023 },
    'Pennsylvania': { name: 'Josh Shapiro', party: 'Democrat', termEnd: 2027, since: 2023 },
    'Rhode Island': { name: 'Daniel McKee', party: 'Democrat', termEnd: 2027, since: 2021 },
    'South Carolina': { name: 'Henry McMaster', party: 'Republican', termEnd: 2027, since: 2017 },
    'South Dakota': { name: 'Larry Rhoden', party: 'Republican', termEnd: 2027, since: 2025 },
    'Tennessee': { name: 'Bill Lee', party: 'Republican', termEnd: 2027, since: 2019 },
    'Texas': { name: 'Greg Abbott', party: 'Republican', termEnd: 2027, since: 2015 },
    'Utah': { name: 'Spencer Cox', party: 'Republican', termEnd: 2029, since: 2021 },
    'Vermont': { name: 'Phil Scott', party: 'Republican', termEnd: 2027, since: 2017 },
    'Virginia': { name: 'Abigail Spanberger', party: 'Democrat', termEnd: 2030, since: 2026 },
    'Washington': { name: 'Bob Ferguson', party: 'Democrat', termEnd: 2029, since: 2025 },
    'West Virginia': { name: 'Patrick Morrisey', party: 'Republican', termEnd: 2029, since: 2025 },
    'Wisconsin': { name: 'Tony Evers', party: 'Democrat', termEnd: 2027, since: 2019 },
    'Wyoming': { name: 'Mark Gordon', party: 'Republican', termEnd: 2027, since: 2019 },
    'District of Columbia': { name: 'Muriel Bowser', party: 'Democrat', termEnd: 2027, since: 2015, isMayor: true }
  };

  /**
   * Get governor info for a state
   */
  function getGovernor(state) {
    return GOVERNORS[state] || null;
  }

  /**
   * Get party class for styling
   */
  function getPartyClass(party) {
    if (!party) return '';
    const p = party.toLowerCase();
    if (p.includes('democrat')) return 'democrat';
    if (p.includes('republican')) return 'republican';
    return 'independent';
  }

  /**
   * Build governor info HTML block
   */
  function buildGovernorHTML(state) {
    const gov = getGovernor(state);
    if (!gov) return '';

    const partyClass = getPartyClass(gov.party);
    const partyColor = partyClass === 'democrat' ? 'var(--dem)' : 
                       partyClass === 'republican' ? 'var(--rep)' : 'var(--ind)';
    const bgColor = partyClass === 'democrat' ? 'rgba(59, 130, 246, 0.08)' : 
                    partyClass === 'republican' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(168, 85, 247, 0.08)';
    const borderColor = partyClass === 'democrat' ? 'rgba(59, 130, 246, 0.25)' : 
                        partyClass === 'republican' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(168, 85, 247, 0.25)';
    const title = gov.isMayor ? 'Mayor' : 'Governor';
    const yearsInOffice = new Date().getFullYear() - gov.since;
    // Under a year in office (e.g. Sherrill in NJ took office Jan 2026) we
    // show "NEW" instead of "0 YRS", which read wrong and made it look like
    // the card was broken. Anyone at 1+ years keeps the calendar-year count.
    const tenureLabel = yearsInOffice < 1
      ? '<span style="color:var(--green);font-weight:500;">NEW</span>'
      : yearsInOffice + ' YR' + (yearsInOffice !== 1 ? 'S' : '');

    return `
      <div class="governor-info" style="
        margin-bottom:16px;
        padding:14px 16px;
        background:${bgColor};
        border:1px solid ${borderColor};
        border-radius:8px;
      ">
        <div style="
          font-size:10px;
          color:var(--text-mute);
          text-transform:uppercase;
          letter-spacing:0.08em;
          margin-bottom:8px;
          font-family:'JetBrains Mono', monospace;
        ">${title} of ${state}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div>
            <div style="font-size:16px;color:var(--text);font-weight:600;margin-bottom:4px;letter-spacing:-0.01em;">${gov.name}</div>
            <div style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:${partyColor};font-weight:500;">
              <span style="width:6px;height:6px;border-radius:50%;background:${partyColor};"></span>
              ${gov.party}
            </div>
          </div>
          <div style="text-align:right;font-size:10px;color:var(--text-mute);font-family:'JetBrains Mono', monospace;">
            <div>SINCE ${gov.since}</div>
            <div style="margin-top:2px;color:var(--text-dim);">${tenureLabel}</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Inject governor info into state detail panel
   * Places it at the TOP of the panel, before everything else
   */
  function injectGovernorInfo() {
    if (typeof activeState === 'undefined' || !activeState) return;
    
    const detailPanel = document.getElementById('detail-panel');
    if (!detailPanel) return;

    // Check if governor info already exists
    if (detailPanel.querySelector('.governor-info')) return;

    const govHTML = buildGovernorHTML(activeState);
    if (!govHTML) return;

    // Try to find different injection points based on what's in the panel
    
    // Option 1: If there's a rep card (district selected), inject after the eyebrow
    const repCard = detailPanel.querySelector('.rep-card');
    if (repCard) {
      const eyebrow = repCard.querySelector('.detail-eyebrow');
      if (eyebrow) {
        eyebrow.insertAdjacentHTML('afterend', govHTML);
        return;
      }
      // If no eyebrow, put at start of rep card
      repCard.insertAdjacentHTML('afterbegin', govHTML);
      return;
    }
    
    // Option 2: Empty state (state clicked but no district selected)
    const empty = detailPanel.querySelector('.empty');
    if (empty) {
      // Insert at the very top of the empty state
      empty.insertAdjacentHTML('afterbegin', govHTML);
      return;
    }
    
    // Option 3: Just put it at the top of the detail panel
    detailPanel.insertAdjacentHTML('afterbegin', govHTML);
  }

  /**
   * Show governor in tooltip on national map hover
   */
  function enhanceStateTooltip() {
    // Look for the national map tooltip
    const tooltip = document.querySelector('.tooltip') || document.querySelector('[class*="tooltip"]');
    if (!tooltip) return;

    // Watch for tooltip changes (when hovering states)
    const observer = new MutationObserver(() => {
      const tooltipText = tooltip.textContent;
      // Try to detect which state is shown
      for (const state of Object.keys(GOVERNORS)) {
        if (tooltipText.includes(state)) {
          // Add governor info if not already there
          if (!tooltip.querySelector('.gov-tooltip-info')) {
            const gov = getGovernor(state);
            if (gov) {
              const partyClass = getPartyClass(gov.party);
              const partyColor = partyClass === 'democrat' ? '#3B82F6' : 
                                 partyClass === 'republican' ? '#EF4444' : '#A855F7';
              const govDiv = document.createElement('div');
              govDiv.className = 'gov-tooltip-info';
              govDiv.style.cssText = 'margin-top:6px;padding-top:6px;border-top:1px solid var(--border);font-size:11px;';
              govDiv.innerHTML = `
                <div style="color:var(--text-mute);font-size:9px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">
                  ${gov.isMayor ? 'Mayor' : 'Governor'}
                </div>
                <div style="color:var(--text);">${gov.name}</div>
                <div style="color:${partyColor};font-size:10px;">${gov.party}</div>
              `;
              tooltip.appendChild(govDiv);
            }
          }
          break;
        }
      }
    });

    observer.observe(tooltip, { childList: true, subtree: true, characterData: true });
  }

  /**
   * Hook into state detail rendering
   */
  function setupHooks() {
    // Hook renderStateDetail
    const checkInterval = setInterval(() => {
      if (typeof window.renderStateDetail === 'function') {
        const original = window.renderStateDetail;
        window.renderStateDetail = function(...args) {
          const result = original.apply(this, args);
          setTimeout(injectGovernorInfo, 50);
          return result;
        };
        clearInterval(checkInterval);
      }
    }, 100);

    // Watch for detail panel changes
    const detailPanel = document.getElementById('detail-panel');
    if (detailPanel) {
      const observer = new MutationObserver(() => {
        injectGovernorInfo();
      });
      observer.observe(detailPanel, { childList: true, subtree: true });
    }

    // Setup tooltip enhancement
    setTimeout(enhanceStateTooltip, 1000);
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHooks);
  } else {
    setupHooks();
  }

  // Expose for debugging and use in index.html
  window.governorInfo = {
    getGovernor,
    GOVERNORS,
    inject: injectGovernorInfo
  };
  
  // Also expose as global 'governors' for index.html to use
  window.governors = GOVERNORS;
})();
