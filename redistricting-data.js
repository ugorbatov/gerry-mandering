/* ============================================================================
   2025–26 MID-DECADE REDISTRICTING — CURATED DATASET
   ----------------------------------------------------------------------------
   This is a HAND-CURATED dataset. It is the single source of truth for the
   tracker page and is meant to be edited by hand as the situation changes.
   This is a fast-moving, partly-litigated topic — verify against the linked
   sources before relying on any figure.

   LAST UPDATED: 2026-06-30   (edit RT_LAST_UPDATED below when you revise)

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

const RT_LAST_UPDATED = 'August 11, 2026';

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
      { date: "May 2026", text: "DeSantis signs the map; a Fair Districts lawsuit is filed the same day." },
      { date: "May 27 2026", text: "Trial judge declines to temporarily block the map." },
      { date: "Jun 10 2026", text: "Florida Supreme Court declines 6-1 to intervene, leaving the map in place through the midterms; the underlying Fair Districts challenge continues in lower courts." }
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
    status: "enacted", favors: "R", seats: 1, voluntary: true,
    summary: "Days after the Supreme Court's Louisiana v. Callais ruling weakened the Voting Rights Act, Tennessee repealed its own decades-old ban on mid-decade redistricting and enacted a new map on May 7, 2026. The map carves up the Memphis-based 9th District — the state's only majority-Black and only Democratic seat, held by Rep. Steve Cohen — into three Republican-leaning districts, positioning the GOP to hold all nine seats. Three federal and state suits challenged it (Sherman v. Hargett, Hale v. Lee, TN NAACP v. Hargett); a three-judge federal panel denied a preliminary injunction on Jul 23, 2026, and the map was used for the Aug 6 primary. The underlying suits remain pending.",
    timeline: [
      { date: "Apr 29 2026", text: "Supreme Court decides Louisiana v. Callais, weakening Voting Rights Act protections; Republicans press Tennessee to redraw." },
      { date: "May 1 2026", text: "Gov. Bill Lee calls a special session to review the congressional map." },
      { date: "May 7 2026", text: "Legislature repeals its mid-decade ban and passes the new map; Lee signs it the same day. Cohen and the NAACP file suit." },
      { date: "Jul 23 2026", text: "Three-judge federal panel denies plaintiffs' preliminary injunction; map cleared for the primary." },
      { date: "Aug 6 2026", text: "State primary held under the new map; underlying suits still pending." }
    ],
    sources: [
      { label: "All About Redistricting", url: "https://redistricting.lls.edu/state/tennessee/" },
      { label: "NBC News", url: "https://www.nbcnews.com/politics/2026-election/tennessee-republicans-pass-map-splitting-states-lone-majority-black-di-rcna343934" },
      { label: "TN Sec. of State", url: "https://sos.tn.gov/announcements/2026-congressional-redistricting" }
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
    status: "contested", favors: "R", seats: 1, voluntary: true,
    summary: "Louisiana was the case that reshaped the whole cycle. After the Supreme Court ruled in Louisiana v. Callais (Apr 29, 2026) that the state's two-majority-Black-district map was an unconstitutional racial gerrymander, the legislature drew a new map eliminating one of those districts. Gov. Jeff Landry signed it on May 29, 2026, shifting the delegation from 4-2 to 5-1 Republican. Voting-rights groups are challenging the new map, but it is expected to be used for the 2026 midterms.",
    timeline: [
      { date: "2024", text: "Under court order after Allen v. Milligan, Louisiana enacts a map with a second majority-Black district." },
      { date: "Apr 29 2026", text: "Supreme Court strikes that map down 6-3 as a racial gerrymander in Louisiana v. Callais." },
      { date: "May 29 2026", text: "Legislature passes and Gov. Landry signs a new map dropping to one majority-Black district; delegation moves toward 5-1 R." }
    ],
    sources: [
      { label: "Ballotpedia News", url: "https://news.ballotpedia.org/2026/06/02/a-new-congressional-map-is-enacted-in-louisiana-blocked-in-alabama-and-dead-in-south-carolina/" },
      { label: "NBC News", url: "https://www.nbcnews.com/politics/2026-election/louisiana-passes-new-congressional-map-dismantling-one-majority-black-rcna347575" },
      { label: "Callais (SCOTUSblog)", url: "https://www.scotusblog.com/cases/louisiana-v-callais-2/" }
    ]
  },

  "Alabama": {
    status: "enacted", favors: "R", seats: 1, voluntary: false,
    summary: "Alabama's map fight went through five reversals before finally settling. After Allen v. Milligan forced a second majority-Black district, the Callais ruling let the state revisit its 2023 map (which has only one). A three-judge panel blocked that map again on May 26, 2026 after an 11-day trial, finding intentional racial discrimination — but the U.S. Supreme Court reversed 6-3 on June 2, 2026, ruling the district court shouldn't have interfered with the state's own map choice this close to an election. Alabama held a special primary on Aug 11, 2026 for the four affected districts (1st, 2nd, 6th, 7th) under the 2023 map, shifting the delegation to 6 Republican-leaning seats and 1 Democratic-leaning one. Litigation over the underlying discrimination finding continues.",
    timeline: [
      { date: "2023–24", text: "Allen v. Milligan forces a second majority-Black district; the state's 2023 one-district map is enjoined." },
      { date: "May 11 2026", text: "SCOTUS vacates the standing injunction and remands for review under Callais." },
      { date: "May 26 2026", text: "On remand, a three-judge panel again blocks the 2023 map as intentionally discriminatory after an 11-day trial; orders the court-drawn remedial map used instead." },
      { date: "Jun 2 2026", text: "SCOTUS reverses 6-3, allowing the 2023 map to be used; Gov. Ivey sets an Aug 11 special primary for the 4 affected districts." },
      { date: "Aug 11 2026", text: "Special primary held under the 2023 map; delegation shifts toward 6R–1D. Underlying discrimination case continues." }
    ],
    sources: [
      { label: "Alabama Reflector", url: "https://alabamareflector.com/2026/06/02/supreme-court-allows-alabama-to-use-2023-congressional-map-in-august-special-primary/" },
      { label: "NPR", url: "https://www.npr.org/2026/06/02/nx-s1-5844744/supreme-court-alabama-congressional-districts" },
      { label: "Gov. Ivey's Office", url: "https://governor.alabama.gov/newsroom/2026/05/governor-ivey-celebrates-major-court-victory-in-states-redistricting-battle-calls-special-election-for-alabama-drawn-congressional-map/" }
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
    summary: "Republicans pushed a mid-decade redraw after the Callais ruling, but it died in the state Senate. On May 26, 2026, the Senate voted 24-20 against advancing a new map — twelve Republicans joined twelve Democrats — and then adjourned the special session, leaving the existing map in place for 2026.",
    timeline: [
      { date: "May 2026", text: "Republicans take up a redraw following Louisiana v. Callais." },
      { date: "May 26 2026", text: "Senate votes 24-20 against the map (12 Republicans join 12 Democrats); special session adjourns." }
    ],
    sources: [
      { label: "Ballotpedia News", url: "https://news.ballotpedia.org/2026/06/02/a-new-congressional-map-is-enacted-in-louisiana-blocked-in-alabama-and-dead-in-south-carolina/" },
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

  "Wisconsin": {
    status: "failed", favors: "D", seats: null, voluntary: true,
    summary: "Democrats brought two lawsuits arguing Wisconsin's current map — six Republican-favorable seats and two heavily Democratic ones — was an unlawful partisan gerrymander, hoping to put two GOP-held seats in play for 2026. A three-judge panel dismissed one case in March 2026, and the Wisconsin Supreme Court separately declined without explanation to hear the challenges, leaving the existing map in place for 2026; both cases are expected to continue toward a resolution after this cycle.",
    timeline: [
      { date: "2025", text: "Democrats file two suits challenging the congressional map as a partisan gerrymander." },
      { date: "Mar 2026", text: "Three-judge panel dismisses one suit, finding no basis to invalidate the current map." },
      { date: "2026", text: "Wisconsin Supreme Court declines to hear the challenges; map stays for 2026." }
    ],
    sources: [
      { label: "AP via Audacy", url: "https://www.audacy.com/wwl/news/politics/ap-us-election-2026-redistricting-wisconsin-1st-ld-writethru" },
      { label: "Fox News", url: "https://www.foxnews.com/politics/court-shuts-down-redistricting-fight-key-swing-state-heres-what-means.amp" }
    ]
  },

  "Arkansas": {
    status: "failed", favors: "D", seats: null, voluntary: false,
    summary: "Voters challenged Arkansas's congressional map as a Voting Rights Act violation, arguing it should include a second majority-Black or majority-minority district. A federal court dismissed the case, leaving the existing Republican-favorable map in place for 2026.",
    timeline: [
      { date: "2026", text: "Federal court dismisses the VRA challenge to Arkansas's congressional map." }
    ],
    sources: [
      { label: "Wikipedia — 2026 U.S. House elections", url: "https://en.wikipedia.org/wiki/2026_United_States_House_of_Representatives_elections" },
      { label: "Ballotpedia", url: "https://ballotpedia.org/Redistricting_in_Arkansas" }
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
  },

  "Georgia": {
    status: "considering", favors: "R", seats: null, voluntary: true,
    summary: "After the Callais ruling, Gov. Brian Kemp said Georgia would not redraw its congressional map before November 2026 because voting was already underway, but signaled the state likely would draw new lines before the 2028 cycle.",
    timeline: [
      { date: "May 2026", text: "Gov. Kemp rules out a 2026 redraw but points to likely action before 2028." }
    ],
    sources: [
      { label: "The Hill", url: "https://thehill.com/homenews/campaign/5860114-redistricting-battle-states-midterms/" }
    ]
  }

};

/* Net-impact rollup for the summary stats. Figures are projections that assume
   past voting patterns hold and shift as litigation resolves — see sources for
   the underlying ranges. */
const RT_TOTALS = {
  gopGain: 10,   // Ballotpedia + case tracking (Aug 2026): R net ~10 seats — Texas, Missouri, NC, Ohio, Florida, Louisiana, Tennessee, and Alabama (whose 2023 map was reinstated by SCOTUS on Jun 2 and used for the Aug 11 special primary), once California and Utah's Democratic gains are offset elsewhere.
  demGain: 6,    // up to ~6 from California and Utah; Virginia's counter-map was struck down, and Wisconsin's/Arkansas's challenges were dismissed
  note: "Estimates vary by source and date. As of August 2026, Republicans are projected to net around 10 seats from this cycle — a tilt that grew after the Supreme Court's Louisiana v. Callais ruling weakened the Voting Rights Act and, most recently, after Alabama's 2023 map (favoring Republicans, 6-1) was reinstated by the Supreme Court on June 2 and used for the state's Aug 11 special primary. Several other GOP and Democratic redraw attempts (Wisconsin, Arkansas, Indiana, South Carolina, Kansas, Maryland, New York) failed or were dismissed."
};

