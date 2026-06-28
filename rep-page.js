/**
 * rep-page.js — runtime data loader for individual rep pages
 * ===========================================================
 * Loaded only on /state/<state>/district-<n>/<rep-slug> pages.
 *
 * Reads rep identifiers from <meta> tags (set by build-rep-pages.py):
 *   rep-bioguide   — e.g. "C001068"   (Steve Cohen)
 *   rep-name       — e.g. "Steve Cohen"
 *   rep-state-abbr — e.g. "TN"
 *   rep-district   — e.g. "9"
 *
 * Then calls three API endpoints (the same ones the home-page modal uses):
 *   /api/rep-profile?repId=<bioguide>     → sponsored bills
 *   /api/rep-news?repName=<name>&state=<abbr>  → recent news
 *   /api/rep-finance?name=<name>&state=<abbr>&district=<n>&cycle=2024
 *                                          → totals, top donors, top PACs
 *
 * Each section is initially hidden via inline style="display:none". The
 * loaders only un-hide on success — so on failure the pages stay clean
 * rather than showing empty boxes.
 *
 * Render logic deliberately mirrors the modal in index.html (same class
 * names, same field shapes). If the modal's render ever changes, mirror
 * the changes here too.
 */
(function () {
  'use strict';

  // Read meta config
  function meta(name) {
    var el = document.querySelector('meta[name="' + name + '"]');
    return el ? el.getAttribute('content') : '';
  }
  var bioguide = meta('rep-bioguide');
  var repName  = meta('rep-name');
  var stateAbbr = meta('rep-state-abbr');
  var district = meta('rep-district');

  if (!bioguide && !repName) {
    // Page isn't a rep page, or meta tags weren't injected — bail.
    return;
  }

  // Strip Jr./Sr./II/III suffixes for cleaner news/finance lookups
  var searchName = (repName || '').replace(/\s+(Jr\.?|Sr\.?|III|II)$/i, '').trim();

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── BILLS ────────────────────────────────────────────────────────────
  function loadBills() {
    if (!bioguide) return;
    var section = document.getElementById('rep-bills');
    if (!section) return;

    fetch('/api/rep-profile?repId=' + encodeURIComponent(bioguide))
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        var bills = (data && data.sponsoredBills) || [];
        if (!bills.length) return;  // keep section hidden

        var html = '<h2>Recent sponsored bills</h2><div class="dyn-list">';
        bills.slice(0, 5).forEach(function (b) {
          var billNum = '';
          if (b.number) {
            billNum = b.number.type
              ? (b.number.type + ' ' + b.number.number)
              : String(b.number);
          }
          var meta = escapeHtml(billNum);
          if (b.introducedDate) meta += ' · Introduced ' + escapeHtml(b.introducedDate);
          html += '<div class="dyn-item">' +
            '<div class="dyn-item-title">' + escapeHtml(b.title || 'Untitled bill') + '</div>' +
            '<div class="dyn-item-meta">' + meta + '</div>' +
            (b.latestAction
              ? '<div class="dyn-item-meta" style="margin-top:4px;">Latest: ' + escapeHtml(b.latestAction) + '</div>'
              : '') +
            '</div>';
        });
        html += '</div>';
        section.innerHTML = html;
        section.style.display = 'block';
      })
      .catch(function () { /* silently leave hidden */ });
  }

  // ── NEWS ─────────────────────────────────────────────────────────────
  function loadNews() {
    if (!searchName) return;
    var section = document.getElementById('rep-news');
    if (!section) return;

    var url = '/api/rep-news?repName=' + encodeURIComponent(searchName);
    if (stateAbbr) url += '&state=' + encodeURIComponent(stateAbbr);

    fetch(url)
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        var articles = (data && data.articles) || [];
        if (!articles.length) return;

        var html = '<h2>Recent news</h2><div class="dyn-list">';
        articles.slice(0, 4).forEach(function (a) {
          var meta = escapeHtml(a.source || '');
          if (a.publishedAt) {
            try { meta += ' · ' + new Date(a.publishedAt).toLocaleDateString(); }
            catch (e) { /* ignore date parse errors */ }
          }
          html += '<a class="dyn-item" href="' + escapeHtml(a.url) + '" target="_blank" rel="noopener">' +
            '<div class="dyn-item-title">' + escapeHtml(a.title) + '</div>' +
            '<div class="dyn-item-meta">' + meta + '</div>' +
            '</a>';
        });
        html += '</div>';
        section.innerHTML = html;
        section.style.display = 'block';
      })
      .catch(function () { /* silently leave hidden */ });
  }

  // ── FINANCE (totals + top donors + top PACs) ─────────────────────────
  function loadFinance() {
    if (!searchName || !stateAbbr || !district) return;
    var section = document.getElementById('rep-finance');
    if (!section) return;

    var params = new URLSearchParams({
      name: searchName,
      state: stateAbbr,
      district: String(district),
      cycle: '2024'
    });
    fetch('/api/rep-finance?' + params.toString())
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        if (!data || data.error) return;

        var html = '<h2>Campaign finance (' + escapeHtml(data.cycle || '2024') + ' cycle)</h2>';
        var hasData = false;

        // Totals grid
        if (data.totals && data.totals.totalReceipts > 0) {
          html += '<div class="fin-grid">';
          html += '<div class="fin-stat"><div class="label">Total raised</div><div class="value">$' +
            data.totals.totalReceipts.toLocaleString() + '</div></div>';
          html += '<div class="fin-stat"><div class="label">Cash on hand</div><div class="value">$' +
            (data.totals.cashOnHand || 0).toLocaleString() + '</div></div>';
          if (data.totals.totalIndividual) {
            html += '<div class="fin-stat"><div class="label">From individuals</div><div class="value">$' +
              data.totals.totalIndividual.toLocaleString() + '</div></div>';
          }
          if (data.totals.totalPAC) {
            html += '<div class="fin-stat"><div class="label">From PACs</div><div class="value">$' +
              data.totals.totalPAC.toLocaleString() + '</div></div>';
          }
          html += '</div>';
          hasData = true;
        }

        // Donors + PACs side by side
        var hasDonors = data.topIndividuals && data.topIndividuals.length > 0;
        var hasPacs = data.topPACs && data.topPACs.length > 0;
        if (hasDonors || hasPacs) {
          html += '<div class="fin-detail-grid">';
          if (hasDonors) {
            html += '<div><h3>Top individual donors</h3><ol class="fin-list">';
            data.topIndividuals.slice(0, 5).forEach(function (donor) {
              var nm = donor.name || 'Anonymous';
              var employer = donor.employer ? ' · ' + donor.employer : '';
              var lookup = 'https://www.opensecrets.org/donor-lookup/results?name=' + encodeURIComponent(nm);
              html += '<li><span></span>' +
                '<a href="' + lookup + '" target="_blank" rel="noopener">' +
                '<span class="donor-name">' + escapeHtml(nm) + '</span>' +
                (employer ? '<span style="color:var(--text-mute);font-size:11px;">' + escapeHtml(employer) + '</span>' : '') +
                '</a>' +
                '<span class="donor-amt">$' + (donor.total || 0).toLocaleString() + '</span>' +
                '</li>';
            });
            html += '</ol></div>';
          }
          if (hasPacs) {
            html += '<div><h3>Top PACs</h3><ol class="fin-list">';
            data.topPACs.slice(0, 5).forEach(function (pac) {
              var nm = pac.name || 'Unknown PAC';
              var fecUrl = pac.id
                ? 'https://www.fec.gov/data/committee/' + pac.id + '/'
                : 'https://www.fec.gov/data/committees/?q=' + encodeURIComponent(nm);
              html += '<li><span></span>' +
                '<a href="' + fecUrl + '" target="_blank" rel="noopener">' +
                '<span class="donor-name">' + escapeHtml(nm) + '</span>' +
                '</a>' +
                '<span class="donor-amt">$' + (pac.total || 0).toLocaleString() + '</span>' +
                '</li>';
            });
            html += '</ol></div>';
          }
          html += '</div>';
          hasData = true;
        }

        if (!hasData) return;
        section.innerHTML = html;
        section.style.display = 'block';
      })
      .catch(function () { /* silently leave hidden */ });
  }

  // Fire all three loads in parallel
  loadBills();
  loadNews();
  loadFinance();
})();
