/* ============================================================
   REP POPUP - Quick view popup matching site design
   ============================================================ */

(function() {
  'use strict';

  let popupOverlay = null;
  let lastClickedDistrict = null;
  let lastClickedPathEl = null;

  /**
   * Create popup DOM elements
   */
  function createPopupElements() {
    if (popupOverlay) return;

    popupOverlay = document.createElement('div');
    popupOverlay.className = 'rep-popup-overlay';
    popupOverlay.innerHTML = '<div class="rep-popup" id="rep-popup-content"></div>';
    document.body.appendChild(popupOverlay);

    // Click outside to close
    popupOverlay.addEventListener('click', (e) => {
      if (e.target === popupOverlay) {
        closePopup();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && popupOverlay.classList.contains('active')) {
        closePopup();
      }
    });
  }

  /**
   * Close popup
   */
  function closePopup() {
    if (popupOverlay) {
      popupOverlay.classList.remove('active');
    }
  }

  /**
   * Get party class
   */
  function getPartyClass(party) {
    if (!party) return 'independent';
    const p = String(party).toLowerCase();
    if (p.includes('democrat') || p === 'd') return 'democrat';
    if (p.includes('republican') || p === 'r') return 'republican';
    return 'independent';
  }

  /**
   * Get full party name
   */
  function getPartyName(party) {
    if (!party) return 'Unknown';
    const p = String(party).toLowerCase();
    if (p === 'd' || p.includes('democrat')) return 'Democrat';
    if (p === 'r' || p.includes('republican')) return 'Republican';
    if (p === 'i' || p.includes('independent')) return 'Independent';
    return party;
  }

  /**
   * Get initials from name
   */
  function getInitials(rep) {
    const first = (rep.first_only || '').charAt(0);
    const last = (rep.last || '').charAt(0);
    if (first || last) return (first + last).toUpperCase() || '?';
    
    const fullName = rep.official_full || rep.name || '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  /**
   * Calculate years served from term_start
   */
  function calculateYearsServed(termStart) {
    if (!termStart) return null;
    const start = new Date(termStart);
    if (isNaN(start.getTime())) return null;
    const now = new Date();
    const years = (now - start) / (1000 * 60 * 60 * 24 * 365.25);
    return years.toFixed(1);
  }

  /**
   * Format date
   */
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  /**
   * Build SVG pie chart for demographics
   */
  function buildPieChart(race) {
    if (!race) return '';

    const colors = {
      white: '#A1A1AA',
      black: '#A855F7',
      hispanic: '#F59E0B',
      asian: '#22C55E',
      other: '#52525B'
    };

    const segments = [
      { label: 'White', value: race.white || 0, color: colors.white },
      { label: 'Hispanic', value: race.hispanic || 0, color: colors.hispanic },
      { label: 'Black', value: race.black || 0, color: colors.black },
      { label: 'Asian', value: race.asian || 0, color: colors.asian },
      { label: 'Other / Multi', value: race.other || 0, color: colors.other }
    ].filter(s => s.value > 0);

    const total = segments.reduce((sum, s) => sum + s.value, 0);
    if (total === 0) return '';

    const cx = 45, cy = 45, r = 40, innerR = 22;
    let startAngle = -Math.PI / 2;
    let svgPaths = '';

    segments.forEach(seg => {
      const angle = (seg.value / total) * 2 * Math.PI;
      const endAngle = startAngle + angle;
      
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      
      const x3 = cx + innerR * Math.cos(endAngle);
      const y3 = cy + innerR * Math.sin(endAngle);
      const x4 = cx + innerR * Math.cos(startAngle);
      const y4 = cy + innerR * Math.sin(startAngle);
      
      const largeArc = angle > Math.PI ? 1 : 0;
      
      svgPaths += `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z" fill="${seg.color}" stroke="var(--surface)" stroke-width="0.5"/>`;
      
      startAngle = endAngle;
    });

    let svg = `<svg class="rep-popup-pie" viewBox="0 0 90 90">${svgPaths}</svg>`;

    let legend = '<div class="rep-popup-demo-legend">';
    segments.forEach(seg => {
      legend += `
        <div class="rep-popup-legend-item">
          <div class="rep-popup-legend-label">
            <span class="rep-popup-legend-color" style="background:${seg.color}"></span>
            ${seg.label}
          </div>
          <span class="rep-popup-legend-value">${seg.value.toFixed(1)}%</span>
        </div>
      `;
    });
    legend += '</div>';

    return `<div class="rep-popup-demo-content">${svg}${legend}</div>`;
  }

  /**
   * Get demographics data for a district
   */
  function getDemographics(state, district) {
    if (typeof STATE_ABBR === 'undefined' || typeof DISTRICT_DEMOGRAPHICS === 'undefined') {
      return null;
    }

    const abbr = STATE_ABBR[state];
    if (!abbr) return null;

    const demKey = abbr + '-' + district;
    const districtDem = DISTRICT_DEMOGRAPHICS[demKey];
    
    if (districtDem) {
      return { data: districtDem, isFallback: false };
    }
    
    if (typeof STATE_DEMOGRAPHICS !== 'undefined') {
      const stateDem = STATE_DEMOGRAPHICS[state];
      if (stateDem) {
        return { data: stateDem, isFallback: true };
      }
    }
    
    return null;
  }

  /**
   * Open popup for a representative
   */
  function openPopup(rep, state, districtData, pathEl) {
    createPopupElements();
    
    // Save reference for "View Details" button
    lastClickedDistrict = districtData;
    lastClickedPathEl = pathEl;

    // Preload the photo in background (so it's cached when popup shows)
    if (rep.bioguide) {
      const preloadImg = new Image();
      preloadImg.src = `https://theunitedstates.io/images/congress/225x275/${rep.bioguide}.jpg`;
    }

    const fullName = rep.official_full || ((rep.first_only || '') + ' ' + (rep.last || '')) || 'Unknown';
    const districtLabel = rep.district === 0 ? 'At-large' : 'District ' + rep.district;
    const partyName = getPartyName(rep.party);
    const partyClass = getPartyClass(rep.party);
    const initials = getInitials(rep);
    
    // Use bioguide.congress.gov image (most reliable and fast)
    // Fallback chain: bioguide -> theunitedstates.io -> initials
    const photoUrl = rep.bioguide ? `https://bioguide.congress.gov/photo/${rep.bioguide}.jpg` : null;
    const photoFallback = rep.bioguide ? `https://theunitedstates.io/images/congress/225x275/${rep.bioguide}.jpg` : null;

    const yrs = calculateYearsServed(rep.term_start);
    const demoInfo = getDemographics(state, rep.district);

    // Build HTML
    let html = '<button class="rep-popup-close" aria-label="Close">×</button>';
    
    // Eyebrow
    html += `<div class="rep-popup-eyebrow">${state} · ${districtLabel}</div>`;
    
    // Photo with fallback chain
    html += '<div class="rep-popup-photo-wrap">';
    if (photoUrl) {
      html += `<img class="rep-popup-photo" 
        src="${photoUrl}" 
        alt="${fullName}"
        loading="eager"
        data-fallback="${photoFallback}"
        onerror="if(this.src!=='${photoFallback}'&&this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback='';}else{this.style.display='none';this.nextElementSibling.style.display='flex';}"/>`;
      html += `<div class="rep-popup-photo-fallback" style="display:none;">${initials}</div>`;
    } else {
      html += `<div class="rep-popup-photo-fallback">${initials}</div>`;
    }
    html += '</div>';
    
    // Name & district
    html += `<h2 class="rep-popup-name">${fullName}</h2>`;
    html += `<div class="rep-popup-district-line">${state} · ${districtLabel}</div>`;
    
    // Party badge
    html += '<div class="rep-popup-badge-wrap">';
    html += `<div class="rep-popup-badge ${partyClass}"><span class="dot"></span>${partyName}</div>`;
    html += '</div>';
    
    // Term info grid (matches existing sidebar style)
    if (rep.term_start || yrs || rep.phone) {
      html += '<div class="rep-popup-meta">';
      if (rep.term_start) {
        html += `<div class="rep-popup-meta-item">
          <div class="label">Term began</div>
          <div class="value">${formatDate(rep.term_start)}</div>
        </div>`;
      }
      if (yrs) {
        html += `<div class="rep-popup-meta-item">
          <div class="label">Years served</div>
          <div class="value">${yrs}</div>
        </div>`;
      }
      if (rep.phone) {
        html += `<div class="rep-popup-meta-item">
          <div class="label">Office phone</div>
          <div class="value mono">${rep.phone}</div>
        </div>`;
      }
      if (rep.bioguide) {
        html += `<div class="rep-popup-meta-item">
          <div class="label">Bioguide ID</div>
          <div class="value mono">${rep.bioguide}</div>
        </div>`;
      }
      html += '</div>';
    }
    
    // Demographics pie chart
    if (demoInfo && demoInfo.data && demoInfo.data.race) {
      html += '<div class="rep-popup-demo">';
      html += `<div class="rep-popup-demo-title">${demoInfo.isFallback ? 'State demographics' : 'District demographics'}</div>`;
      html += buildPieChart(demoInfo.data.race);
      
      // Add income/poverty info
      if (demoInfo.data.income !== undefined || demoInfo.data.poverty !== undefined) {
        html += '<div class="rep-popup-demo-stats">';
        if (demoInfo.data.income !== undefined) {
          const income = demoInfo.data.income;
          const incomeStr = income >= 1000 ? `$${(income/1000).toFixed(1)}k` : `$${income}`;
          html += `<div><span>Median income</span><span>${incomeStr}</span></div>`;
        }
        if (demoInfo.data.poverty !== undefined) {
          html += `<div><span>Poverty rate</span><span>${demoInfo.data.poverty.toFixed(1)}%</span></div>`;
        }
        html += '</div>';
      }
      
      html += '</div>';
    }
    
    // Action buttons
    html += '<div class="rep-popup-actions">';
    html += '<button class="rep-popup-btn primary" id="rep-popup-view-details">View full details<span class="arrow">→</span></button>';
    if (rep.url) {
      html += `<a class="rep-popup-btn" href="${rep.url}" target="_blank" rel="noopener">Official website<span class="arrow">→</span></a>`;
    }
    if (rep.bioguide) {
      html += `<a class="rep-popup-btn" href="https://bioguide.congress.gov/search/bio/${rep.bioguide}" target="_blank" rel="noopener">Bioguide profile<span class="arrow">→</span></a>`;
    }
    html += '</div>';

    document.getElementById('rep-popup-content').innerHTML = html;
    
    // Add event listeners
    popupOverlay.querySelector('.rep-popup-close').addEventListener('click', closePopup);
    
    const viewDetailsBtn = document.getElementById('rep-popup-view-details');
    if (viewDetailsBtn) {
      viewDetailsBtn.addEventListener('click', () => {
        // Open the full profile page
        openFullProfile(rep, state);
      });
    }

    // Show popup
    popupOverlay.classList.add('active');
  }

  /**
   * Open full profile page with all rep details
   */
  async function openFullProfile(rep, state) {
    closePopup();
    
    // Create or get full profile container
    let fullProfile = document.getElementById('rep-full-profile-page');
    if (!fullProfile) {
      fullProfile = document.createElement('div');
      fullProfile.id = 'rep-full-profile-page';
      fullProfile.className = 'rep-full-profile';
      document.body.appendChild(fullProfile);
    }

    const fullName = rep.official_full || ((rep.first_only || '') + ' ' + (rep.last || '')) || 'Unknown';
    const districtLabel = rep.district === 0 ? 'At-large' : 'District ' + rep.district;
    const partyName = getPartyName(rep.party);
    const partyClass = getPartyClass(rep.party);
    // Use bioguide.congress.gov as primary, theunitedstates.io as fallback
    const photoUrl = rep.bioguide ? `https://bioguide.congress.gov/photo/${rep.bioguide}.jpg` : null;
    const photoFallback = rep.bioguide ? `https://theunitedstates.io/images/congress/225x275/${rep.bioguide}.jpg` : null;
    const yrs = calculateYearsServed(rep.term_start);
    const initials = getInitials(rep);
    
    // Preload photo
    if (photoUrl) {
      const preloadImg = new Image();
      preloadImg.src = photoUrl;
    }
    
    // Show loading state with spinner and progress messages
    fullProfile.innerHTML = `
      <div class="rep-full-profile-container">
        <button class="rep-full-profile-close">×</button>
        <div id="rep-loading-screen" style="text-align:center;padding:60px 20px;color:var(--text-dim);">
          <div style="margin-bottom:24px;display:flex;justify-content:center;">
            <div class="rep-spinner" style="
              width:48px;
              height:48px;
              border:3px solid var(--border);
              border-top-color:var(--dem);
              border-radius:50%;
              animation:repSpin 0.8s linear infinite;
            "></div>
          </div>
          <div style="font-size:16px;color:var(--text);font-weight:500;margin-bottom:8px;">
            Loading ${escapeHtml(fullName)}'s profile
          </div>
          <div style="font-size:12px;color:var(--text-mute);margin-bottom:32px;">
            Pulling the latest data from multiple sources...
          </div>
          <div id="rep-loading-tasks" style="max-width:380px;margin:0 auto;text-align:left;">
            <div class="loading-task" data-task="profile" style="display:flex;align-items:center;gap:10px;padding:8px 12px;margin-bottom:6px;background:var(--surface);border:1px solid var(--border);border-radius:6px;font-size:12px;">
              <span class="task-icon" style="width:14px;height:14px;display:inline-block;color:var(--text-mute);">○</span>
              <span class="task-label" style="flex:1;color:var(--text-dim);">Member profile from Congress.gov</span>
              <span class="task-detail" style="font-size:10px;color:var(--text-mute);font-family:'JetBrains Mono', monospace;"></span>
            </div>
            <div class="loading-task" data-task="finance" style="display:flex;align-items:center;gap:10px;padding:8px 12px;margin-bottom:6px;background:var(--surface);border:1px solid var(--border);border-radius:6px;font-size:12px;">
              <span class="task-icon" style="width:14px;height:14px;display:inline-block;color:var(--text-mute);">○</span>
              <span class="task-label" style="flex:1;color:var(--text-dim);">Campaign finance from FEC.gov</span>
              <span class="task-detail" style="font-size:10px;color:var(--text-mute);font-family:'JetBrains Mono', monospace;"></span>
            </div>
            <div class="loading-task" data-task="news" style="display:flex;align-items:center;gap:10px;padding:8px 12px;margin-bottom:6px;background:var(--surface);border:1px solid var(--border);border-radius:6px;font-size:12px;">
              <span class="task-icon" style="width:14px;height:14px;display:inline-block;color:var(--text-mute);">○</span>
              <span class="task-label" style="flex:1;color:var(--text-dim);">News articles from NewsAPI</span>
              <span class="task-detail" style="font-size:10px;color:var(--text-mute);font-family:'JetBrains Mono', monospace;"></span>
            </div>
          </div>
        </div>
      </div>
      <style>
        @keyframes repSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .loading-task.loading .task-icon {
          color: var(--dem) !important;
        }
        .loading-task.loading .task-icon::before {
          content: '◐';
          animation: repSpin 1s linear infinite;
          display: inline-block;
        }
        .loading-task.done .task-icon {
          color: #22C55E !important;
        }
        .loading-task.done .task-icon::before {
          content: '✓';
        }
        .loading-task.error .task-icon {
          color: #F59E0B !important;
        }
        .loading-task.error .task-icon::before {
          content: '!';
        }
        .loading-task .task-icon::before {
          content: '○';
        }
      </style>
    `;
    fullProfile.classList.add('active');
    
    // Add close handler
    fullProfile.querySelector('.rep-full-profile-close').addEventListener('click', () => {
      fullProfile.classList.remove('active');
    });

    // Helper to update task status
    const updateTask = (taskName, status, detail = '') => {
      const task = document.querySelector(`.loading-task[data-task="${taskName}"]`);
      if (!task) return;
      task.classList.remove('loading', 'done', 'error');
      task.classList.add(status);
      const detailEl = task.querySelector('.task-detail');
      if (detailEl && detail) {
        detailEl.textContent = detail;
      }
      const labelEl = task.querySelector('.task-label');
      if (labelEl) {
        if (status === 'done') {
          labelEl.style.color = 'var(--text)';
        } else if (status === 'error') {
          labelEl.style.color = 'var(--text-dim)';
        }
      }
    };

    // Start all tasks as loading
    updateTask('profile', 'loading');
    updateTask('finance', 'loading');
    updateTask('news', 'loading');

    // Fetch profile data, campaign finance, and news in parallel
    let profileData = null;
    let financeData = null;
    let newsData = null;
    if (rep.bioguide) {
      try {
        // Get state abbreviation
        const stateAbbr = (typeof STATE_ABBR !== 'undefined' && STATE_ABBR[state]) || state;
        const lastName = (rep.last || fullName.split(' ').pop() || '');
        
        // Track each fetch separately to update loading UI
        const profilePromise = fetch(`/api/rep-profile?repId=${rep.bioguide}`, { cache: 'no-store' })
          .then(async (resp) => {
            if (resp.ok) {
              const data = await resp.json();
              const bills = (data.sponsoredBills?.length || 0) + (data.cosponsoredBills?.length || 0);
              updateTask('profile', 'done', `${bills} bills`);
              return data;
            }
            updateTask('profile', 'error', 'unavailable');
            return null;
          })
          .catch(() => {
            updateTask('profile', 'error', 'failed');
            return null;
          });

        const financePromise = fetch(`/api/rep-finance?name=${encodeURIComponent(lastName)}&state=${stateAbbr}&district=${rep.district}&cycle=2026`, { cache: 'no-store' })
          .then(async (resp) => {
            if (resp.ok) {
              const data = await resp.json();
              const donors = (data.topIndividuals?.length || 0) + (data.topPACs?.length || 0);
              const total = data.totals?.totalReceipts ? formatCurrency(data.totals.totalReceipts) : '';
              updateTask('finance', 'done', donors > 0 ? `${donors} donors · ${total}` : total);
              return data;
            }
            updateTask('finance', 'error', 'unavailable');
            return null;
          })
          .catch(() => {
            updateTask('finance', 'error', 'failed');
            return null;
          });

        const newsPromise = fetch(`/api/rep-news?repName=${encodeURIComponent(fullName)}&state=${encodeURIComponent(state)}&daysBack=25`, { cache: 'no-store' })
          .then(async (resp) => {
            if (resp.ok) {
              const data = await resp.json();
              const count = data.articles?.length || 0;
              updateTask('news', 'done', count > 0 ? `${count} articles` : 'no recent news');
              return data;
            }
            updateTask('news', 'error', 'unavailable');
            return null;
          })
          .catch(() => {
            updateTask('news', 'error', 'failed');
            return null;
          });

        // Wait for all
        [profileData, financeData, newsData] = await Promise.all([profilePromise, financePromise, newsPromise]);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      }
    }

    const sponsoredBills = profileData?.sponsoredBills || [];
    const cosponsoredBills = profileData?.cosponsoredBills || [];
    const committees = profileData?.committees || [];

    // Build full profile HTML
    let html = `
      <div class="rep-full-profile-container">
        <button class="rep-full-profile-close">×</button>
        
        <div class="rep-full-profile-header">
          <div class="rep-full-profile-photo-wrap">
            ${photoUrl ? `
              <img class="rep-full-profile-photo" src="${photoUrl}" alt="${fullName}"
                data-fallback="${photoFallback}"
                onerror="if(this.src!=='${photoFallback}'&&this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback='';}else{this.style.display='none';this.nextElementSibling.style.display='flex';}"/>
              <div class="rep-full-profile-photo-fallback" style="display:none;">${initials}</div>
            ` : `<div class="rep-full-profile-photo-fallback">${initials}</div>`}
          </div>
          <div class="rep-full-profile-info">
            <div class="rep-full-profile-eyebrow">${state} · ${districtLabel}</div>
            <h1 class="rep-full-profile-name">${fullName}</h1>
            <div class="rep-popup-badge ${partyClass}" style="margin:8px 0 16px;">
              <span class="dot"></span>${partyName}
            </div>
            
            <div class="rep-popup-meta" style="margin-top:12px;">
              ${rep.term_start ? `
                <div class="rep-popup-meta-item">
                  <div class="label">Term began</div>
                  <div class="value">${formatDate(rep.term_start)}</div>
                </div>
              ` : ''}
              ${yrs ? `
                <div class="rep-popup-meta-item">
                  <div class="label">Years served</div>
                  <div class="value">${yrs}</div>
                </div>
              ` : ''}
              ${rep.phone ? `
                <div class="rep-popup-meta-item">
                  <div class="label">Office phone</div>
                  <div class="value mono">${rep.phone}</div>
                </div>
              ` : ''}
              ${rep.bioguide ? `
                <div class="rep-popup-meta-item">
                  <div class="label">Bioguide ID</div>
                  <div class="value mono">${rep.bioguide}</div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="rep-full-section">
          <h2 class="rep-full-section-title">News & Coverage</h2>
          ${buildNewsHTML(newsData, fullName)}
        </div>

        <div class="rep-full-section">
          <h2 class="rep-full-section-title">Sponsored Legislation</h2>
          ${sponsoredBills.length > 0 ? `
            <div class="rep-full-bills">
              ${sponsoredBills.slice(0, 5).map(bill => `
                <div class="rep-full-bill-card">
                  <div class="rep-full-bill-number">${escapeHtml(bill.number || 'N/A')}</div>
                  <div class="rep-full-bill-title">${escapeHtml(bill.title || 'Untitled')}</div>
                  ${bill.introducedDate ? `<div class="rep-full-bill-date">Introduced ${escapeHtml(bill.introducedDate)}</div>` : ''}
                  ${bill.latestAction ? `<div class="rep-full-bill-action">Latest: ${escapeHtml(bill.latestAction)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          ` : `<p class="rep-full-empty">No sponsored legislation found.</p>`}
        </div>

        <div class="rep-full-section">
          <h2 class="rep-full-section-title">Cosponsored Bills</h2>
          ${cosponsoredBills.length > 0 ? `
            <div class="rep-full-bills">
              ${cosponsoredBills.slice(0, 5).map(bill => `
                <div class="rep-full-bill-card">
                  <div class="rep-full-bill-number">${escapeHtml(bill.number || 'N/A')}</div>
                  <div class="rep-full-bill-title">${escapeHtml(bill.title || 'Untitled')}</div>
                  ${bill.introducedDate ? `<div class="rep-full-bill-date">Introduced ${escapeHtml(bill.introducedDate)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          ` : `<p class="rep-full-empty">No cosponsored bills found.</p>`}
        </div>

        <div class="rep-full-section">
          <h2 class="rep-full-section-title">Voting Record</h2>
          <a href="https://clerk.house.gov/Votes" target="_blank" rel="noopener" style="
            display:block;
            padding:20px 24px;
            background:var(--surface);
            border:1px solid var(--border-hi);
            border-radius:8px;
            text-decoration:none;
            color:inherit;
            transition:all 0.15s;
          " onmouseover="this.style.background='var(--surface-2)';this.style.borderColor='var(--dem)';" onmouseout="this.style.background='var(--surface)';this.style.borderColor='var(--border-hi)';">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
              <div style="flex:1;">
                <div style="
                  font-size:10px;
                  color:var(--text-mute);
                  text-transform:uppercase;
                  letter-spacing:0.08em;
                  margin-bottom:6px;
                  font-family:'JetBrains Mono', monospace;
                ">Official Source</div>
                <div style="font-size:15px;color:var(--text);font-weight:500;margin-bottom:6px;">
                  View ${escapeHtml(fullName.split(' ').pop() || 'this representative')}'s complete voting record
                </div>
                <div style="font-size:12px;color:var(--text-dim);line-height:1.5;">
                  Access every roll call vote, including the bill voted on, position taken (Yea/Nay), and the final result — directly from the U.S. House Clerk.
                </div>
              </div>
              <div style="
                font-size:28px;
                color:var(--dem);
                line-height:1;
                flex-shrink:0;
              ">→</div>
            </div>
            <div style="
              margin-top:12px;
              padding-top:12px;
              border-top:1px solid var(--border);
              font-size:11px;
              color:var(--text-mute);
              font-family:'JetBrains Mono', monospace;
              letter-spacing:0.02em;
            ">clerk.house.gov/Votes</div>
          </a>
        </div>

        <div class="rep-full-section">
          <h2 class="rep-full-section-title">Campaign Finance (${financeData?.cycle || 2026} Cycle)</h2>
          ${buildFinanceHTML(financeData, fullName)}
        </div>

        <div class="rep-full-section">
          <h2 class="rep-full-section-title">External Resources</h2>
          <div class="rep-full-links">
            ${rep.url ? `<a class="rep-popup-btn" href="${rep.url}" target="_blank" rel="noopener">Official website<span class="arrow">→</span></a>` : ''}
            ${rep.contact_form ? `<a class="rep-popup-btn" href="${rep.contact_form}" target="_blank" rel="noopener">Contact form<span class="arrow">→</span></a>` : ''}
            ${rep.bioguide ? `<a class="rep-popup-btn" href="https://bioguide.congress.gov/search/bio/${rep.bioguide}" target="_blank" rel="noopener">Bioguide profile<span class="arrow">→</span></a>` : ''}
            ${rep.bioguide ? `<a class="rep-popup-btn" href="https://www.govtrack.us/congress/members/${rep.bioguide}" target="_blank" rel="noopener">View on GovTrack<span class="arrow">→</span></a>` : ''}
            ${rep.bioguide ? `<a class="rep-popup-btn" href="https://www.opensecrets.org/members-of-congress/${rep.bioguide}" target="_blank" rel="noopener">Campaign finance (OpenSecrets)<span class="arrow">→</span></a>` : ''}
          </div>
        </div>
      </div>
    `;

    fullProfile.innerHTML = html;
    
    // Re-attach close handler after innerHTML replace
    fullProfile.querySelector('.rep-full-profile-close').addEventListener('click', () => {
      fullProfile.classList.remove('active');
    });
    
    // Scroll to top
    fullProfile.scrollTop = 0;
  }

  /**
   * Helper to escape HTML
   */
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  /**
   * Format currency for display
   */
  function formatCurrency(amount) {
    if (!amount && amount !== 0) return '$0';
    const num = Number(amount);
    if (isNaN(num)) return '$0';
    if (num >= 1000000) {
      return '$' + (num / 1000000).toFixed(2) + 'M';
    }
    if (num >= 1000) {
      return '$' + (num / 1000).toFixed(1) + 'K';
    }
    return '$' + num.toLocaleString();
  }

  /**
   * Format a date for relative display (e.g., "2 hours ago", "3 days ago")
   */
  function formatRelativeDate(isoDate) {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate;
    
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }

  /**
   * Build News & Coverage HTML section
   */
  function buildNewsHTML(data, repName) {
    if (!data || !data.articles || data.articles.length === 0) {
      return `
        <div style="padding:20px;background:var(--surface);border:1px solid var(--border);border-radius:8px;text-align:center;">
          <div style="font-size:13px;color:var(--text-dim);margin-bottom:8px;">No recent news articles found.</div>
          <a href="https://news.google.com/search?q=${encodeURIComponent(repName + ' congress')}" target="_blank" rel="noopener" style="font-size:12px;color:var(--dem);">
            Search Google News →
          </a>
        </div>
      `;
    }

    const articles = data.articles;
    
    let html = '<div style="display:grid;gap:12px;">';
    
    articles.slice(0, 8).forEach(article => {
      const hasImage = article.imageUrl && article.imageUrl.startsWith('http');
      
      html += `
        <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener" 
           style="display:block;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:8px;text-decoration:none;color:inherit;transition:all 0.15s;"
           onmouseover="this.style.background='var(--surface-2)';this.style.borderColor='var(--dem)';"
           onmouseout="this.style.background='var(--surface)';this.style.borderColor='var(--border)';">
          <div style="display:flex;gap:14px;align-items:flex-start;">
            ${hasImage ? `
              <div style="width:80px;height:80px;flex-shrink:0;border-radius:6px;overflow:hidden;background:var(--surface-2);">
                <img src="${escapeHtml(article.imageUrl)}" 
                     alt="" 
                     loading="lazy"
                     style="width:100%;height:100%;object-fit:cover;display:block;"
                     onerror="this.parentElement.style.display='none';"/>
              </div>
            ` : ''}
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
                <span style="font-size:10px;color:var(--dem);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;font-family:'JetBrains Mono', monospace;">
                  ${escapeHtml(article.source)}
                </span>
                <span style="font-size:10px;color:var(--text-mute);font-family:'JetBrains Mono', monospace;">
                  ${escapeHtml(formatRelativeDate(article.publishedAt))}
                </span>
              </div>
              <div style="font-size:14px;color:var(--text);font-weight:500;line-height:1.4;margin-bottom:6px;">
                ${escapeHtml(article.title)}
              </div>
              ${article.description ? `
                <div style="font-size:12px;color:var(--text-dim);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                  ${escapeHtml(article.description)}
                </div>
              ` : ''}
            </div>
          </div>
        </a>
      `;
    });
    
    html += '</div>';
    
    // Footer with search link
    html += `
      <div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--text-mute);">
        <span style="font-style:italic;">Source: NewsAPI · Past 60 days</span>
        <a href="https://news.google.com/search?q=${encodeURIComponent(repName + ' congress')}" target="_blank" rel="noopener" style="color:var(--dem);text-decoration:none;">
          More on Google News →
        </a>
      </div>
    `;
    
    return html;
  }

  /**
   * Title-case a string (e.g., "RETIRED" -> "Retired")
   */
  function titleCase(str) {
    if (!str) return '';
    return String(str).toLowerCase().split(/\s+/).map(w => 
      w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : ''
    ).join(' ').trim();
  }

  /**
   * Build campaign finance HTML section
   */
  function buildFinanceHTML(data, repName) {
    if (!data) {
      return `<p class="rep-full-empty">Campaign finance data could not be loaded.</p>`;
    }
    
    if (data.error) {
      return `
        <div style="padding:20px;background:var(--surface);border:1px solid var(--border);border-radius:8px;">
          <div style="font-size:13px;color:var(--text-dim);margin-bottom:8px;">${escapeHtml(data.error)}</div>
          <a href="https://www.fec.gov/data/candidates/?search=${encodeURIComponent(repName)}" target="_blank" rel="noopener" style="font-size:12px;color:var(--dem);">
            Search FEC.gov directly →
          </a>
        </div>
      `;
    }

    const totals = data.totals || {};
    const employers = data.topEmployers || [];
    const occupations = data.topOccupations || [];
    const individuals = data.topIndividuals || [];
    const pacs = data.topPACs || [];
    const sizes = data.contributionSizes || [];

    let html = '';

    // Top-line totals (4 cards)
    if (totals.totalReceipts !== undefined) {
      html += `
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:12px;margin-bottom:24px;">
          <div style="padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:8px;">
            <div style="font-size:10px;color:var(--text-mute);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;font-family:'JetBrains Mono', monospace;">Total Raised</div>
            <div style="font-size:20px;color:var(--text);font-weight:600;">${formatCurrency(totals.totalReceipts)}</div>
          </div>
          <div style="padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:8px;">
            <div style="font-size:10px;color:var(--text-mute);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;font-family:'JetBrains Mono', monospace;">Total Spent</div>
            <div style="font-size:20px;color:var(--text);font-weight:600;">${formatCurrency(totals.totalDisbursements)}</div>
          </div>
          <div style="padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:8px;">
            <div style="font-size:10px;color:var(--text-mute);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;font-family:'JetBrains Mono', monospace;">Cash on Hand</div>
            <div style="font-size:20px;color:var(--text);font-weight:600;">${formatCurrency(totals.cashOnHand)}</div>
          </div>
          <div style="padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:8px;">
            <div style="font-size:10px;color:var(--text-mute);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;font-family:'JetBrains Mono', monospace;">Debts</div>
            <div style="font-size:20px;color:var(--text);font-weight:600;">${formatCurrency(totals.debts)}</div>
          </div>
        </div>
      `;
    }

    // Source breakdown
    if (totals.individualContributions !== undefined) {
      const totalContribs = (totals.individualContributions || 0) + (totals.pacContributions || 0) + (totals.partyContributions || 0);
      if (totalContribs > 0) {
        const indPct = ((totals.individualContributions || 0) / totalContribs * 100).toFixed(0);
        const pacPct = ((totals.pacContributions || 0) / totalContribs * 100).toFixed(0);
        const partyPct = ((totals.partyContributions || 0) / totalContribs * 100).toFixed(0);
        
        html += `
          <div style="margin-bottom:24px;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:8px;">
            <div style="font-size:11px;color:var(--text-mute);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:14px;font-family:'JetBrains Mono', monospace;">Money sources</div>
            <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--surface-2);margin-bottom:12px;">
              <div style="background:#3B82F6;width:${indPct}%;" title="Individuals"></div>
              <div style="background:#F59E0B;width:${pacPct}%;" title="PACs"></div>
              <div style="background:#A855F7;width:${partyPct}%;" title="Party"></div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px;font-size:12px;">
              <div>
                <div style="display:flex;align-items:center;gap:6px;color:var(--text-dim);margin-bottom:2px;">
                  <span style="width:8px;height:8px;border-radius:2px;background:#3B82F6;"></span>Individuals
                </div>
                <div style="color:var(--text);font-weight:500;">${formatCurrency(totals.individualContributions)} <span style="color:var(--text-mute);font-size:11px;">(${indPct}%)</span></div>
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:6px;color:var(--text-dim);margin-bottom:2px;">
                  <span style="width:8px;height:8px;border-radius:2px;background:#F59E0B;"></span>PACs
                </div>
                <div style="color:var(--text);font-weight:500;">${formatCurrency(totals.pacContributions)} <span style="color:var(--text-mute);font-size:11px;">(${pacPct}%)</span></div>
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:6px;color:var(--text-dim);margin-bottom:2px;">
                  <span style="width:8px;height:8px;border-radius:2px;background:#A855F7;"></span>Party
                </div>
                <div style="color:var(--text);font-weight:500;">${formatCurrency(totals.partyContributions)} <span style="color:var(--text-mute);font-size:11px;">(${partyPct}%)</span></div>
              </div>
            </div>
          </div>
        `;
      }
    }

    // Top Individual Donors - compact list with clickable names
    if (individuals.length > 0) {
      const maxIndividual = individuals[0].total;
      html += `
        <div style="margin-bottom:20px;">
          <h3 style="font-size:13px;color:var(--text);font-weight:600;margin:0 0 12px;letter-spacing:-0.01em;">Top Individual Donors</h3>
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;">
            ${individuals.slice(0, 10).map((i, idx) => {
              const pct = (i.total / maxIndividual * 100).toFixed(1);
              const location = [i.city, i.state].filter(Boolean).join(', ');
              const jobInfo = i.occupation ? titleCase(i.occupation) : '';
              const employer = i.employer && !['NOT EMPLOYED', 'N/A', 'NONE'].includes(i.employer.toUpperCase()) ? titleCase(i.employer) : '';
              // Build FEC search URL for this donor
              const fecSearchUrl = `https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=${encodeURIComponent(i.name)}&min_date=01%2F01%2F2025`;
              return `
                <a href="${fecSearchUrl}" target="_blank" rel="noopener" style="
                  display:block;
                  padding:9px 12px;
                  border-bottom:${idx < 9 ? '1px solid var(--border)' : 'none'};
                  text-decoration:none;
                  color:inherit;
                  transition:background 0.15s;
                  position:relative;
                " onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='transparent'">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
                    <div style="flex:1;min-width:0;overflow:hidden;">
                      <div style="display:flex;align-items:baseline;gap:8px;">
                        <span style="font-size:12px;color:var(--text);font-weight:500;">${escapeHtml(titleCase(i.name))}</span>
                        ${location ? `<span style="font-size:10px;color:var(--text-mute);font-family:'JetBrains Mono', monospace;">${escapeHtml(location)}</span>` : ''}
                      </div>
                      ${(jobInfo || employer) ? `<div style="font-size:10px;color:var(--text-mute);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml([jobInfo, employer].filter(Boolean).join(' · '))}</div>` : ''}
                    </div>
                    <div style="text-align:right;flex-shrink:0;">
                      <div style="font-size:12px;color:var(--text);font-weight:600;font-variant-numeric:tabular-nums;">${formatCurrency(i.total)}</div>
                      ${i.count > 1 ? `<div style="font-size:9px;color:var(--text-mute);font-family:'JetBrains Mono', monospace;">${i.count}×</div>` : ''}
                    </div>
                  </div>
                  <div style="height:2px;background:transparent;margin-top:6px;border-radius:1px;overflow:hidden;">
                    <div style="height:100%;background:var(--dem);width:${pct}%;opacity:0.6;"></div>
                  </div>
                </a>
              `;
            }).join('')}
          </div>
          <div style="margin-top:6px;font-size:10px;color:var(--text-mute);font-style:italic;">Click any donor to see their full FEC contribution history</div>
        </div>
      `;
    }

    // Top PAC Donors - compact list with clickable names
    if (pacs.length > 0) {
      const maxPAC = pacs[0].total;
      html += `
        <div style="margin-bottom:20px;">
          <h3 style="font-size:13px;color:var(--text);font-weight:600;margin:0 0 12px;letter-spacing:-0.01em;">Top PAC Donors</h3>
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;">
            ${pacs.slice(0, 10).map((p, idx) => {
              const pct = (p.total / maxPAC * 100).toFixed(1);
              // PAC profile URL on FEC
              const pacUrl = p.committeeId 
                ? `https://www.fec.gov/data/committee/${p.committeeId}/`
                : `https://www.fec.gov/data/receipts/?committee_name=${encodeURIComponent(p.name)}`;
              return `
                <a href="${pacUrl}" target="_blank" rel="noopener" style="
                  display:block;
                  padding:9px 12px;
                  border-bottom:${idx < 9 ? '1px solid var(--border)' : 'none'};
                  text-decoration:none;
                  color:inherit;
                  transition:background 0.15s;
                " onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='transparent'">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
                    <div style="flex:1;min-width:0;overflow:hidden;">
                      <div style="font-size:12px;color:var(--text);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(titleCase(p.name))}</div>
                      ${p.committeeId || p.state ? `<div style="font-size:10px;color:var(--text-mute);font-family:'JetBrains Mono', monospace;margin-top:1px;">${escapeHtml([p.committeeId, p.state].filter(Boolean).join(' · '))}</div>` : ''}
                    </div>
                    <div style="text-align:right;flex-shrink:0;">
                      <div style="font-size:12px;color:var(--text);font-weight:600;font-variant-numeric:tabular-nums;">${formatCurrency(p.total)}</div>
                      ${p.count > 1 ? `<div style="font-size:9px;color:var(--text-mute);font-family:'JetBrains Mono', monospace;">${p.count}×</div>` : ''}
                    </div>
                  </div>
                  <div style="height:2px;background:transparent;margin-top:6px;border-radius:1px;overflow:hidden;">
                    <div style="height:100%;background:#F59E0B;width:${pct}%;opacity:0.6;"></div>
                  </div>
                </a>
              `;
            }).join('')}
          </div>
          <div style="margin-top:6px;font-size:10px;color:var(--text-mute);font-style:italic;">Click any PAC to see its full profile and activity on FEC.gov</div>
        </div>
      `;
    }

    // Top employers
    if (employers.length > 0) {
      const maxAmount = employers[0].total;
      html += `
        <div style="margin-bottom:20px;">
          <h3 style="font-size:13px;color:var(--text);font-weight:600;margin:0 0 12px;letter-spacing:-0.01em;">Top Contributing Employers</h3>
          <div style="display:grid;gap:8px;">
            ${employers.slice(0, 8).map(e => {
              const pct = (e.total / maxAmount * 100).toFixed(1);
              return `
                <div style="padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:6px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px;">
                    <div style="font-size:12px;color:var(--text);flex:1;">${escapeHtml(titleCase(e.employer))}</div>
                    <div style="font-size:12px;color:var(--text);font-weight:500;font-variant-numeric:tabular-nums;">${formatCurrency(e.total)}</div>
                  </div>
                  <div style="height:3px;background:var(--surface-2);border-radius:2px;overflow:hidden;">
                    <div style="height:100%;background:var(--dem);width:${pct}%;"></div>
                  </div>
                  ${e.count ? `<div style="font-size:10px;color:var(--text-mute);margin-top:4px;font-family:'JetBrains Mono', monospace;">${e.count} contribution${e.count !== 1 ? 's' : ''}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Two columns: Occupations and Sizes
    if (occupations.length > 0 || sizes.length > 0) {
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:20px;margin-bottom:20px;">`;
      
      if (occupations.length > 0) {
        const maxOccAmount = occupations[0].total;
        html += `
          <div>
            <h3 style="font-size:13px;color:var(--text);font-weight:600;margin:0 0 12px;letter-spacing:-0.01em;">Top Donor Occupations</h3>
            <div style="display:grid;gap:6px;">
              ${occupations.slice(0, 6).map(o => {
                const pct = (o.total / maxOccAmount * 100).toFixed(1);
                return `
                  <div style="padding:8px 10px;background:var(--surface);border:1px solid var(--border);border-radius:6px;">
                    <div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;">
                      <span style="color:var(--text);">${escapeHtml(titleCase(o.occupation))}</span>
                      <span style="color:var(--text);font-weight:500;font-variant-numeric:tabular-nums;">${formatCurrency(o.total)}</span>
                    </div>
                    <div style="height:2px;background:var(--surface-2);border-radius:1px;overflow:hidden;margin-top:6px;">
                      <div style="height:100%;background:var(--dem);width:${pct}%;"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }
      
      if (sizes.length > 0) {
        const maxSizeAmount = Math.max(...sizes.map(s => s.total));
        html += `
          <div>
            <h3 style="font-size:13px;color:var(--text);font-weight:600;margin:0 0 12px;letter-spacing:-0.01em;">Contribution Sizes</h3>
            <div style="display:grid;gap:6px;">
              ${sizes.map(s => {
                const pct = (s.total / maxSizeAmount * 100).toFixed(1);
                return `
                  <div style="padding:8px 10px;background:var(--surface);border:1px solid var(--border);border-radius:6px;">
                    <div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;">
                      <span style="color:var(--text);">${escapeHtml(s.size)}</span>
                      <span style="color:var(--text);font-weight:500;font-variant-numeric:tabular-nums;">${formatCurrency(s.total)}</span>
                    </div>
                    <div style="height:2px;background:var(--surface-2);border-radius:1px;overflow:hidden;margin-top:6px;">
                      <div style="height:100%;background:#22C55E;width:${pct}%;"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }
      
      html += `</div>`;
    }

    // Source footer
    html += `
      <div style="margin-top:8px;font-size:10px;color:var(--text-mute);font-style:italic;text-align:right;">
        Source: FEC.gov · 
        <a href="https://www.fec.gov/data/candidate/${data.candidateId}/" target="_blank" rel="noopener" style="color:var(--text-mute);text-decoration:underline;">View full FEC profile →</a>
      </div>
    `;

    return html;
  }

  // Photo error handler - tries fallback URLs
  window.handleRepPhotoError = function(img) {
    try {
      const fallbackUrls = JSON.parse(img.getAttribute('data-fallback-urls') || '[]');
      if (fallbackUrls.length > 0) {
        const nextUrl = fallbackUrls.shift();
        img.setAttribute('data-fallback-urls', JSON.stringify(fallbackUrls));
        img.src = nextUrl;
      } else {
        // No more fallbacks, show initials
        img.style.display = 'none';
        if (img.nextElementSibling) {
          img.nextElementSibling.style.display = 'flex';
        }
      }
    } catch (e) {
      img.style.display = 'none';
      if (img.nextElementSibling) {
        img.nextElementSibling.style.display = 'flex';
      }
    }
  };

  /**
   * Public API - call this when a district is clicked
   */
  window.openRepPopup = function(rep, state, districtData, pathEl) {
    if (!rep) return;
    openPopup(rep, state, districtData, pathEl);
  };

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createPopupElements);
  } else {
    createPopupElements();
  }
})();
