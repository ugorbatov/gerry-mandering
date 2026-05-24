/* ============================================================
   BILL TOOLTIP - Shows plain-English summaries
   ============================================================
   First checks bill-summaries.json (local, instant)
   Falls back to Congress.gov API if not found
   Caches results in memory
   ============================================================ */

(function() {
  'use strict';

  let tooltip = null;
  let currentTimer = null;
  let currentBillNumber = null;
  let localSummaries = null; // Will be loaded from bill-summaries.json
  const apiCache = new Map();

  /**
   * Load local summaries from JSON file
   */
  async function loadLocalSummaries() {
    if (localSummaries !== null) return localSummaries;
    
    try {
      const response = await fetch('/bill-summaries.json');
      if (response.ok) {
        const data = await response.json();
        localSummaries = data.bills || {};
        console.log(`Loaded ${Object.keys(localSummaries).length} local bill summaries`);
      } else {
        localSummaries = {};
      }
    } catch (err) {
      console.log('Could not load local bill summaries:', err);
      localSummaries = {};
    }
    return localSummaries;
  }

  /**
   * Normalize bill number into a lookup key
   * "H.R. 8645", "HR8645", "8645" -> "hr-8645"
   */
  function normalizeKey(billNumber, defaultType = 'hr') {
    if (!billNumber) return null;
    const normalized = String(billNumber).toUpperCase().replace(/[.\s]/g, '');
    
    // Match with type prefix
    const matchWithType = normalized.match(/^(HR|S|HJRES|SJRES|HCONRES|SCONRES|HRES|SRES)(\d+)$/);
    if (matchWithType) {
      return `${matchWithType[1].toLowerCase()}-${matchWithType[2]}`;
    }
    
    // Plain number
    const matchPlain = normalized.match(/^(\d+)$/);
    if (matchPlain) {
      return `${defaultType.toLowerCase()}-${matchPlain[1]}`;
    }
    
    return null;
  }

  /**
   * Look up summary in local JSON
   */
  async function getLocalSummary(billNumber) {
    const summaries = await loadLocalSummaries();
    const key = normalizeKey(billNumber);
    if (!key) return null;
    return summaries[key] || null;
  }

  /**
   * Fetch from Congress.gov API as fallback
   */
  async function fetchFromAPI(billNumber) {
    if (apiCache.has(billNumber)) {
      return apiCache.get(billNumber);
    }

    try {
      const response = await fetch(`/api/bill-summary?billNumber=${encodeURIComponent(billNumber)}`);
      if (!response.ok) {
        apiCache.set(billNumber, null);
        return null;
      }
      const data = await response.json();
      apiCache.set(billNumber, data);
      return data;
    } catch (error) {
      console.error('Failed to fetch bill summary:', error);
      return null;
    }
  }

  /**
   * Create the tooltip element
   */
  function createTooltip() {
    if (tooltip) return tooltip;

    tooltip = document.createElement('div');
    tooltip.className = 'bill-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      max-width: 380px;
      min-width: 280px;
      padding: 14px 16px;
      background: var(--surface);
      border: 1px solid var(--border-hi);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      font-size: 12px;
      color: var(--text);
      line-height: 1.6;
      pointer-events: none;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.15s ease;
      display: none;
    `;
    document.body.appendChild(tooltip);
    return tooltip;
  }

  /**
   * Get topic color
   */
  function getTopicColor(topic) {
    if (!topic) return '#3B82F6';
    const colors = {
      'Healthcare': '#22C55E',
      'Health': '#22C55E',
      'Veterans': '#3B82F6',
      'Military': '#3B82F6',
      'Education': '#3B82F6',
      'Taxes': '#F59E0B',
      'Taxation': '#F59E0B',
      'Immigration': '#A855F7',
      'Elections': '#3B82F6',
      'Environment': '#22C55E',
      'Energy': '#F59E0B',
      'Government Operations': '#A855F7',
      'Government': '#A855F7',
      'Foreign Policy': '#3B82F6',
      'Crime': '#EF4444',
      'Budget': '#F59E0B',
      'Housing': '#F59E0B',
      'Transportation': '#3B82F6',
      'Technology': '#A855F7',
      'Labor': '#22C55E',
      'Agriculture': '#22C55E',
    };
    
    // Try exact match first
    if (colors[topic]) return colors[topic];
    
    // Try partial match
    for (const [key, color] of Object.entries(colors)) {
      if (topic.toLowerCase().includes(key.toLowerCase())) {
        return color;
      }
    }
    
    return '#3B82F6';
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
   * Show loading state
   */
  function showLoading(billNumber, e) {
    createTooltip();
    
    tooltip.innerHTML = `
      <div style="font-size:10px;color:var(--text-mute);font-family:'JetBrains Mono', monospace;margin-bottom:8px;">${escapeHtml(billNumber)}</div>
      <div style="font-size:12px;color:var(--text-dim);font-style:italic;text-align:center;padding:8px 0;">
        Loading summary...
      </div>
    `;
    tooltip.style.display = 'block';
    positionTooltip(e);
    requestAnimationFrame(() => {
      tooltip.style.opacity = '1';
    });
  }

  /**
   * Display the bill summary
   */
  function displaySummary(billNumber, data, e, source = 'local') {
    if (!tooltip) return;

    const summary = data.summary || '';
    const title = data.title || '';
    const topic = data.topic || data.policyArea || '';
    const introducedDate = data.introducedDate || '';
    const latestAction = data.latestAction || '';

    let html = '';

    // Topic tag
    if (topic) {
      const color = getTopicColor(topic);
      html += `<div style="margin-bottom:10px;">
        <span style="
          display:inline-block;
          padding:3px 10px;
          background:${color}20;
          border:1px solid ${color}50;
          color:${color};
          font-size:10px;
          font-weight:600;
          border-radius:4px;
          letter-spacing:0.02em;
        ">${escapeHtml(topic)}</span>
      </div>`;
    }

    // Bill number
    html += `<div style="
      font-size:10px;
      color:var(--text-mute);
      font-family:'JetBrains Mono', monospace;
      margin-bottom:6px;
      letter-spacing:0.02em;
    ">${escapeHtml(billNumber)}</div>`;

    // Title (if reasonably short)
    if (title && title.length < 120) {
      html += `<div style="
        font-size:13px;
        color:var(--text);
        font-weight:500;
        margin-bottom:10px;
        line-height:1.4;
      ">${escapeHtml(title)}</div>`;
    }

    // Summary - this is the main content
    if (summary && summary !== 'No summary available' && !summary.includes('not yet written')) {
      html += `<div style="
        font-size:12px;
        color:var(--text-dim);
        line-height:1.6;
        margin-bottom:8px;
      ">${escapeHtml(summary)}</div>`;
    } else {
      html += `<div style="
        font-size:11px;
        color:var(--text-mute);
        font-style:italic;
        padding:6px 0;
      ">Summary not yet available. Click the bill to view full text on Congress.gov.</div>`;
    }

    // Footer with source
    html += `<div style="
      margin-top:8px;
      padding-top:8px;
      border-top:1px solid var(--border);
      font-size:9px;
      color:var(--text-mute);
      font-style:italic;
      display:flex;
      justify-content:space-between;
      align-items:center;
    ">
      <span>${source === 'local' ? 'Plain-English summary' : 'Source: Congress.gov'}</span>
      ${introducedDate ? `<span style="font-family:'JetBrains Mono', monospace;">${escapeHtml(introducedDate)}</span>` : ''}
    </div>`;

    tooltip.innerHTML = html;
    positionTooltip(e);
  }

  /**
   * Show error state
   */
  function showError(billNumber, e) {
    if (!tooltip) return;
    
    tooltip.innerHTML = `
      <div style="font-size:10px;color:var(--text-mute);font-family:'JetBrains Mono', monospace;margin-bottom:6px;">${escapeHtml(billNumber)}</div>
      <div style="font-size:12px;color:var(--text-dim);line-height:1.5;">
        Summary not available. Click the bill in the list to view it on Congress.gov.
      </div>
    `;
    positionTooltip(e);
  }

  /**
   * Show tooltip for a bill card
   */
  async function showTooltip(billCard, e) {
    const billNumberEl = billCard.querySelector('.rep-full-bill-number');
    if (!billNumberEl) return;
    
    const billNumber = billNumberEl.textContent.trim();
    if (!billNumber || billNumber === 'N/A') return;

    currentBillNumber = billNumber;

    // Try local summary FIRST (instant)
    const localData = await getLocalSummary(billNumber);
    
    if (localData) {
      // Found in local file - display immediately!
      createTooltip();
      tooltip.style.display = 'block';
      displaySummary(billNumber, localData, e, 'local');
      tooltip.style.opacity = '1';
      return;
    }

    // Not in local file - try API
    showLoading(billNumber, e);
    
    const apiData = await fetchFromAPI(billNumber);

    // Make sure we're still hovering the same bill
    if (currentBillNumber !== billNumber) return;
    if (tooltip.style.display !== 'block') return;

    if (apiData) {
      displaySummary(billNumber, apiData, e, 'api');
    } else {
      showError(billNumber, e);
    }
  }

  /**
   * Position tooltip near cursor
   */
  function positionTooltip(e) {
    if (!tooltip) return;

    const padding = 12;
    const x = e.clientX + padding;
    const y = e.clientY + padding;
    
    const tooltipRect = tooltip.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;
    
    let finalX = x;
    let finalY = y;
    
    if (x + tooltipRect.width > winWidth - padding) {
      finalX = e.clientX - tooltipRect.width - padding;
    }
    if (y + tooltipRect.height > winHeight - padding) {
      finalY = e.clientY - tooltipRect.height - padding;
    }
    
    tooltip.style.left = Math.max(padding, finalX) + 'px';
    tooltip.style.top = Math.max(padding, finalY) + 'px';
  }

  /**
   * Hide tooltip
   */
  function hideTooltip() {
    if (!tooltip) return;
    currentBillNumber = null;
    tooltip.style.opacity = '0';
    setTimeout(() => {
      if (tooltip && tooltip.style.opacity === '0') {
        tooltip.style.display = 'none';
      }
    }, 150);
  }

  /**
   * Setup event delegation
   */
  function setupListeners() {
    // Pre-load summaries on page load
    loadLocalSummaries();

    document.addEventListener('mouseover', (e) => {
      const billCard = e.target.closest('.rep-full-bill-card');
      if (!billCard) return;
      
      clearTimeout(currentTimer);
      currentTimer = setTimeout(() => {
        showTooltip(billCard, e);
      }, 200);
    });

    document.addEventListener('mousemove', (e) => {
      if (tooltip && tooltip.style.display === 'block' && tooltip.style.opacity === '1') {
        positionTooltip(e);
      }
    });

    document.addEventListener('mouseout', (e) => {
      const billCard = e.target.closest('.rep-full-bill-card');
      if (!billCard) return;
      
      const toBillCard = e.relatedTarget?.closest?.('.rep-full-bill-card');
      if (toBillCard === billCard) return;
      
      clearTimeout(currentTimer);
      hideTooltip();
    });

    window.addEventListener('scroll', hideTooltip, true);
    
    // Style bill cards
    const style = document.createElement('style');
    style.textContent = `
      .rep-full-bill-card {
        cursor: help;
        transition: border-color 0.15s, background 0.15s;
      }
      .rep-full-bill-card:hover {
        border-color: var(--dem) !important;
        background: var(--surface-2) !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupListeners);
  } else {
    setupListeners();
  }
})();
