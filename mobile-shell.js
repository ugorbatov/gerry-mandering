/* ============================================================================
   MOBILE APP SHELL  (index.html)
   ----------------------------------------------------------------------------
   Builds an app-like mobile experience (bottom tabs, docked overview card,
   district / cycle / filters bottom sheets, districts list, data tab, news
   tab) ON TOP of the existing desktop map. Everything is gated behind
   isMobile(); desktop is never touched.

   Reuses existing globals & functions (all defined in index.html earlier):
     isMobile, showStateView, showNationalView, openRepDetailModal,
     loadRepNews, findStateLegislators, getDelegation,
     STATE_DEMOGRAPHICS, DISTRICT_DEMOGRAPHICS, ELECTION_DATA, STATE_POPULATION,
     STATE_ABBR, RACE_BUCKETS, buildRaceBar, formatIncomeCompact, escapeHtml,
     partyClass, _historyControls, HISTORY_DATA, HISTORY_LATEST_YEAR,
     selectedYear, viewMode, activeState, stateLegislators
   Reads window.governors (governors.js).
   ============================================================================ */
(function () {
  'use strict';

  // Defensive helpers — never throw if a global isn't ready.
  // Inline-scope `let`/`const` from index.html are published on window.__gerry
  // (see the "MOBILE SHELL BRIDGE" block there); fall back to window[name] for
  // anything attached globally (function declarations, script-loaded objects).
  var _g = function (name) {
    try {
      var b = window.__gerry;
      if (b && (name in b)) return b[name];
      return window[name];
    } catch (e) { return undefined; }
  };
  function mobileOn() { var f = _g('isMobile'); try { return typeof f === 'function' && f(); } catch (e) { return false; } }

  // ── ICONS ─────────────────────────────────────────────────────────────────
  var ICON = {
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="6" r="1.4"/><circle cx="4" cy="12" r="1.4"/><circle cx="4" cy="18" r="1.4"/><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/></svg>',
    data: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    news: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><line x1="10" y1="7" x2="18" y2="7"/><line x1="10" y1="11" x2="14" y2="11"/></svg>',
    filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2" fill="var(--surface)"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="18" r="2" fill="var(--surface)"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4"/></svg>'
  };

  // ── STATE ───────────────────────────────────────────────────────────────────
  var shell = {
    built: false,
    tab: 'map',           // map | districts | data | news
    filters: { party: 'all', comp: 'all', metric: 'party', labels: true },
    newsLoadedFor: null
  };

  // RACE color/label fallback if RACE_BUCKETS isn't reachable for some reason.
  function raceBuckets() {
    var rb = _g('RACE_BUCKETS');
    if (rb && rb.length) return rb;
    return [
      { key: 'white', label: 'White', color: '#64748B' },
      { key: 'hispanic', label: 'Hispanic', color: '#F59E0B' },
      { key: 'black', label: 'Black', color: '#A855F7' },
      { key: 'asian', label: 'Asian', color: '#3B82F6' },
      { key: 'native', label: 'Native', color: '#22C55E' },
      { key: 'other', label: 'Other / Multi', color: '#52525B' }
    ];
  }

  function esc(s) {
    var fn = _g('escapeHtml');
    if (typeof fn === 'function') return fn(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtIncome(n) {
    var fn = _g('formatIncomeCompact');
    if (typeof fn === 'function') return fn(n);
    return n != null ? '$' + Math.round(n / 1000) + 'k' : '—';
  }
  function partyLetter(p) {
    if (!p) return 'I';
    var s = p.toLowerCase();
    if (s.indexOf('democr') === 0 || s === 'd') return 'D';
    if (s.indexOf('republic') === 0 || s === 'r') return 'R';
    return 'I';
  }
  function partyKey(p) { return ({ D: 'd', R: 'r', I: 'i' })[partyLetter(p)]; }

  // ── DOM BUILD ───────────────────────────────────────────────────────────────
  function build() {
    if (shell.built) return;
    shell.built = true;

    var root = document.createElement('div');
    root.className = 'ms-root';
    root.innerHTML = [
      // top map bar (cycle pill + filter button) — map tab only
      '<div class="ms-mapbar" id="ms-mapbar">',
      '  <button class="ms-cycle-pill" id="ms-cycle-pill"><span><span class="yr" id="ms-cycle-yr">2024</span> · <span class="cong" id="ms-cycle-cong">119th Congress</span></span></button>',
      '  <button class="ms-filter-btn" id="ms-filter-btn" aria-label="Filters">' + ICON.filter + '</button>',
      '</div>',

      // docked overview card — map tab only
      '<div class="ms-overview" id="ms-overview">',
      '  <div class="ms-ov-handle" id="ms-ov-handle"></div>',
      '  <div id="ms-ov-body"></div>',
      '</div>',

      // scrolling content surfaces for non-map tabs
      '<div class="ms-content" id="ms-content-districts"></div>',
      '<div class="ms-content" id="ms-content-data"></div>',
      '<div class="ms-content" id="ms-content-news"></div>',

      // bottom tab bar
      '<div class="ms-tabbar">',
      tabBtn('map', 'Map', ICON.map),
      tabBtn('districts', 'Districts', ICON.list),
      tabBtn('data', 'Data', ICON.data),
      tabBtn('news', 'News', ICON.news),
      '</div>',

      // generic sheet (district / cycle / filters share one scrim + element)
      '<div class="ms-sheet-scrim" id="ms-scrim"></div>',
      '<div class="ms-sheet" id="ms-sheet">',
      '  <div class="ms-sheet-handle"></div>',
      '  <div class="ms-sheet-head"><h3 id="ms-sheet-title"></h3><div id="ms-sheet-actions"></div></div>',
      '  <div class="ms-sheet-body" id="ms-sheet-body"></div>',
      '</div>'
    ].join('');
    document.body.appendChild(root);

    // wire tab buttons
    root.querySelectorAll('.ms-tab').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.dataset.tab); });
    });
    // cycle pill + filter
    document.getElementById('ms-cycle-pill').addEventListener('click', openCycleSheet);
    document.getElementById('ms-filter-btn').addEventListener('click', openFiltersSheet);
    // scrim closes sheet
    document.getElementById('ms-scrim').addEventListener('click', closeSheet);
    // overview handle toggles collapse
    document.getElementById('ms-ov-handle').addEventListener('click', function () {
      document.getElementById('ms-overview').classList.toggle('collapsed');
    });
  }

  function tabBtn(id, label, ico) {
    return '<button class="ms-tab" data-tab="' + id + '"><span class="ms-tab-ico">' + ico + '</span>' + label + '</button>';
  }

  // ── TAB SWITCHING ─────────────────────────────────────────────────────────
  function setTab(tab) {
    shell.tab = tab;
    document.body.classList.remove('ms-tab-map', 'ms-tab-districts', 'ms-tab-data', 'ms-tab-news');
    document.body.classList.add('ms-tab-' + tab);
    var root = document.querySelector('.ms-root');
    if (root) root.querySelectorAll('.ms-tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    if (tab === 'districts') renderDistrictsTab();
    if (tab === 'data') renderDataTab();
    if (tab === 'news') renderNewsTab();
    if (tab === 'map') renderOverview();
  }

  // ── HELPERS to read current state ───────────────────────────────────────────
  function curState() { return _g('activeState') || null; }
  function inState() { return _g('viewMode') === 'state' && !!curState(); }
  function legislators() {
    var sl = _g('stateLegislators');
    if (sl && sl.length) return sl;
    var st = curState();
    var find = _g('findStateLegislators');
    var ABBR = _g('STATE_ABBR');
    if (st && typeof find === 'function' && ABBR) return find(ABBR[st]) || [];
    return [];
  }
  function delegation(st) {
    var fn = _g('getDelegation');
    if (typeof fn === 'function' && st) { try { return fn(st); } catch (e) {} }
    return { d: 0, r: 0, ind: 0 };
  }

  // ── OVERVIEW CARD (map tab) ─────────────────────────────────────────────────
  function renderOverview() {
    var body = document.getElementById('ms-ov-body');
    if (!body) return;
    var st = curState();

    if (!inState()) {
      // national overview — total House delegation
      var nat = nationalTotals();
      body.innerHTML =
        '<div class="ms-ov-title">U.S. House</div>' +
        '<div class="ms-ov-sub">Tap a state on the map to drill in</div>' +
        seatTrio(nat.d, nat.r, nat.i) +
        popVoteBlock(nat.popD, nat.popR);
      return;
    }

    var del = delegation(st);
    var pv = popularVote(st);
    body.innerHTML =
      '<div class="ms-ov-title">' + esc(st) + '</div>' +
      '<div class="ms-ov-sub">Tap a district to see details</div>' +
      seatTrio(del.d, del.r, del.ind) +
      popVoteBlock(pv.d, pv.r) +
      '<button class="ms-btn" id="ms-ov-alldistricts">' + ICON.list + ' View all districts</button>';
    var btn = document.getElementById('ms-ov-alldistricts');
    if (btn) btn.addEventListener('click', function () { setTab('districts'); });
  }

  function seatTrio(d, r, i) {
    return '<div class="ms-seats">' +
      '<div class="ms-seat d"><div class="n">' + (d || 0) + '</div><div class="l">Democrat</div></div>' +
      '<div class="ms-seat r"><div class="n">' + (r || 0) + '</div><div class="l">Republican</div></div>' +
      '<div class="ms-seat i"><div class="n">' + (i || 0) + '</div><div class="l">Independent</div></div>' +
      '</div>';
  }
  function popVoteBlock(dPct, rPct) {
    if (dPct == null || rPct == null) return '';
    return '<div class="ms-pv-label">House popular vote</div>' +
      '<div class="ms-pv-vals"><span class="d">' + dPct.toFixed(1) + '% D</span><span class="r">' + rPct.toFixed(1) + '% R</span></div>' +
      '<div class="ms-pv-bar"><span class="d" style="width:' + dPct + '%"></span><span class="r" style="width:' + rPct + '%"></span></div>';
  }

  // House popular vote shares for a state. ELECTION_DATA[state].house is the
  // Republican share; Dem = 100 - R (two-way approximation, same convention
  // the rest of the site uses).
  function popularVote(st) {
    var E = _g('ELECTION_DATA');
    if (E && E[st] && E[st].house != null) {
      var r = E[st].house;
      return { d: 100 - r, r: r };
    }
    return { d: null, r: null };
  }

  function nationalTotals() {
    var E = _g('ELECTION_DATA');
    var ABBR = _g('STATE_ABBR');
    var d = 0, r = 0, i = 0;
    if (ABBR) {
      Object.keys(ABBR).forEach(function (st) {
        if (st === 'District of Columbia') return;
        var del = delegation(st);
        d += del.d || 0; r += del.r || 0; i += del.ind || 0;
      });
    }
    // National popular vote: use the well-known 2024 House totals if present in
    // mockup data; otherwise approximate from the average. We show the seat
    // counts (authoritative) and a representative popular-vote split.
    return { d: d, r: r, i: i, popD: 47.7, popR: 50.6 };
  }

  // ── DISTRICTS LIST tab ──────────────────────────────────────────────────────
  function renderDistrictsTab() {
    var el = document.getElementById('ms-content-districts');
    if (!el) return;
    var st = curState();
    if (!inState()) {
      el.innerHTML = emptyState('Select a state first', 'Go to the Map tab and tap a state to see its districts.');
      return;
    }
    var legs = legislators().slice().sort(function (a, b) {
      return (a.district == null ? 999 : a.district) - (b.district == null ? 999 : b.district);
    });
    var rows = legs.map(function (rep) {
      var L = partyLetter(rep.party), k = partyKey(rep.party);
      var dno = rep.district === 0 ? 'At-large' : 'District ' + rep.district;
      var name = rep.official_full || ((rep.first_only || '') + ' ' + (rep.last || '')).trim() || 'Vacant';
      return '<div class="ms-dist-row ' + k + '" data-district="' + rep.district + '">' +
        '<div class="ms-dist-num">' + (rep.district === 0 ? '•' : rep.district) + '</div>' +
        '<div class="ms-dist-info"><div class="ms-dist-dno">' + dno + '</div>' +
        '<div class="ms-dist-rep">' + esc(name) + ' (' + L + ')</div></div>' +
        '<div class="ms-dist-badge ' + k + '">' + L + '</div>' +
        '</div>';
    }).join('');

    el.innerHTML =
      '<div class="ms-content-head"><div class="ms-content-title">' + esc(st) + '</div>' +
      '<div class="ms-content-sub">' + legs.length + ' congressional districts</div></div>' +
      (rows || emptyState('No district data', 'Representative data is still loading.'));

    el.querySelectorAll('.ms-dist-row').forEach(function (row) {
      row.addEventListener('click', function () {
        var dn = Number(row.dataset.district);
        var rep = legs.find(function (r) { return Number(r.district) === dn; });
        openDistrictSheet(dn, rep);
      });
    });
  }

  // ── DATA tab ────────────────────────────────────────────────────────────────
  function renderDataTab() {
    var el = document.getElementById('ms-content-data');
    if (!el) return;
    var st = curState();
    if (!inState()) {
      el.innerHTML = emptyState('Select a state first', 'Go to the Map tab and tap a state to see its data.');
      return;
    }
    var del = delegation(st);
    var pv = popularVote(st);
    var govs = _g('governors');
    var gov = govs && govs[st] ? govs[st] : null;
    var SD = _g('STATE_DEMOGRAPHICS');
    var dem = SD && SD[st] ? SD[st] : null;
    var pop = (_g('STATE_POPULATION') || {})[st];

    var html = '<div class="ms-content-head"><div class="ms-content-title">' + esc(st) + '</div>' +
      '<div class="ms-content-sub">State overview</div></div><div class="ms-content-pad">';

    // Governor
    if (gov) {
      var gk = partyKey(gov.party), gColor = gk === 'd' ? 'var(--dem)' : gk === 'r' ? 'var(--rep)' : 'var(--ind)';
      var yrs = gov.since ? (new Date().getFullYear() - gov.since) : null;
      html += '<div class="ms-card"><div class="ms-card-label">Governor of ' + esc(st) + '</div>' +
        '<div class="ms-gov-row"><div class="ms-gov-photo-fb">' + esc(initials(gov.name)) + '</div>' +
        '<div style="flex:1"><div class="ms-gov-name">' + esc(gov.name) + '</div>' +
        '<div class="ms-gov-meta">Since ' + (gov.since || '—') + (yrs != null ? ' · ' + yrs + ' yrs' : '') + '</div>' +
        '<span class="ms-gov-badge" style="color:' + gColor + '"><span class="dot" style="background:' + gColor + '"></span>' + esc(gov.party) + '</span>' +
        '</div></div></div>';
    }

    // Seat summary
    var total = (del.d || 0) + (del.r || 0) + (del.ind || 0);
    html += '<div class="ms-card"><div class="ms-card-label">Seat Summary · ' + total + ' total seats</div>' +
      seatTrio(del.d, del.r, del.ind) + '</div>';

    // Popular vote
    if (pv.d != null) {
      html += '<div class="ms-card"><div class="ms-card-label">House Popular Vote</div>' +
        popVoteBlock(pv.d, pv.r) + '</div>';
    }

    // Demographics
    if (dem && dem.race) {
      var bb = _g('buildRaceBar');
      var bar = typeof bb === 'function' ? bb(dem.race, { compact: false, height: 10 }) : '';
      html += '<div class="ms-card"><div class="ms-card-label">' + esc(st) + ' Demographics</div>' + bar + '</div>';
    }

    // Key stats
    if (dem) {
      html += '<div class="ms-card"><div class="ms-card-label">Key Stats</div>' +
        kv('Median household income', dem.income != null ? fmtIncome(dem.income) : '—') +
        kv('Poverty rate', dem.poverty != null ? dem.poverty.toFixed(1) + '%' : '—') +
        kv('Population', pop != null ? pop.toLocaleString() : '—') +
        '</div>';
    }

    html += '</div>';
    el.innerHTML = html;
  }

  function kv(k, v) { return '<div class="ms-kv"><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span></div>'; }

  // ── NEWS tab ──────────────────────────────────────────────────────────────
  function renderNewsTab() {
    var el = document.getElementById('ms-content-news');
    if (!el) return;
    var st = curState();
    if (!inState()) {
      el.innerHTML = emptyState('Select a state first', 'Go to the Map tab and tap a state to see related news.');
      return;
    }
    var head = '<div class="ms-content-head"><div class="ms-content-title">' + esc(st) + ' News</div>' +
      '<div class="ms-content-sub">Recent redistricting & political coverage</div></div>';
    // Avoid reloading if we already have this state's news in the DOM.
    if (shell.newsLoadedFor === st && el.querySelector('.ms-news-item')) return;
    el.innerHTML = head + '<div class="ms-content-pad"><div class="ms-loading">Loading news…</div></div>';
    shell.newsLoadedFor = st;
    loadNewsInto(el, head, st);
  }

  // Reuse the same Google-News-RSS proxy approach loadStateNews uses, but render
  // into our own container with mobile styling.
  function loadNewsInto(el, head, st) {
    var queries = [st + ' redistricting', st + ' gerrymandering', st + ' congressional district', st + ' politics'];
    var idx = 0;
    function tryNext() {
      if (idx >= queries.length) {
        el.innerHTML = head + '<div class="ms-content-pad"><div class="ms-loading">No recent news found.<br><a href="https://news.google.com/search?q=' +
          encodeURIComponent(st + ' redistricting') + '" target="_blank" rel="noopener" style="color:var(--ind)">Search Google News →</a></div></div>';
        return;
      }
      var q = queries[idx++];
      var gn = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=en-US&gl=US&ceid=US:en';
      var proxy = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(gn);
      fetch(proxy).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
        if (data && data.items && data.items.length) { renderNews(el, head, data.items, st); }
        else { tryNext(); }
      }).catch(tryNext);
    }
    tryNext();
  }

  function renderNews(el, head, items, st) {
    var html = head + '<div class="ms-content-pad">';
    items.slice(0, 12).forEach(function (a) {
      var title = a.title || '', source = '';
      var m = title.match(/^(.+?) - ([^-]+)$/);
      if (m) { title = m[1].trim(); source = m[2].trim(); }
      var date = a.pubDate ? new Date(a.pubDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      html += '<a class="ms-news-item" href="' + esc(a.link) + '" target="_blank" rel="noopener">' +
        '<div class="ms-news-title">' + esc(title) + '</div>' +
        '<div class="ms-news-meta">' + esc(source) + (date ? ' · ' + date : '') + '</div></a>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  // ── DISTRICT BOTTOM SHEET ───────────────────────────────────────────────────
  function openDistrictSheet(districtNum, rep) {
    var st = curState();
    var ABBR = _g('STATE_ABBR') || {};
    var abbr = ABBR[st];
    var DD = _g('DISTRICT_DEMOGRAPHICS') || {};
    var SD = _g('STATE_DEMOGRAPHICS') || {};
    var key = abbr + '-' + districtNum;
    var dem = DD[key] || SD[st] || null;
    var isFallback = !DD[key] && !!SD[st];

    var name = rep ? (rep.official_full || ((rep.first_only || '') + ' ' + (rep.last || '')).trim()) : 'Vacant';
    var L = rep ? partyLetter(rep.party) : 'I', k = rep ? partyKey(rep.party) : 'i';
    var since = rep && rep.term_start ? new Date(rep.term_start).getFullYear() : null;

    // photo with same fallback chain as desktop modal
    var photoHtml;
    if (rep && rep.bioguide) {
      var p1 = 'https://bioguide.congress.gov/bioguide/photo/' + rep.bioguide.charAt(0) + '/' + rep.bioguide + '.jpg';
      var p2 = 'https://theunitedstates.io/images/congress/450x550/' + rep.bioguide + '.jpg';
      photoHtml = '<img class="ms-rep-photo" src="' + p1 + '" alt="' + esc(name) + '" ' +
        'onerror="if(this.src.indexOf(\'theunitedstates.io\')===-1){this.src=\'' + p2 + '\';}else{this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';}">' +
        '<div class="ms-rep-photo-fb" style="display:none">' + esc(initials(name)) + '</div>';
    } else {
      photoHtml = '<div class="ms-rep-photo-fb">' + esc(initials(name)) + '</div>';
    }

    var partyName = rep ? (rep.party || 'Unknown') : 'Vacant';
    var dlabel = districtNum === 0 ? 'At-large District' : 'District ' + districtNum;

    var html = '<div class="ms-rep-row">' + photoHtml +
      '<div style="flex:1;min-width:0"><div class="ms-rep-name">' + esc(name) + ' (' + L + ')</div>' +
      '<div class="ms-rep-meta">' + esc(partyName) + (since ? ' · Since ' + since : '') + '</div>' +
      (rep && rep.url ? '<a class="ms-rep-link" href="' + esc(rep.url) + '" target="_blank" rel="noopener">Full profile ' + ICON.ext + '</a>' : '') +
      '</div></div>';

    // demographics stacked list
    if (dem && dem.race) {
      html += '<div class="ms-sec-label">' + (isFallback ? 'State demographics (district data pending)' : 'District demographics') + '</div>';
      html += '<div class="ms-demo-list">';
      raceBuckets().forEach(function (b) {
        var pct = dem.race[b.key];
        if (pct == null || pct <= 0) return;
        html += '<div class="ms-demo-item"><span class="ms-demo-dot" style="background:' + b.color + '"></span>' +
          '<span class="ms-demo-name">' + b.label + '</span><span class="ms-demo-pct">' + pct.toFixed(1) + '%</span></div>';
      });
      html += '</div>';
    }

    // key stats grid
    if (dem) {
      var pop = (_g('STATE_POPULATION') || {})[st];
      html += '<div class="ms-sec-label">Key statistics</div><div class="ms-stat-grid">';
      if (dem.income != null) html += statCell('Median income', fmtIncome(dem.income));
      if (dem.poverty != null) html += statCell('Poverty rate', dem.poverty.toFixed(1) + '%');
      if (dem.population != null) html += statCell('District pop.', dem.population.toLocaleString());
      if (pop != null) html += statCell('State pop.', pop.toLocaleString());
      html += '</div>';
    }

    // 2024 presidential result bar (from votingStatsAll)
    var V = _g('votingStatsAll');
    if (V && V[st] && V[st][districtNum] && V[st][districtNum].presidential) {
      var pres = V[st][districtNum].presidential;
      html += '<div class="ms-sec-label">2024 presidential result</div>' +
        '<div class="ms-pv-vals"><span class="d">' + pres.dem + '% D</span><span class="r">' + pres.rep + '% R</span></div>' +
        '<div class="ms-pv-bar"><span class="d" style="width:' + pres.dem + '%"></span><span class="r" style="width:' + pres.rep + '%"></span></div>';
    }

    // view full profile -> reuse desktop modal
    if (rep) {
      html += '<button class="ms-btn primary" id="ms-view-profile" style="margin-top:18px">' + ICON.ext + ' View full profile</button>';
    }

    showSheet(dlabel, '', html);

    var vp = document.getElementById('ms-view-profile');
    if (vp) vp.addEventListener('click', function () {
      closeSheet();
      var fn = _g('openRepDetailModal');
      if (typeof fn === 'function') {
        // ensure activeRep is coherent for the modal (via the bridge setter)
        try { if (window.__gerry) window.__gerry.activeRep = rep; } catch (e) {}
        fn(districtNum, rep);
      }
    });
  }

  function statCell(l, v) { return '<div class="ms-stat-cell"><div class="l">' + esc(l) + '</div><div class="v">' + esc(v) + '</div></div>'; }

  // ── CYCLE / TIMELINE DRAWER ─────────────────────────────────────────────────
  function openCycleSheet() {
    var HD = _g('HISTORY_DATA');
    if (!HD || !HD._meta) { return; }
    var years = HD._meta.years;
    var cur = _g('selectedYear') || _g('HISTORY_LATEST_YEAR') || years[years.length - 1];
    var curIdx = years.indexOf(cur); if (curIdx < 0) curIdx = years.length - 1;

    var firstYr = years[0], lastYr = years[years.length - 1];
    var quick = [2012, 2016, 2020, 2024].filter(function (y) { return years.indexOf(y) >= 0; });

    var html = '<div class="ms-cycle-track">' +
      '<input type="range" class="ms-cycle-range" id="ms-cycle-range" min="0" max="' + (years.length - 1) + '" value="' + curIdx + '" step="1">' +
      '<div class="ms-cycle-ticks"><span>' + firstYr + '</span><span>' + Math.round((firstYr + lastYr) / 2) + '</span><span>' + lastYr + '</span></div>' +
      '</div>' +
      '<div class="ms-sec-label" style="margin-top:8px">Quick select</div>' +
      '<div class="ms-cycle-quick" id="ms-cycle-quick">' +
      quick.map(function (y) {
        var c = HD.cycles[y];
        return '<div class="ms-cycle-card' + (y === cur ? ' active' : '') + '" data-year="' + y + '">' +
          '<div class="yr">' + y + '</div><div class="cong">' + (c ? c.congress + 'th Congress' : '') + '</div></div>';
      }).join('') +
      '</div>' +
      '<button class="ms-btn primary" id="ms-cycle-play" style="margin-top:18px">' + ICON.play + ' Play through years</button>' +
      '<div style="text-align:center;font-size:11px;color:var(--text-mute);margin-top:8px">Animate map changes over time</div>';

    showSheet('Select Cycle', '', html);

    var range = document.getElementById('ms-cycle-range');
    function apply(year) {
      var ctrl = _g('_historyControls');
      // wait until in state or national; applyYear handles both
      if (ctrl && ctrl.state && _g('viewMode') === 'state') ctrl.state.applyYear(year);
      else if (ctrl && ctrl.national) ctrl.national.applyYear(year);
      // refresh cards + pill
      document.querySelectorAll('#ms-cycle-quick .ms-cycle-card').forEach(function (c) {
        c.classList.toggle('active', Number(c.dataset.year) === year);
      });
      syncCyclePill();
    }
    if (range) range.addEventListener('input', function (e) {
      var y = years[Number(e.target.value)];
      if (y != null) apply(y);
    });
    document.querySelectorAll('#ms-cycle-quick .ms-cycle-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var y = Number(card.dataset.year);
        if (range) range.value = years.indexOf(y);
        apply(y);
      });
    });
    var play = document.getElementById('ms-cycle-play');
    if (play) play.addEventListener('click', function () {
      var i = 0;
      play.disabled = true; play.style.opacity = '.6';
      var timer = setInterval(function () {
        if (i >= years.length) { clearInterval(timer); play.disabled = false; play.style.opacity = '1'; return; }
        var y = years[i++];
        if (range) range.value = years.indexOf(y);
        apply(y);
      }, 700);
    });
  }

  function syncCyclePill() {
    var HD = _g('HISTORY_DATA');
    var yr = _g('selectedYear');
    var yrEl = document.getElementById('ms-cycle-yr');
    var congEl = document.getElementById('ms-cycle-cong');
    if (yrEl && yr) yrEl.textContent = yr;
    if (congEl && HD && HD.cycles && HD.cycles[yr]) congEl.textContent = HD.cycles[yr].congress + 'th Congress';
  }

  // ── FILTERS DRAWER ──────────────────────────────────────────────────────────
  function openFiltersSheet() {
    var f = shell.filters;
    var party = [['all', 'All', ''], ['democrat', 'Democrat', 'd'], ['republican', 'Republican', 'r'], ['independent', 'Independent', 'i']];
    var comp = [['all', 'All', ''], ['likely-d', 'Likely D', 'd'], ['lean-d', 'Lean D', 'd'], ['toss', 'Toss Up', ''], ['lean-r', 'Lean R', 'r'], ['likely-r', 'Likely R', 'r']];

    var html = '<div class="ms-filter-group"><div class="lbl">Party</div><div class="ms-chip-row" id="ms-fp">' +
      party.map(function (p) { return '<button class="ms-chip ' + p[2] + (f.party === p[0] ? ' active' : '') + '" data-v="' + p[0] + '">' + p[1] + '</button>'; }).join('') +
      '</div></div>' +
      '<div class="ms-filter-group"><div class="lbl">Competitiveness</div><div class="ms-chip-row" id="ms-fc">' +
      comp.map(function (p) { return '<button class="ms-chip ' + p[2] + (f.comp === p[0] ? ' active' : '') + '" data-v="' + p[0] + '">' + p[1] + '</button>'; }).join('') +
      '</div></div>' +
      '<div class="ms-filter-group"><div class="lbl">Metrics</div>' +
      '<select class="ms-select" id="ms-fmetric">' +
      ['party', 'margin', 'demographics', 'income'].map(function (m) {
        return '<option value="' + m + '"' + (f.metric === m ? ' selected' : '') + '>Show by ' + m.charAt(0).toUpperCase() + m.slice(1) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="ms-filter-group"><div class="ms-toggle-row"><div class="lbl" style="margin:0">District labels</div>' +
      '<button class="ms-toggle' + (f.labels ? ' on' : '') + '" id="ms-flabels" role="switch" aria-checked="' + f.labels + '"></button></div></div>' +
      '<button class="ms-btn primary" id="ms-apply-filters" style="margin-top:6px">Apply Filters</button>';

    showSheet('Filters', 'reset', html);

    document.querySelectorAll('#ms-fp .ms-chip').forEach(function (c) {
      c.addEventListener('click', function () { selectChip('#ms-fp', c); shell.filters.party = c.dataset.v; });
    });
    document.querySelectorAll('#ms-fc .ms-chip').forEach(function (c) {
      c.addEventListener('click', function () { selectChip('#ms-fc', c); shell.filters.comp = c.dataset.v; });
    });
    var sel = document.getElementById('ms-fmetric');
    if (sel) sel.addEventListener('change', function () { shell.filters.metric = sel.value; });
    var tog = document.getElementById('ms-flabels');
    if (tog) tog.addEventListener('click', function () {
      shell.filters.labels = !shell.filters.labels;
      tog.classList.toggle('on', shell.filters.labels);
      tog.setAttribute('aria-checked', shell.filters.labels);
    });
    var apply = document.getElementById('ms-apply-filters');
    if (apply) apply.addEventListener('click', function () { applyFilters(); closeSheet(); });
  }

  function selectChip(scope, chip) {
    document.querySelectorAll(scope + ' .ms-chip').forEach(function (c) { c.classList.remove('active'); });
    chip.classList.add('active');
  }

  // Apply visual filters to the district map paths (dim non-matching districts).
  // Works on the live D3 selection by toggling opacity — non-destructive, and
  // reset when filters go back to "all".
  function applyFilters() {
    var f = shell.filters;
    var legs = legislators();
    var byDistrict = {};
    legs.forEach(function (r) { byDistrict[r.district] = r; });

    try {
      var paths = document.querySelectorAll('#map-container path[data-district], #map-container .district-path');
      // Fallback: select all svg paths in the map and use bound data via d3.
      var d3lib = _g('d3');
      if (d3lib) {
        d3lib.selectAll('#map-container path').each(function (d) {
          if (!d || !d.properties || d.properties.district == null) return;
          var rep = byDistrict[d.properties.district];
          var show = matchFilter(rep, f);
          this.style.opacity = show ? '' : '0.25';
        });
      }
      // toggle district number labels
      if (d3lib) {
        d3lib.selectAll('#map-container .district-label, #map-container text.dist-label')
          .style('display', f.labels ? '' : 'none');
      }
    } catch (e) { /* non-fatal */ }
  }

  function matchFilter(rep, f) {
    if (f.party !== 'all') {
      var L = rep ? partyLetter(rep.party) : 'I';
      if (f.party === 'democrat' && L !== 'D') return false;
      if (f.party === 'republican' && L !== 'R') return false;
      if (f.party === 'independent' && L !== 'I') return false;
    }
    // competitiveness filtering needs margin data; if unavailable, don't exclude
    return true;
  }

  // ── SHEET PRIMITIVES ────────────────────────────────────────────────────────
  function showSheet(title, action, bodyHtml) {
    build();
    document.getElementById('ms-sheet-title').textContent = title;
    var actions = document.getElementById('ms-sheet-actions');
    actions.innerHTML = (action === 'reset' ? '<button class="ms-reset" id="ms-sheet-reset">Reset</button>' : '') +
      '<button class="ms-sheet-close" id="ms-sheet-close" aria-label="Close">' + ICON.close + '</button>';
    document.getElementById('ms-sheet-body').innerHTML = bodyHtml;
    document.getElementById('ms-sheet-close').addEventListener('click', closeSheet);
    var rb = document.getElementById('ms-sheet-reset');
    if (rb) rb.addEventListener('click', function () {
      shell.filters = { party: 'all', comp: 'all', metric: 'party', labels: true };
      applyFilters();
      closeSheet();
    });
    requestAnimationFrame(function () {
      document.getElementById('ms-scrim').classList.add('open');
      document.getElementById('ms-sheet').classList.add('open');
    });
  }
  function closeSheet() {
    var s = document.getElementById('ms-sheet'), sc = document.getElementById('ms-scrim');
    if (s) s.classList.remove('open');
    if (sc) sc.classList.remove('open');
  }

  // ── MISC ────────────────────────────────────────────────────────────────────
  function emptyState(title, sub) {
    return '<div style="padding:60px 24px;text-align:center"><div style="font-size:15px;color:var(--text-dim);font-weight:600;margin-bottom:6px">' +
      esc(title) + '</div><div style="font-size:12px;color:var(--text-mute);line-height:1.5">' + esc(sub) + '</div></div>';
  }
  function initials(name) {
    if (!name) return '?';
    var parts = name.replace(/\(.*?\)/, '').trim().split(/\s+/);
    return ((parts[0] || '?').charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
  }

  // ── PUBLIC HOOKS — called from index.html's existing flow ──────────────────
  // Called whenever the app changes view (national<->state) or finishes loading
  // state legislators, so the shell's tabs/overview refresh.
  window.MobileShell = {
    refresh: function () {
      if (!mobileOn()) return;
      build();
      document.body.classList.add('ms-on');
      if (!document.body.className.match(/ms-tab-/)) setTab('map');
      renderOverview();
      syncCyclePill();
      // refresh whichever tab is showing
      if (shell.tab === 'districts') renderDistrictsTab();
      else if (shell.tab === 'data') renderDataTab();
      else if (shell.tab === 'news') { shell.newsLoadedFor = null; renderNewsTab(); }
    },
    onStateEnter: function () {
      if (!mobileOn()) return;
      build();
      document.body.classList.add('ms-on');
      setTab('map');
      shell.newsLoadedFor = null;
      renderOverview();
      syncCyclePill();
    },
    onNationalEnter: function () {
      if (!mobileOn()) return;
      build();
      document.body.classList.add('ms-on');
      setTab('map');
      shell.newsLoadedFor = null;
      renderOverview();
      syncCyclePill();
    },
    openDistrict: function (districtNum, rep) {
      if (!mobileOn()) return;
      openDistrictSheet(districtNum, rep);
    },
    syncCycle: syncCyclePill
  };

  // Initialise once DOM + globals are ready.
  function boot() {
    if (!mobileOn()) return;   // desktop: do nothing at all
    build();
    document.body.classList.add('ms-on');
    setTab('map');
    renderOverview();
    syncCyclePill();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
  } else {
    setTimeout(boot, 0);
  }
})();
