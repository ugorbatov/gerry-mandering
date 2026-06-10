/* ============================================================================
   2025–26 MID-DECADE REDISTRICTING — CURATED DATASET
   ----------------------------------------------------------------------------
   This is a HAND-CURATED dataset. It is the single source of truth for the
   tracker page and is meant to be edited by hand as the situation changes.
   This is a fast-moving, partly-litigated topic — verify against the linked
   sources before relying on any figure.

   LAST UPDATED: 2026-06-09   (edit RT_LAST_UPDATED below when you revise)

   FIELD GUIDE
     status   : 'enacted'     new map in effect for 2026, not seriously contested
                'contested'   new map in effect BUT in active litigation / referendum
                'court'       map drawn/forced by court order (partisan effect varies)
                'failed'      a redraw was attempted but blocked, died, or struck down
                'considering' publicly exploring a redraw; nothing enacted
     favors   : 'R' | 'D' | 'none'   (for 'failed', this is who ATTEMPTED it)
     seats    : net seat change for the favored party (+N). null when n/a / unclear.
     voluntary: true = chosen mid-decade redraw; false = required by court/constitution
     summary  : plain-English, non-partisan description
     timeline : [{date, text}]
     sources  : [{label, url}]
   ============================================================================ */

const RT_LAST_UPDATED = 'June 9, 2026';

const REDISTRICTING = {

  /* ---- NEW MAPS IN EFFECT — Republican-favoring ---- */

  "Texas": {
    status: "contested", favors: "R", seats: 5, voluntary: true,
    summary: "The state that started the wave. At President Trump's urging, Texas Republicans redrew the map in summer 2025 to add about five GOP-leaning seats. A federal court in El Paso found it was an illegal racial gerrymander, but the U.S. Supreme Court overruled that 6-3 in April 2026, putting the map in place through at least 2030. Litigation continues.",
    timeline: [
      { date: "Aug 2025", text: "Legislature enacts the new map; Texas Democrats had fled the state to deny quorum but ultimately failed to stop it." },
      { date: "Nov 2025", text: "Federal court in El Paso rules the map an illegal racial gerrymander and bars its use." },
      { date: "Apr 2026", text: "U.S. Supreme Court overrules the block 6-3; map stands for 2026." }
    ],
    sources: [
      { label: "MidtermProject", url: "https://themidtermproject.org/redistricting-2026" },
      { label: "Ballotpedia", url: "https://ballotpedia.org/Redistricting_ahead_of_the_2026_elections" }
    ]
  },

  "Missouri": {
    status: "contested", favors: "R", seats: 1, voluntary: true,
    summary: "Republicans passed a new map in a September 2025 special session that splits Kansas City and targets Rep. Emanuel Cleaver's 5th District, aiming for one additional GOP seat. The map faces a veto referendum on the November 2026 ballot, and the Missouri Supreme Court rejected one challenge in March 2026.",
    timeline: [
      { date: "Sep 2025", text: "Legislature enacts the map; Gov. Mike Kehoe signs it." },
      { date: "Mar 2026", text: "Missouri Supreme Court rejects a challenge arguing mid-decade redistricting is barred." },
      { date: "Nov 2026", text: "Scheduled veto referendum could overturn the map." }
    ],
    sources: [
      { label: "Voting Rights Lab", url: "https://votingrightslab.org/2026/05/11/an-emerging-trend-mid-decade-redistricting/" },
      { label: "Ballotpedia", url: "https://ballotpedia.org/Redistricting_ahead_of_the_2026_elections" }
    ]
  },

  "North Carolina": {
    status: "enacted", favors: "R", seats: 1, voluntary: true,
    summary: "Republicans passed a new congressional map in the fall of 2025 aimed at adding roughly one more GOP-leaning seat, part of the same wave of voluntary mid-decade redraws.",
    timeline: [
      { date: "Oct 2025", text: "Legislature enacts a new congressional map." }
    ],
    sources: [
      { label: "Ballotpedia", url: "https://ballotpedia.org/Redistricting_ahead_of_the_2026_elections" },
      { label: "PBS", url: "https://www.pbs.org/newshour/politics/a-state-by-state-guide-to-the-redistricting-fight" }
    ]
  },

  "Florida": {
    status: "contested", favors: "R", seats: 4, voluntary: true,
    summary: "Gov. Ron DeSantis called a special session and signed a 24-to-4 map in May 2026 that targets four Democratic incumbents. A lawsuit arguing it violates Florida's Fair Districts amendment was filed the same day; the map is in effect for now.",
    timeline: [
      { date: "Dec 2025", text: "Florida House select committee begins drawing a new map." },
      { date: "Apr 2026", text: "A 24-4 map is unveiled and passed by the legislature along party lines." },
      { date: "May 2026", text: "DeSantis signs the map; a Fair Districts lawsuit is filed the same day." }
    ],
    sources: [
      { label: "MidtermProject", url: "https://themidtermproject.org/redistricting-2026" },
      { label: "MultiState", url: "https://www.multistate.us/insider/2026/3/9/state-redistricting-legal-challenges-intensify-ahead-of-2026-elections" }
    ]
  },

  "Ohio": {
    status: "enacted", favors: "R", seats: 2, voluntary: false,
    summary: "Ohio was required to redraw because its prior map was passed without bipartisan support and carried a shorter expiration under a state constitutional amendment. The Ohio Redistricting Commission unanimously approved a new 12-3 Republican map in October 2025, a shift from the prior 10-5 advantage. It is in effect through 2031.",
    timeline: [
      { date: "Oct 2025", text: "Redistricting Commission unanimously approves a 12-3 map after the legislature missed its bipartisan deadline." }
    ],
    sources: [
      { label: "Ballotpedia", url: "https://ballotpedia.org/Redistricting_ahead_of_the_2026_elections" },
      { label: "MidtermProject", url: "https://themidtermproject.org/redistricting-2026" }
    ]
  },

  "Tennessee": {
    status: "enacted", favors: "R", seats: null, voluntary: true,
    summary: "Tennessee is listed among the states that redrew congressional lines in this cycle to favor Republicans, over Democratic objections. Sources differ on the exact seat impact and on how to classify it relative to the partisan wave — treat the seat figure as unconfirmed.",
    timeline: [
      { date: "2025–26", text: "Legislature approves a redrawn congressional map amid Democratic protest." }
    ],
    sources: [
      { label: "Democracy Docket", url: "https://www.democracydocket.com/analysis/live-redistricting-tracker/" },
      { label: "PBS", url: "https://www.pbs.org/newshour/politics/a-state-by-state-guide-to-the-redistricting-fight" }
    ]
  },

  /* ---- NEW MAPS IN EFFECT — Democratic-favoring ---- */

  "California": {
    status: "enacted", favors: "D", seats: 5, voluntary: true,
    summary: "California voters approved Proposition 50 in November 2025, a direct response to Texas, letting the legislature's redrawn map take effect and adding about five Democratic-leaning seats. Republicans sued, but the U.S. Supreme Court declined to take up the appeal, leaving the map in place for 2026.",
    timeline: [
      { date: "Aug 2025", text: "Legislature passes a new map and refers it to voters." },
      { date: "Nov 2025", text: "Voters approve Proposition 50; the map takes effect." },
      { date: "2026", text: "U.S. Supreme Court declines the Republican appeal; map stands." }
    ],
    sources: [
      { label: "MultiState", url: "https://www.multistate.us/insider/2026/3/9/state-redistricting-legal-challenges-intensify-ahead-of-2026-elections" },
      { label: "Prop 50 (Wikipedia)", url: "https://en.wikipedia.org/wiki/2025_California_Proposition_50" }
    ]
  },

  /* ---- COURT-ORDERED / LITIGATION-DRIVEN ---- */

  "Utah": {
    status: "court", favors: "D", seats: 1, voluntary: false,
    summary: "Utah's new map came out of litigation rather than a voluntary partisan redraw — state courts found the prior map an unlawful partisan gerrymander, leading to a map expected to create one more competitive or Democratic-leaning seat.",
    timeline: [
      { date: "2025", text: "Litigation forces a redrawn congressional map." }
    ],
    sources: [
      { label: "Congress.gov (CRS)", url: "https://www.congress.gov/crs-product/IF13082" },
      { label: "Ballotpedia", url: "https://ballotpedia.org/States_conducting_redistricting_before_2026_elections_due_to_court_rulings_or_legal_requirements" }
    ]
  },

  "Louisiana": {
    status: "court", favors: "none", seats: null, voluntary: false,
    summary: "Louisiana did not volunteer for a partisan redraw. Its map is in flux because of Louisiana v. Callais, the Voting Rights Act case at the U.S. Supreme Court — the dispute centers on a second majority-Black district, and the outcome could shift a seat. Effect is unsettled.",
    timeline: [
      { date: "2024", text: "Legislature enacts a map adding a second majority-Black district under court pressure." },
      { date: "2025–26", text: "Louisiana v. Callais at the U.S. Supreme Court threatens that district." }
    ],
    sources: [
      { label: "All About Redistricting", url: "https://redistricting.lls.edu/national-overview/" },
      { label: "MidtermProject", url: "https://themidtermproject.org/redistricting-2026" }
    ]
  },

  "Alabama": {
    status: "considering", favors: "R", seats: null, voluntary: false,
    summary: "Alabama remains under a court order from Allen v. Milligan not to redraw before 2030, but the state attorney general has asked the Supreme Court to lift that injunction in light of the Louisiana v. Callais decision, and the legislature has prepared for a possible return toward its earlier map. Nothing is in effect.",
    timeline: [
      { date: "2023–24", text: "Allen v. Milligan forces a second majority-Black district; state placed under injunction." },
      { date: "2026", text: "Attorney general asks the Supreme Court to lift the injunction post-Callais." }
    ],
    sources: [
      { label: "Voting Rights Lab", url: "https://votingrightslab.org/2026/05/11/an-emerging-trend-mid-decade-redistricting/" },
      { label: "All About Redistricting", url: "https://redistricting.lls.edu/national-overview/" }
    ]
  },

  /* ---- ATTEMPTED BUT FAILED / BLOCKED ---- */

  "Virginia": {
    status: "failed", favors: "D", seats: 4, voluntary: true,
    summary: "Democrats pursued a counter-map that could have added up to four seats. Voters narrowly approved an enabling constitutional amendment (about 51%) in April 2026, but eight days later the Supreme Court of Virginia struck it down 4-3, ruling the legislature broke its own rules. The U.S. Supreme Court declined to revive it. The existing 6-5 Democratic map stays for 2026.",
    timeline: [
      { date: "Oct 2025", text: "Democratic leaders announce a mid-decade redistricting effort." },
      { date: "Apr 21 2026", text: "Voters approve the enabling amendment ~51%-49% in a special election." },
      { date: "Apr 2026", text: "Virginia Supreme Court strikes the amendment 4-3; U.S. Supreme Court declines to revive." }
    ],
    sources: [
      { label: "MidtermProject", url: "https://themidtermproject.org/redistricting-2026" },
      { label: "PBS", url: "https://www.pbs.org/newshour/politics/republicans-won-the-redistricting-battle-now-voters-will-decide-whether-they-win-congress" }
    ]
  },

  "Indiana": {
    status: "failed", favors: "R", seats: null, voluntary: true,
    summary: "Despite pressure from President Trump and a special session, Indiana's redraw collapsed: a new map passed the state House 57-41 but was rejected by the state Senate in a bipartisan 31-19 vote in December 2025.",
    timeline: [
      { date: "Oct 2025", text: "Gov. Mike Braun calls a special session to redraw the map." },
      { date: "Dec 2025", text: "Map passes the House but dies in the Senate on a bipartisan vote." }
    ],
    sources: [
      { label: "Voting Rights Lab", url: "https://votingrightslab.org/2026/05/11/an-emerging-trend-mid-decade-redistricting/" },
      { label: "BBC", url: "https://www.bbc.com/news/articles" }
    ]
  },

  "South Carolina": {
    status: "failed", favors: "R", seats: null, voluntary: true,
    summary: "A Republican redraw passed the state House but died in the state Senate, leaving the existing map in place for 2026. South Carolina is among the states that could revisit the question after Louisiana v. Callais.",
    timeline: [
      { date: "2025–26", text: "New map passes the House; the Senate does not take it up." }
    ],
    sources: [
      { label: "PBS", url: "https://www.pbs.org/newshour/politics/republicans-won-the-redistricting-battle-now-voters-will-decide-whether-they-win-congress" },
      { label: "All About Redistricting", url: "https://redistricting.lls.edu/national-overview/" }
    ]
  },

  "Maryland": {
    status: "failed", favors: "D", seats: null, voluntary: true,
    summary: "A Democratic redraw effort stalled when the state Senate declined to move forward — the Senate President said the chamber would not pursue mid-cycle redistricting. Gov. Wes Moore launched a redistricting advisory commission, but no new map was enacted for 2026.",
    timeline: [
      { date: "Oct 2025", text: "Senate leadership declines to advance a redraw." },
      { date: "Nov 2025", text: "Gov. Moore launches a redistricting advisory commission." }
    ],
    sources: [
      { label: "Ballotpedia", url: "https://ballotpedia.org/Redistricting_ahead_of_the_2026_elections" },
      { label: "Politico", url: "https://www.politico.com" }
    ]
  },

  "Kansas": {
    status: "failed", favors: "R", seats: null, voluntary: true,
    summary: "Kansas Republicans concluded they lacked the votes to override Democratic Gov. Laura Kelly's expected veto. The House Speaker declined to bring redistricting to a vote in the 2026 session.",
    timeline: [
      { date: "Jan 2026", text: "House Speaker says he will not bring a redistricting bill to a vote, citing insufficient votes." }
    ],
    sources: [
      { label: "Voting Rights Lab", url: "https://votingrightslab.org/2026/05/11/an-emerging-trend-mid-decade-redistricting/" },
      { label: "NPR", url: "https://www.npr.org/2025/11/06/nx-s1-5599558/states-redistricting-house-2026-midterm-elections" }
    ]
  },

  "New York": {
    status: "failed", favors: "D", seats: null, voluntary: false,
    summary: "A state court ruled in January 2026 that New York's 11th District — one of the state's few Republican-held seats — violated the state constitution, reopening the map. But the U.S. Supreme Court set aside the lower-court order, so no new map takes effect for 2026.",
    timeline: [
      { date: "Jan 2026", text: "State court orders NY-11 redrawn." },
      { date: "2026", text: "U.S. Supreme Court sets aside the order; existing map stays." }
    ],
    sources: [
      { label: "Voting Rights Lab", url: "https://votingrightslab.org/2026/05/11/an-emerging-trend-mid-decade-redistricting/" },
      { label: "PBS", url: "https://www.pbs.org/newshour/politics/republicans-won-the-redistricting-battle-now-voters-will-decide-whether-they-win-congress" }
    ]
  },

  /* ---- CONSIDERING / WATCH ---- */

  "Illinois": {
    status: "considering", favors: "D", seats: null, voluntary: true,
    summary: "Illinois Democrats have said 'all options remain on the table' for a counter-redraw, but the state's November candidate filing deadline has already passed, making a change for 2026 unlikely.",
    timeline: [
      { date: "2025–26", text: "Democratic leaders weigh a counter-map; filing deadline complicates timing." }
    ],
    sources: [
      { label: "The Hill / AOL", url: "https://www.aol.com/articles/redistricting-battles-brewing-across-country-164329698.html" }
    ]
  }

};

/* Net-impact rollup for the summary stats. Figures reflect projections that
   assume past voting patterns hold; see PBS / Cook for the underlying ranges. */
const RT_TOTALS = {
  gopGain: 14,   // up to ~14 from TX, FL, MO, NC, OH, TN (PBS)
  demGain: 6,    // up to ~6 from CA and UT (PBS)
  note: "Cook Political Report projects the most likely net effect is close to a wash, with Democratic gains in California offsetting Republican gains elsewhere — especially after Virginia's counter-map was struck down."
};
