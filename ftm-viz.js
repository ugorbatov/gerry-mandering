/* ─────────────────────────────────────────────────────────────────
   Gerrymandering Revealed · Follow the Money
   Pure-vanilla SVG renderers — no D3, no external libs.

   PUBLIC API:
     FtmViz.renderSankey(containerId, caseKey)
     FtmViz.renderDonorMap(containerId, options)
   ───────────────────────────────────────────────────────────────── */

(function () {
  const $ = (id) => document.getElementById(id);

  /* ── Helpers ──────────────────────────────────────────────────── */

  function fmtMoney(n) {
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
    if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + n.toLocaleString();
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  /* ── SANKEY ────────────────────────────────────────────────────
     Three columns: donor → channel → recipient.
     Node height proportional to total flow through the node.
     Link width proportional to amount.
     ───────────────────────────────────────────────────────────── */

  function renderSankey(containerId, caseKey) {
    const container = $(containerId);
    if (!container) return;
    const data = window.FTM_DATA[caseKey];
    if (!data) { container.innerHTML = '<p style="color:var(--text-mute);font-size:11px">No data.</p>'; return; }

    // Aggregate
    // 1) Donor totals
    const donorTotals = {};
    const donorParty  = {};   // first observed party for the donor (D or R)
    const donorOrder  = [];   // preserve insertion order
    // 2) Channel totals
    const channelTotals = {};
    const channelOrder  = ['direct','party','pac','aggregate'];
    // 3) Recipient totals (already declared in data; just sum)
    const recipientTotals = {};
    const recipientLabel  = {};
    const recipientParty  = {};
    data.recipients.forEach((r) => {
      recipientTotals[r.id] = 0;
      recipientLabel[r.id]  = r.label;
      recipientParty[r.id]  = r.party;
    });
    // 4) Donor→channel and channel→recipient edge totals
    const dcEdge = {};   // key: donor + '|' + channel
    const crEdge = {};   // key: channel + '|' + recipient

    data.flows.forEach((f) => {
      if (!(f.donor in donorTotals)) { donorTotals[f.donor] = 0; donorParty[f.donor] = f.party; donorOrder.push(f.donor); }
      donorTotals[f.donor] += f.amount;
      channelTotals[f.channel] = (channelTotals[f.channel] || 0) + f.amount;
      recipientTotals[f.recipient] = (recipientTotals[f.recipient] || 0) + f.amount;

      const k1 = f.donor + '|' + f.channel;
      dcEdge[k1] = (dcEdge[k1] || 0) + f.amount;
      const k2 = f.channel + '|' + f.recipient;
      crEdge[k2] = (crEdge[k2] || 0) + f.amount;
    });

    const activeChannels = channelOrder.filter((c) => channelTotals[c] > 0);
    const totalFlow = Object.values(donorTotals).reduce((a, b) => a + b, 0);

    // Sort donors by total descending (clearer reading order top to bottom)
    donorOrder.sort((a, b) => donorTotals[b] - donorTotals[a]);

    // Layout
    const W = 760;
    const padTop = 16, padBot = 20;
    const nodeW = 14;
    const colLeft   = 200;             // x of donor column (rect's left edge) — wider gutter for long donor names
    const colMid    = (W - nodeW) / 2; // channel column
    const colRight  = W - 220 - nodeW; // recipient column — wider gutter for "Tom Malinowski (NJ-7)"

    // Compute total stack height shared across columns (we use the same flow on both halves so heights are equal)
    const H_max = 460;
    const nodePad = 8;
    // Donor column total stack
    const donorPad = donorOrder.length > 1 ? nodePad : 0;
    const donorStackPx = H_max - padTop - padBot - donorPad * (donorOrder.length - 1);
    const channelPad   = activeChannels.length > 1 ? nodePad : 0;
    const channelStackPx = H_max - padTop - padBot - channelPad * (activeChannels.length - 1);
    const recipientOrder = data.recipients.filter((r) => recipientTotals[r.id] > 0).map((r) => r.id);
    const recipientPad = recipientOrder.length > 1 ? nodePad : 0;
    const recipientStackPx = H_max - padTop - padBot - recipientPad * (recipientOrder.length - 1);

    // y/height per node (proportional to total flow through that node)
    function buildLayout(orderArr, totals, stackPx, padPx) {
      const out = {};
      let y = padTop;
      orderArr.forEach((k, i) => {
        const h = Math.max(2, (totals[k] / totalFlow) * stackPx);
        out[k] = { y, h };
        y += h + padPx;
      });
      return out;
    }
    const donorLayout     = buildLayout(donorOrder, donorTotals, donorStackPx, donorPad);
    const channelLayout   = buildLayout(activeChannels, channelTotals, channelStackPx, channelPad);
    const recipientLayout = buildLayout(recipientOrder, recipientTotals, recipientStackPx, recipientPad);

    // For each node, track how much of its rect we've already consumed (for stacking outgoing/incoming links)
    const donorConsumed     = {}; donorOrder.forEach((d) => donorConsumed[d] = 0);
    const channelInConsumed = {}; activeChannels.forEach((c) => channelInConsumed[c] = 0);
    const channelOutConsumed= {}; activeChannels.forEach((c) => channelOutConsumed[c] = 0);
    const recipientConsumed = {}; recipientOrder.forEach((r) => recipientConsumed[r] = 0);

    // Build SVG
    const svg = svgEl('svg', {
      viewBox: '0 0 ' + W + ' ' + H_max,
      class: 'sankey-svg',
      role: 'img',
      'aria-label': data.sankeyTitle,
    });

    // Links: render donor→channel first, then channel→recipient (so they layer cleanly)
    // For each flow, find its src and dst y-segments and draw a cubic bezier.
    function curvePath(x0, y0, h0, x1, y1, h1) {
      // Draw a band from (x0, y0) with height h0 to (x1, y1) with height h1
      const cpx = (x0 + x1) / 2;
      const top1 = `M ${x0} ${y0} C ${cpx} ${y0}, ${cpx} ${y1}, ${x1} ${y1}`;
      const bot1 = `L ${x1} ${y1 + h1} C ${cpx} ${y1 + h1}, ${cpx} ${y0 + h0}, ${x0} ${y0 + h0} Z`;
      return top1 + ' ' + bot1;
    }

    // donor → channel
    Object.keys(dcEdge).forEach((key) => {
      const [donor, channel] = key.split('|');
      const amt = dcEdge[key];
      const dL = donorLayout[donor];
      const cL = channelLayout[channel];
      const h0 = (amt / donorTotals[donor]) * dL.h;
      const h1 = (amt / channelTotals[channel]) * cL.h;
      const y0 = dL.y + donorConsumed[donor];
      const y1 = cL.y + channelInConsumed[channel];
      donorConsumed[donor]    += h0;
      channelInConsumed[channel] += h1;

      const party = donorParty[donor];
      const link = svgEl('path', {
        d: curvePath(colLeft + nodeW, y0, h0, colMid, y1, h1),
        class: 'sankey-link ' + (party === 'D' ? 'dem' : party === 'R' ? 'rep' : 'neutral'),
        'fill-opacity': 0.28,
      });
      const title = svgEl('title'); title.textContent = donor + ' → ' + channel + ': ' + fmtMoney(amt);
      link.appendChild(title);
      svg.appendChild(link);
    });

    // channel → recipient
    Object.keys(crEdge).forEach((key) => {
      const [channel, recipient] = key.split('|');
      const amt = crEdge[key];
      const cL = channelLayout[channel];
      const rL = recipientLayout[recipient];
      const h0 = (amt / channelTotals[channel]) * cL.h;
      const h1 = (amt / recipientTotals[recipient]) * rL.h;
      const y0 = cL.y + channelOutConsumed[channel];
      const y1 = rL.y + recipientConsumed[recipient];
      channelOutConsumed[channel] += h0;
      recipientConsumed[recipient] += h1;

      const party = recipientParty[recipient];
      const link = svgEl('path', {
        d: curvePath(colMid + nodeW, y0, h0, colRight, y1, h1),
        class: 'sankey-link ' + (party === 'D' ? 'dem' : 'rep'),
        'fill-opacity': 0.28,
      });
      const title = svgEl('title'); title.textContent = channel + ' → ' + recipientLabel[recipient] + ': ' + fmtMoney(amt);
      link.appendChild(title);
      svg.appendChild(link);
    });

    // Nodes — drawn on top of links
    donorOrder.forEach((d) => {
      const { y, h } = donorLayout[d];
      svg.appendChild(svgEl('rect', { x: colLeft, y, width: nodeW, height: h, class: 'sankey-node-rect donor' }));
      const text = svgEl('text', { x: colLeft - 6, y: y + h / 2 + 4, 'text-anchor': 'end', class: 'sankey-node-label' });
      text.textContent = d;
      svg.appendChild(text);
      const sub = svgEl('text', { x: colLeft - 6, y: y + h / 2 + 15, 'text-anchor': 'end', class: 'sankey-node-sub' });
      sub.textContent = fmtMoney(donorTotals[d]);
      svg.appendChild(sub);
    });

    activeChannels.forEach((c) => {
      const { y, h } = channelLayout[c];
      svg.appendChild(svgEl('rect', { x: colMid, y, width: nodeW, height: h, class: 'sankey-node-rect channel' }));
      // Label rotated 90° so each channel's label sits along the side of its own rect — no stacking
      const text = svgEl('text', { x: colMid + nodeW / 2, y: y + h / 2, 'text-anchor': 'middle', class: 'sankey-node-sub', transform: `rotate(-90 ${colMid + nodeW/2} ${y + h/2})` });
      text.textContent = c.toUpperCase();
      svg.appendChild(text);
    });

    recipientOrder.forEach((r) => {
      const { y, h } = recipientLayout[r];
      const party = recipientParty[r];
      svg.appendChild(svgEl('rect', {
        x: colRight, y, width: nodeW, height: h,
        class: 'sankey-node-rect recipient ' + (party === 'D' ? 'dem' : 'rep'),
      }));
      const text = svgEl('text', { x: colRight + nodeW + 6, y: y + h / 2 + 4, class: 'sankey-node-label' });
      text.textContent = recipientLabel[r];
      svg.appendChild(text);
      const sub = svgEl('text', { x: colRight + nodeW + 6, y: y + h / 2 + 15, class: 'sankey-node-sub' });
      sub.textContent = fmtMoney(recipientTotals[r]);
      svg.appendChild(sub);
    });

    container.innerHTML = '';
    container.appendChild(svg);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'sankey-legend';
    legend.innerHTML =
      '<span class="li"><span class="sq" style="background:var(--dem)"></span>D-aligned flow</span>' +
      '<span class="li"><span class="sq" style="background:var(--rep)"></span>R-aligned flow</span>' +
      '<span class="li"><span class="sq" style="background:var(--ind)"></span>Channel (party / PAC / direct / aggregate)</span>' +
      '<span class="li" style="margin-left:auto">Total flow: <strong style="color:var(--text)">' + fmtMoney(totalFlow) + '</strong></span>';
    container.appendChild(legend);
  }

  /* ── DONOR-ORIGIN MAP ──────────────────────────────────────────
     Pseudo-projected US states as labeled centroids on a simple
     720×440 viewBox. Bubbles sized by total $ from that state.
     Colored by majority party of the donations.
     ───────────────────────────────────────────────────────────── */

  function renderDonorMap(containerId, opts) {
    const container = $(containerId);
    if (!container) return;
    const cases = (opts && opts.cases) || ['nj','wi'];
    const targetStates = (opts && opts.targetStates) || cases.map((c) => c.toUpperCase());

    // Aggregate donor amounts by home state
    const byState = {};   // state -> {total, dem, rep, donors:[{name,amount,party}]}
    cases.forEach((caseKey) => {
      const data = window.FTM_DATA[caseKey];
      if (!data) return;
      data.flows.forEach((f) => {
        const s = f.homeState;
        if (!byState[s]) byState[s] = { total: 0, dem: 0, rep: 0, donors: {} };
        byState[s].total += f.amount;
        if (f.party === 'D') byState[s].dem += f.amount;
        else if (f.party === 'R') byState[s].rep += f.amount;
        const key = f.donor + '|' + f.party;
        byState[s].donors[key] = (byState[s].donors[key] || 0) + f.amount;
      });
    });

    const W = 720, H = 460;
    const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'usmap-svg', role: 'img', 'aria-label': 'Donor home states' });

    // 1) Draw background dots for every US state (so non-donor states are visible context)
    const centroids = window.FTM_STATE_CENTROIDS;
    Object.keys(centroids).forEach((s) => {
      const [x, y] = centroids[s];
      svg.appendChild(svgEl('circle', { cx: x, cy: y, r: 3.5, class: 'usmap-bg' }));
      const lbl = svgEl('text', { x, y: y + 14, class: 'usmap-state-label' });
      lbl.textContent = s;
      svg.appendChild(lbl);
    });

    // 2) Highlight target states (the ones being studied)
    targetStates.forEach((s) => {
      const c = centroids[s]; if (!c) return;
      svg.appendChild(svgEl('circle', { cx: c[0], cy: c[1], r: 14, class: 'usmap-target' }));
    });

    // 3) Draw donor bubbles, sized by total
    const allTotals = Object.values(byState).map((b) => b.total);
    const maxTotal  = Math.max.apply(null, allTotals);
    const minR = 6, maxR = 38;
    function bubbleR(total) {
      // sqrt scale so area is proportional to dollars
      const ratio = total / maxTotal;
      return minR + (maxR - minR) * Math.sqrt(ratio);
    }
    Object.keys(byState).forEach((s) => {
      const c = centroids[s]; if (!c) return;
      const b = byState[s];
      const r = bubbleR(b.total);
      const partyClass = b.dem > b.rep ? 'dem' : 'rep';
      const circle = svgEl('circle', { cx: c[0], cy: c[1], r, class: 'usmap-bubble ' + partyClass });
      // Build hover summary
      const donorList = Object.entries(b.donors)
        .sort((a, b2) => b2[1] - a[1])
        .map(([key, amt]) => {
          const [name, party] = key.split('|');
          return name + ' (' + party + '): ' + fmtMoney(amt);
        }).join('\n');
      const title = svgEl('title');
      title.textContent = s + ' · Total ' + fmtMoney(b.total) + '\n' + donorList;
      circle.appendChild(title);
      svg.appendChild(circle);
    });

    container.innerHTML = '';
    container.appendChild(svg);

    // Totals row
    const totals = document.createElement('div');
    totals.className = 'usmap-totals';
    const totalAll = Object.values(byState).reduce((a, b) => a + b.total, 0);
    const totalDem = Object.values(byState).reduce((a, b) => a + b.dem, 0);
    const totalRep = Object.values(byState).reduce((a, b) => a + b.rep, 0);
    const inState  = targetStates.reduce((acc, s) => acc + (byState[s] ? byState[s].total : 0), 0);
    const outOfState = totalAll - inState;

    totals.innerHTML =
      '<div class="usmap-stat"><div class="lbl">Total tracked</div><div class="val">' + fmtMoney(totalAll) + '</div><div class="sub">across ' + Object.keys(byState).length + ' donor states</div></div>' +
      '<div class="usmap-stat"><div class="lbl">From outside target states</div><div class="val">' + fmtMoney(outOfState) + '</div><div class="sub">' + Math.round((outOfState/totalAll)*100) + '% of total</div></div>' +
      '<div class="usmap-stat"><div class="lbl">D-aligned</div><div class="val" style="color:var(--dem)">' + fmtMoney(totalDem) + '</div></div>' +
      '<div class="usmap-stat"><div class="lbl">R-aligned</div><div class="val" style="color:var(--rep)">' + fmtMoney(totalRep) + '</div></div>';
    container.appendChild(totals);
  }

  /* ── Public API ────────────────────────────────────────────── */
  window.FtmViz = { renderSankey, renderDonorMap };

  // Re-render visuals when the user toggles theme. The Sankey and donor map
  // pick up CSS variables via classes (so they DO theme-switch automatically
  // through CSS), but the donor map's stats row (which uses computed CSS-var
  // colors inline) and a few hex fallbacks need a redraw to refresh. Cheap
  // safety net — only fires on theme attribute change.
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(() => {
      document.querySelectorAll('[data-ftm-sankey]').forEach((el) => {
        renderSankey(el.id, el.getAttribute('data-ftm-sankey'));
      });
      document.querySelectorAll('[data-ftm-donormap]').forEach((el) => {
        try { renderDonorMap(el.id, JSON.parse(el.getAttribute('data-ftm-donormap'))); } catch (e) {}
      });
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
})();
