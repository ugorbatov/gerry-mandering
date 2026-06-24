/* ============================================================================
   REDISTRICTING TRACKER — RENDER
   ----------------------------------------------------------------------------
   Reads REDISTRICTING + RT_TOTALS + RT_LAST_UPDATED from redistricting-data.js.
   Encodes TWO dimensions on the map at once:
     • fill COLOR  → who benefits / who tried   (red = R, blue = D, purple = court, gray = none)
     • fill STYLE  → status                      (solid = in effect, hatched = contested,
                                                   hollow = failed, dotted = considering)
   ============================================================================ */
(function () {
  'use strict';

  var COLOR = {
    R: '#EF4444', D: '#3B82F6', none: '#52525B', court: '#A855F7'
  };

  // Resolve the base color for a state from favors/status.
  function baseColor(d) {
    if (d.status === 'court') return COLOR.court;
    if (d.favors === 'R') return COLOR.R;
    if (d.favors === 'D') return COLOR.D;
    return COLOR.none;
  }

  // Status → human label + badge class + legend description.
  var STATUS_META = {
    enacted:     { label: 'NEW MAP IN EFFECT', badge: 'b-enacted',     dot: 'var(--green)' },
    contested:   { label: 'IN EFFECT · CONTESTED', badge: 'b-contested', dot: 'var(--amber)' },
    court:       { label: 'COURT-ORDERED',      badge: 'b-court',       dot: 'var(--ind)' },
    failed:      { label: 'ATTEMPT FAILED',     badge: 'b-failed',      dot: 'var(--text-mute)' },
    considering: { label: 'CONSIDERING',        badge: 'b-considering', dot: 'var(--dem)' }
  };

  var FAVOR_LABEL = { R: 'FAVORS GOP', D: 'FAVORS DEM', none: 'MIXED / UNCLEAR' };

  var legendFilter = null;   // when set, only this status is highlighted
  var selectedState = null;
  var svgSel = null;

  // ---- STATS ----
  function renderStats() {
    var states = Object.keys(REDISTRICTING).map(function (k) { return REDISTRICTING[k]; });
    var inEffect = states.filter(function (s) { return s.status === 'enacted' || s.status === 'contested' || s.status === 'court'; }).length;
    var failed = states.filter(function (s) { return s.status === 'failed'; }).length;
    var row = document.getElementById('stats-row');
    row.innerHTML =
      stat('New maps in effect', inEffect, 'var(--text)') +
      stat('Attempts blocked', failed, 'var(--text-dim)') +
      stat('GOP projected gain', '+' + RT_TOTALS.gopGain, 'var(--rep)') +
      stat('Dem projected gain', '+' + RT_TOTALS.demGain, 'var(--dem)') +
      stat('Last updated', RT_LAST_UPDATED, 'var(--text-dim)', true);
  }
  function stat(label, value, color, small) {
    return '<div class="stat"><div class="label">' + label + '</div>' +
      '<div class="value" style="color:' + color + (small ? ';font-size:13px;padding-top:5px' : '') + '">' + value + '</div></div>';
  }

  // ---- MAP ----
  function renderMap() {
    var host = d3.select('#rt-map');
    var W = 900, H = 560;
    var svg = host.append('svg').attr('viewBox', '0 0 ' + W + ' ' + H).attr('width', '100%');
    svgSel = svg;

    // Hatch pattern (for 'contested') + dot pattern (for 'considering'), one per color.
    var defs = svg.append('defs');
    ['R', 'D', 'none', 'court'].forEach(function (key) {
      var c = COLOR[key];
      var hatch = defs.append('pattern')
        .attr('id', 'hatch-' + key).attr('width', 7).attr('height', 7)
        .attr('patternTransform', 'rotate(45)').attr('patternUnits', 'userSpaceOnUse');
      hatch.append('rect').attr('width', 7).attr('height', 7).attr('fill', c).attr('opacity', 0.28);
      hatch.append('rect').attr('width', 3).attr('height', 7).attr('fill', c);
    });

    var proj = d3.geoAlbersUsa().scale(1100).translate([W / 2, H / 2]);
    var path = d3.geoPath(proj);

    d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json').then(function (us) {
      var feats = topojson.feature(us, us.objects.states).features;
      svg.selectAll('path').data(feats).join('path')
        .attr('d', path)
        .attr('stroke', '#0A0A0B').attr('stroke-width', 0.8)
        .attr('data-state', function (d) { return d.properties.name; })
        .each(function (d) { styleState(d3.select(this), d.properties.name); })
        .attr('cursor', function (d) { return REDISTRICTING[d.properties.name] ? 'pointer' : 'default'; })
        .on('click', function (event, d) {
          if (!REDISTRICTING[d.properties.name]) return;
          selectState(d.properties.name);
        });
    }).catch(function () {
      document.getElementById('rt-map').innerHTML =
        '<div style="padding:40px;text-align:center;color:var(--text-mute);font-size:12px">Couldn\'t load the map. Check your connection and refresh.</div>';
    });
  }

  // Apply fill + style for one state path based on its data and current filter.
  function styleState(sel, name) {
    var d = REDISTRICTING[name];
    if (!d) { sel.attr('fill', '#161618').attr('stroke', '#0A0A0B'); return; }
    var key = d.status === 'court' ? 'court' : (d.favors === 'R' ? 'R' : d.favors === 'D' ? 'D' : 'none');
    var c = COLOR[key];

    if (d.status === 'failed') {
      // hollow: dark fill, colored outline
      sel.attr('fill', '#161618').attr('stroke', c).attr('stroke-width', 1.3).attr('stroke-dasharray', null);
    } else if (d.status === 'considering') {
      // dotted outline, faint fill
      sel.attr('fill', hexA(c, 0.10)).attr('stroke', c).attr('stroke-width', 1.1).attr('stroke-dasharray', '2,2');
    } else if (d.status === 'contested') {
      // hatched fill
      sel.attr('fill', 'url(#hatch-' + key + ')').attr('stroke', c).attr('stroke-width', 0.8).attr('stroke-dasharray', null);
    } else {
      // enacted or court: solid
      sel.attr('fill', c).attr('stroke', '#0A0A0B').attr('stroke-width', 0.8).attr('stroke-dasharray', null);
    }
    // dim if a legend filter is active and this doesn't match
    var dim = legendFilter && d.status !== legendFilter;
    sel.classed('dimmed', !!dim);
    sel.classed('sel', name === selectedState);
  }

  function restyleAll() {
    if (!svgSel) return;
    svgSel.selectAll('path').each(function (d) {
      if (d && d.properties) styleState(d3.select(this), d.properties.name);
    });
  }

  // ---- LEGEND ----
  function renderLegend() {
    var statusItems = [
      ['enacted', 'In effect (solid)'],
      ['contested', 'In effect · contested (hatched)'],
      ['court', 'Court-ordered (purple)'],
      ['failed', 'Attempt failed (outline)'],
      ['considering', 'Considering (dotted)']
    ];
    var partyItems = [
      ['R', 'Favors / tried by GOP'],
      ['D', 'Favors / tried by Dems'],
      ['court', 'Court-ordered'],
      ['none', 'Mixed / unclear']
    ];

    var html =
      '<div class="legend-col"><div class="legend-h">Who it helps</div>' +
      partyItems.map(function (p) {
        return '<div class="legend-item" style="cursor:default">' +
          '<span class="legend-sw" style="background:' + COLOR[p[0]] + '"></span>' + p[1] + '</div>';
      }).join('') + '</div>' +
      '<div class="legend-col"><div class="legend-h">Status — tap to filter</div>' +
      statusItems.map(function (s) {
        return '<div class="legend-item" data-status="' + s[0] + '">' +
          '<span class="legend-sw" style="' + swatchStyle(s[0]) + '"></span>' + s[1] + '</div>';
      }).join('') + '</div>';

    var lg = document.getElementById('legend');
    lg.innerHTML = html;
    lg.querySelectorAll('.legend-item[data-status]').forEach(function (el) {
      el.addEventListener('click', function () {
        var st = el.dataset.status;
        legendFilter = (legendFilter === st) ? null : st;
        lg.querySelectorAll('.legend-item[data-status]').forEach(function (x) {
          x.classList.toggle('off', legendFilter && x.dataset.status !== legendFilter);
        });
        restyleAll();
      });
    });
  }

  // Small legend swatch that mimics the map encoding.
  function swatchStyle(status) {
    if (status === 'enacted') return 'background:#52525B';
    if (status === 'court') return 'background:' + COLOR.court;
    if (status === 'contested') return 'background:repeating-linear-gradient(45deg,#52525B,#52525B 2px,transparent 2px,transparent 5px);background-color:rgba(82,82,91,.25)';
    if (status === 'failed') return 'background:#161618;border:1px solid #71717A';
    if (status === 'considering') return 'background:rgba(82,82,91,.15);border:1px dotted #A1A1AA';
    return 'background:#52525B';
  }

  // ---- DETAIL PANEL ----
  function selectState(name) {
    selectedState = name;
    restyleAll();
    var d = REDISTRICTING[name];
    var sm = STATUS_META[d.status];
    var favClass = 'fav-' + (d.favors === 'R' ? 'R' : d.favors === 'D' ? 'D' : 'none');

    var seatBlock = '';
    if (d.seats != null) {
      var col = d.favors === 'R' ? 'var(--rep)' : d.favors === 'D' ? 'var(--dem)' : 'var(--text)';
      var verb = d.status === 'failed' ? 'would have added' : 'projected';
      seatBlock =
        '<div class="d-seat"><div><div class="big" style="color:' + col + '">+' + d.seats + '</div>' +
        '<div class="cap">' + verb + ' ' + (d.favors === 'R' ? 'GOP' : d.favors === 'D' ? 'Dem' : '') + ' seats</div></div></div>';
    }

    var tl = (d.timeline || []).map(function (t) {
      return '<div class="d-tli"><span class="dt">' + esc(t.date) + '</span><span>' + esc(t.text) + '</span></div>';
    }).join('');

    var src = (d.sources || []).map(function (s) {
      return '<a class="d-src" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + ' ↗</a>';
    }).join('');

    document.getElementById('detail-empty').style.display = 'none';
    var body = document.getElementById('detail-body');
    body.style.display = 'block';
    body.innerHTML =
      '<div class="d-state">' + esc(name) + '</div>' +
      '<div class="d-statusrow">' +
        '<span class="d-badge ' + sm.badge + '"><span class="bdot" style="background:' + sm.dot + '"></span>' + sm.label + '</span>' +
        '<span class="d-favors ' + favClass + '">' + FAVOR_LABEL[d.favors === 'R' ? 'R' : d.favors === 'D' ? 'D' : 'none'] + '</span>' +
        (d.voluntary === false ? '<span class="d-favors fav-none">REQUIRED</span>' : '') +
      '</div>' +
      seatBlock +
      '<div class="d-sec">What happened</div><div class="d-summary">' + esc(d.summary) + '</div>' +
      (tl ? '<div class="d-sec">Timeline</div><div class="d-timeline">' + tl + '</div>' : '') +
      (src ? '<div class="d-sec">Sources</div><div class="d-sources">' + src + '</div>' : '');
  }

  // ---- DISCLAIMER ----
  function renderDisclaimer() {
    document.getElementById('disclaimer').innerHTML =
      '<strong style="color:var(--text-dim)">A note on accuracy.</strong> ' +
      'This is a fast-moving, heavily litigated situation, and sources genuinely disagree at the margins — ' +
      'especially on whether court-ordered states (Utah, Louisiana, Tennessee) belong in the same bucket as the voluntary partisan redraws, and on exact seat counts. ' +
      esc(RT_TOTALS.note) + ' Last updated ' + esc(RT_LAST_UPDATED) + '. Always check the linked sources before relying on a figure.';
  }

  // ---- HELPERS ----
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // ---- NAV DROPDOWN (same behavior as other pages) ----
  window.toggleNavDropdown = function () {
    var menu = document.getElementById('nav-tools-menu');
    var btn = document.getElementById('nav-tools-btn');
    var open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
  };
  document.addEventListener('click', function (e) {
    var dd = document.getElementById('nav-tools-dropdown');
    if (dd && !dd.contains(e.target)) {
      document.getElementById('nav-tools-menu').classList.remove('open');
      document.getElementById('nav-tools-btn').setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var m = document.getElementById('nav-tools-menu');
      if (m) m.classList.remove('open');
    }
  });

  // ---- UPDATED BADGE (near headline) ----
  function renderUpdatedBadge() {
    var el = document.getElementById('updated-text');
    var line = document.getElementById('updated-line');
    if (!el || !line) return;
    el.textContent = 'Updated ' + RT_LAST_UPDATED;
    line.hidden = false;
  }

  // ---- INIT ----
  renderUpdatedBadge();
  renderStats();
  renderLegend();
  renderMap();
  renderDisclaimer();
})();
