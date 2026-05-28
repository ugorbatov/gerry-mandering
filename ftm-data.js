/* ─────────────────────────────────────────────────────────────────
   Gerrymandering Revealed · Follow the Money
   Shared donor data — single source of truth for the donor-origin
   map and per-case Sankey diagrams.

   FIELDS:
     donor:     display name
     homeState: 2-letter US state code (donor's residence/HQ)
     party:     'D' | 'R'  (which side this donor backs in the case)
     amount:    USD, numeric
     channel:   how the money flowed
                 'direct'    = directly to candidate or grantee
                 'party'     = to state party, which routes to candidate
                 'pac'       = to a PAC or 501(c) which spent on ads
                 'aggregate' = bucket label for many small donors
     recipient: who actually got it (candidate/group)
     note:      short footnote rendered in the Sankey tooltip
   ───────────────────────────────────────────────────────────────── */

window.FTM_DATA = {

  // ─── NEW JERSEY · 2021 commission redistricting ───────────────
  nj: {
    title: 'New Jersey · 2021 redistricting cycle',
    hook: 'Who funded the tiebreaker\'s advisors?',
    sankeyTitle: 'Donor → Princeton Gerrymandering Project funders → NJ Democratic incumbents',
    // recipients on the right side of the Sankey
    recipients: [
      { id: 'kim',     label: 'Andy Kim (NJ-3)',         party: 'D' },
      { id: 'gott',    label: 'Josh Gottheimer (NJ-5)',  party: 'D' },
      { id: 'malin',   label: 'Tom Malinowski (NJ-7)',   party: 'D' },
      { id: 'sherril', label: 'Mikie Sherrill (NJ-11)',  party: 'D' },
      { id: 'njdems',  label: 'NJ Dem State Cmte',       party: 'D' },
    ],
    // donor → recipient flows. Channel is the middle node in the Sankey.
    flows: [
      // Simons — only NJ-incumbent-specific flows in the Sankey.
      // Their $2.5M to House Maj PAC + $255K to DCCC is documented in tables
      // but excluded here so the diagram stays legible.
      { donor: 'James & Marilyn Simons', homeState: 'NY', party: 'D', channel: 'direct',
        recipient: 'kim',     amount:    5600 },
      { donor: 'James & Marilyn Simons', homeState: 'NY', party: 'D', channel: 'direct',
        recipient: 'gott',    amount:    5600 },
      { donor: 'James & Marilyn Simons', homeState: 'NY', party: 'D', channel: 'direct',
        recipient: 'malin',   amount:    5600 },
      { donor: 'James & Marilyn Simons', homeState: 'NY', party: 'D', channel: 'direct',
        recipient: 'sherril', amount:    5600 },

      // Schmidt
      { donor: 'Eric & Wendy Schmidt',   homeState: 'CA', party: 'D', channel: 'direct',
        recipient: 'malin',   amount:   13700 },
      { donor: 'Eric & Wendy Schmidt',   homeState: 'CA', party: 'D', channel: 'direct',
        recipient: 'kim',     amount:    8200 },
      { donor: 'Eric & Wendy Schmidt',   homeState: 'CA', party: 'D', channel: 'direct',
        recipient: 'sherril', amount:    5400 },
      { donor: 'Eric & Wendy Schmidt',   homeState: 'CA', party: 'D', channel: 'party',
        recipient: 'njdems',  amount:    5600 },

      // Johnston
      { donor: 'Bob & Lynn Johnston',    homeState: 'NJ', party: 'D', channel: 'direct',
        recipient: 'kim',     amount:    2000 },
      { donor: 'Bob & Lynn Johnston',    homeState: 'NJ', party: 'D', channel: 'direct',
        recipient: 'malin',   amount:    3000, note: 'Estimated; multiple itemized donations' },

      // Princeton employees aggregate
      { donor: 'Princeton employees',    homeState: 'NJ', party: 'D', channel: 'aggregate',
        recipient: 'kim',     amount:  163657, note: '~25% of the $654,627 aggregate, split evenly' },
      { donor: 'Princeton employees',    homeState: 'NJ', party: 'D', channel: 'aggregate',
        recipient: 'gott',    amount:  163657 },
      { donor: 'Princeton employees',    homeState: 'NJ', party: 'D', channel: 'aggregate',
        recipient: 'malin',   amount:  163657 },
      { donor: 'Princeton employees',    homeState: 'NJ', party: 'D', channel: 'aggregate',
        recipient: 'sherril', amount:  163656 },
    ],
  },

  // ─── WISCONSIN · 2023 + 2025 Supreme Court races ──────────────
  wi: {
    title: 'Wisconsin · 2023 & 2025 Supreme Court races',
    hook: 'Buy the court that rules on the maps.',
    sankeyTitle: 'Top donors → WI state-party loophole → Supreme Court candidates',
    recipients: [
      { id: 'prot23',  label: 'Protasiewicz (2023)',  party: 'D' },
      { id: 'craw25',  label: 'Crawford (2025)',      party: 'D' },
      { id: 'kelly23', label: 'Kelly (2023)',         party: 'R' },
      { id: 'schi25',  label: 'Schimel (2025)',       party: 'R' },
    ],
    flows: [
      // 2023 — Democratic side (Protasiewicz)
      { donor: 'Reid Hoffman',           homeState: 'CA', party: 'D', channel: 'party',
        recipient: 'prot23',  amount: 2000000, note: 'To WisDems Jan 2023' },
      { donor: 'George Soros',           homeState: 'NY', party: 'D', channel: 'party',
        recipient: 'prot23',  amount: 1000000, note: 'To WisDems Feb 22, 2023' },
      { donor: 'J.B. Pritzker',          homeState: 'IL', party: 'D', channel: 'party',
        recipient: 'prot23',  amount: 1000000, note: 'To WisDems Mar 14, 2023' },
      { donor: 'J.B. Pritzker',          homeState: 'IL', party: 'D', channel: 'direct',
        recipient: 'prot23',  amount:   20000, note: 'Hit the $20K direct cap' },
      { donor: 'Schusterman family',     homeState: 'OK', party: 'D', channel: 'party',
        recipient: 'prot23',  amount: 1000000, note: '4 donations to WisDems, March 2023' },
      { donor: 'Steven Spielberg',       homeState: 'CA', party: 'D', channel: 'party',
        recipient: 'prot23',  amount:  125000 },

      // 2023 — Republican side (Kelly)
      // Kelly-side spending was overwhelmingly via independent-expenditure
      // groups whose donor disclosures are incomplete; we include only what's
      // documented in primary sources.
      { donor: 'Diane Hendricks',        homeState: 'WI', party: 'R', channel: 'party',
        recipient: 'kelly23', amount:  500000, note: 'To WisGOP & associated cmtes' },

      // 2025 — Democratic side (Crawford)
      { donor: 'George Soros',           homeState: 'NY', party: 'D', channel: 'party',
        recipient: 'craw25',  amount: 2000000, note: 'To WisDems 2025' },
      { donor: 'J.B. Pritzker',          homeState: 'IL', party: 'D', channel: 'party',
        recipient: 'craw25',  amount: 1500000, note: 'To WisDems 2025' },

      // 2025 — Republican side (Schimel)
      { donor: 'Elon Musk',              homeState: 'TX', party: 'R', channel: 'direct',
        recipient: 'schi25',  amount: 3000000, note: 'Personal direct contribution' },
      { donor: 'Elon Musk',              homeState: 'TX', party: 'R', channel: 'pac',
        recipient: 'schi25',  amount:19000000, note: 'Via America PAC & affiliated groups' },
      { donor: 'Liz Uihlein',            homeState: 'IL', party: 'R', channel: 'party',
        recipient: 'schi25',  amount:  975000, note: 'To WisGOP 2025' },
      { donor: 'Diane Hendricks',        homeState: 'WI', party: 'R', channel: 'party',
        recipient: 'schi25',  amount:  850000, note: 'To WisGOP 2025' },
    ],
  },
};

/* ─── State centroids for the donor-origin map ────────────────────
   Approximate centroid lat/lng per state, in the simple Albers-USA
   projection space used by usmap.js. These are pre-projected to a
   780×440 SVG viewBox so we don't need a projection library.
   ───────────────────────────────────────────────────────────────── */
window.FTM_STATE_CENTROIDS = {
  AL:[565,330], AK:[155,400], AZ:[230,310], AR:[470,320], CA:[80,260],
  CO:[300,250], CT:[710,180], DE:[700,235], FL:[645,395], GA:[605,330],
  HI:[260,420], ID:[210,150], IL:[505,225], IN:[540,225], IA:[465,205],
  KS:[410,255], KY:[555,265], LA:[480,365], ME:[735,130], MD:[680,225],
  MA:[720,165], MI:[555,180], MN:[450,150], MS:[510,340], MO:[470,255],
  MT:[265,130], NE:[400,210], NV:[160,225], NH:[720,150], NJ:[695,210],
  NM:[300,310], NY:[680,170], NC:[645,275], ND:[395,135], OH:[585,220],
  OK:[420,300], OR:[120,150], PA:[650,205], RI:[725,175], SC:[625,305],
  SD:[400,170], TN:[555,290], TX:[400,370], UT:[225,235], VT:[700,150],
  VA:[645,250], WA:[140,100], WV:[615,235], WI:[490,170], WY:[295,180],
};
