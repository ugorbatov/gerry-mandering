// ============================================================
// CONGRESS DATA INTEGRATION
// ============================================================
// This script enhances the existing renderStateDetail() function
// by replacing the "Coming in next phase" message with real API
// data from Congress.gov (votes, sponsored bills, committees).
//
// It also adds a styled popup that matches the existing sidebar.
// ============================================================

(function() {
  'use strict';

  // Cache for API responses
  const profileCache = new Map();
  const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

  /**
   * Fetch rep profile from API with caching
   */
  async function fetchRepProfile(bioguideId) {
    if (!bioguideId) return null;

    // Check cache
    const cached = profileCache.get(bioguideId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const response = await fetch(`/api/rep-profile?repId=${bioguideId}`);
      if (!response.ok) throw new Error('Failed to fetch profile');
      const data = await response.json();
      profileCache.set(bioguideId, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error('Error fetching rep profile:', error);
      return null;
    }
  }

  /**
   * Build the Congress data section HTML
   */
  function buildCongressDataHTML(data) {
    if (!data) return '';

    const sponsored = data.sponsoredBills || [];
    const cosponsored = data.cosponsoredBills || [];
    const recentVotes = data.recentVotes || [];

    let html = '';

    // Sponsored Bills Section
    html += '<div style="margin-top:20px;padding:14px;' +
      'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);' +
      'border-radius:8px;text-align:left;">' +
      '<div style="font-size:10px;color:var(--text-mute);text-transform:uppercase;' +
      'letter-spacing:0.08em;margin-bottom:10px;">Sponsored legislation</div>';

    if (sponsored.length > 0) {
      sponsored.slice(0, 3).forEach(bill => {
        html += '<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border);">' +
          '<div style="font-size:11px;color:var(--text);font-family:\'JetBrains Mono\',monospace;margin-bottom:4px;">' +
          escapeHtml(bill.number || '') + '</div>' +
          '<div style="font-size:11px;color:var(--text-dim);line-height:1.4;">' +
          escapeHtml(truncateText(bill.title || '', 100)) + '</div>';
        if (bill.introducedDate) {
          html += '<div style="font-size:10px;color:var(--text-mute);margin-top:4px;font-family:\'JetBrains Mono\',monospace;">' +
            'Introduced ' + escapeHtml(bill.introducedDate) + '</div>';
        }
        html += '</div>';
      });
      // Remove last border
      html = html.replace(/border-bottom:1px solid var\(--border\);(?=[^;]*$)/, '');
    } else {
      html += '<div style="font-size:11px;color:var(--text-mute);font-style:italic;">No sponsored bills found</div>';
    }
    html += '</div>';

    // Cosponsored Bills Section
    html += '<div style="margin-top:12px;padding:14px;' +
      'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);' +
      'border-radius:8px;text-align:left;">' +
      '<div style="font-size:10px;color:var(--text-mute);text-transform:uppercase;' +
      'letter-spacing:0.08em;margin-bottom:10px;">Cosponsored bills</div>';

    if (cosponsored.length > 0) {
      cosponsored.slice(0, 3).forEach(bill => {
        html += '<div style="margin-bottom:8px;">' +
          '<div style="font-size:11px;color:var(--text);font-family:\'JetBrains Mono\',monospace;">' +
          escapeHtml(bill.number || '') + '</div>' +
          '<div style="font-size:11px;color:var(--text-dim);line-height:1.4;">' +
          escapeHtml(truncateText(bill.title || '', 80)) + '</div>' +
          '</div>';
      });
    } else {
      html += '<div style="font-size:11px;color:var(--text-mute);font-style:italic;">No cosponsored bills found</div>';
    }
    html += '</div>';

    // Recent Votes Section
    if (recentVotes.length > 0) {
      html += '<div style="margin-top:12px;padding:14px;' +
        'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);' +
        'border-radius:8px;text-align:left;">' +
        '<div style="font-size:10px;color:var(--text-mute);text-transform:uppercase;' +
        'letter-spacing:0.08em;margin-bottom:10px;">Recent votes</div>';

      recentVotes.slice(0, 3).forEach(vote => {
        const positionColor = vote.position === 'Yea' ? '#22C55E' : 
                              vote.position === 'Nay' ? '#EF4444' : 'var(--text-dim)';
        html += '<div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
          '<div style="font-size:11px;color:var(--text);flex:1;">' +
          escapeHtml(truncateText(vote.billTitle || '', 50)) + '</div>' +
          '<div style="font-size:10px;color:' + positionColor + ';font-weight:600;text-transform:uppercase;">' +
          escapeHtml(vote.position || '') + '</div>' +
          '</div>';
      });
      html += '</div>';
    }

    // Source line
    html += '<div style="margin-top:10px;font-size:9.5px;color:var(--text-mute);line-height:1.5;">' +
      'Data from Congress.gov API · Updated daily</div>';

    return html;
  }

  /**
   * Helper: truncate text
   */
  function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Helper: escape HTML
   */
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  /**
   * Inject Congress data into the existing sidebar
   * Called after renderStateDetail completes
   */
  async function injectCongressData() {
    // Find the "Coming in next phase" element (rep-coming-soon class)
    const placeholder = document.querySelector('.rep-coming-soon');
    if (!placeholder) return;

    // Get bioguide ID from activeRep (global variable in your app)
    if (typeof activeRep === 'undefined' || !activeRep || !activeRep.bioguide) return;

    const bioguideId = activeRep.bioguide;

    // Show loading state
    placeholder.innerHTML = '<div style="font-size:11px;color:var(--text-mute);text-align:center;padding:8px;">' +
      'Loading legislative activity...</div>';

    // Fetch data
    const data = await fetchRepProfile(bioguideId);

    // Update placeholder
    if (data) {
      // Check if element still has a parent before replacing
      if (placeholder.parentNode) {
        placeholder.outerHTML = buildCongressDataHTML(data);
      }
    } else {
      if (placeholder.parentNode) {
        placeholder.innerHTML = '<strong>Coming in next phase:</strong> voting record, sponsored bills, ' +
          'committee assignments, recent election results, and campaign finance — pending backend integration.';
      }
    }
  }

  /**
   * Hook into renderStateDetail to inject data after it runs
   */
  function setupSidebarHook() {
    // Wait for renderStateDetail to be defined
    const checkInterval = setInterval(() => {
      if (typeof window.renderStateDetail === 'function') {
        const original = window.renderStateDetail;
        window.renderStateDetail = function(...args) {
          const result = original.apply(this, args);
          // Inject data after the panel is rendered
          setTimeout(injectCongressData, 100);
          return result;
        };
        clearInterval(checkInterval);
      }
    }, 100);

    // Also use MutationObserver as backup
    const detailPanel = document.getElementById('detail-panel');
    if (detailPanel) {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === 1 && node.querySelector?.('.rep-coming-soon')) {
                injectCongressData();
                break;
              }
            }
          }
        }
      });
      observer.observe(detailPanel, { childList: true, subtree: true });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSidebarHook);
  } else {
    setupSidebarHook();
  }

  // Expose for debugging
  window.congressDataIntegration = {
    fetchRepProfile,
    injectCongressData,
    cache: profileCache
  };
})();
