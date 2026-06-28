#!/usr/bin/env python3
"""
build-state-pages.py
====================
Pre-render per-state HTML pages from index.html, with:
  1. Per-state SEO meta tags (title, canonical, og:*, twitter:*, description)
  2. A visible, collapsible "About this state" section pre-rendered into the
     body — containing real, indexable content (rep list, demographics,
     governor, redistricting context for affected states).

WHY VISIBLE-COLLAPSIBLE INSTEAD OF HIDDEN
    Google's policy on hidden text is a delicate line; visible-collapsible
    via the native <details> element is the recognized-safe pattern. Users
    who want detail expand it; Google indexes it as visible content. The
    content is real and matches what the page's JavaScript will render.

USAGE
    python build-state-pages.py            # uses cached rep list if present
    python build-state-pages.py --refresh  # re-downloads the rep list

    Run BEFORE every git push. The output files in states/ go into git.

EDITING
    Edit index.html as you always have. NEVER edit a file in states/ — it's
    generated. To change SEO copy, edit STATE_SEO in index.html.
"""
import io, json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(ROOT, "index.html")
REDISTRICTING_FILE = os.path.join(ROOT, "redistricting-data.js")
OUTPUT_DIR = os.path.join(ROOT, "states")
CACHE_FILE = os.path.join(ROOT, ".legislators-cache.json")
ORIGIN = "https://gerrymandering-revealed.netlify.app"
REFRESH = "--refresh" in sys.argv


def fail(msg):
    print("  ERROR: " + msg, file=sys.stderr); sys.exit(1)


def html_escape(s):
    if s is None: return ""
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


# Read index.html
with io.open(SOURCE, encoding="utf-8") as f:
    src = f.read()

# ── 1. Extract STATE_SEO ──────────────────────────────────────────────────
seo_block = re.search(r"const STATE_SEO = \{(.*?)\n\};", src, re.S)
if not seo_block:
    fail("Could not find STATE_SEO in index.html")
entry_re = re.compile(
    r'"([A-Za-z .]+)":\s*\{\s*'
    r'title:\s*"([^"]*)",\s*'
    r'desc:\s*"([^"]*)",\s*'
    r'keyword:\s*"([^"]*)"\s*\}'
)
entries = entry_re.findall(seo_block.group(1))
if len(entries) < 50:
    fail("Expected 50+ STATE_SEO entries, got {}".format(len(entries)))
SEO = {n: {"title": t, "desc": d, "keyword": k} for n, t, d, k in entries}

# ── 2. Extract supporting data from index.html ────────────────────────────
def find_object(name, source):
    m = re.search(r"const " + name + r" = (\{.*?\});", source, re.S)
    return json.loads(m.group(1)) if m else {}

DELEGATION = find_object("HOUSE_DELEGATION", src)
STATE_ABBR = find_object("STATE_ABBR", src)

# STATE_DEMOGRAPHICS is large; use a permissive grab
def extract_demographics():
    m = re.search(r"const STATE_DEMOGRAPHICS\s*=\s*(\{[\s\S]*?\n\});", src)
    if not m: return {}
    try: return json.loads(m.group(1))
    except Exception: return {}

DEMOGRAPHICS = extract_demographics()

# ── 3. Extract redistricting status (JS file, not strict JSON) ────────────
def extract_redistricting():
    if not os.path.exists(REDISTRICTING_FILE):
        return {}
    with io.open(REDISTRICTING_FILE, encoding="utf-8") as f:
        text = f.read()
    m = re.search(r"const REDISTRICTING = (\{[\s\S]*?\n\});", text)
    if not m: return {}
    body = m.group(1)
    states, i = {}, 0
    while i < len(body):
        h = re.search(r'"([A-Za-z ]+)":\s*\{', body[i:])
        if not h: break
        start = i + h.end()
        depth, j = 1, start
        while j < len(body) and depth > 0:
            if body[j] == "{": depth += 1
            elif body[j] == "}": depth -= 1
            j += 1
        block = body[start:j-1]
        def f(key):
            m2 = re.search(r"\b" + key + r":\s*([^,\n]+)", block)
            if not m2: return None
            v = m2.group(1).strip().strip(",").strip()
            return v[1:-1] if (v.startswith('"') and v.endswith('"')) else v
        states[h.group(1)] = {
            "status": f("status"), "favors": f("favors"), "seats": f("seats"),
        }
        i = j
    return states

REDISTRICTING = extract_redistricting()

# ── 4. Fetch / cache rep list ─────────────────────────────────────────────
LEG_URLS = [
    "https://unitedstates.github.io/congress-legislators/legislators-current.json",
    "https://cdn.jsdelivr.net/gh/unitedstates/congress-legislators@gh-pages/legislators-current.json",
    "https://raw.githubusercontent.com/unitedstates/congress-legislators/gh-pages/legislators-current.json",
]

def fetch_legislators():
    for url in LEG_URLS:
        try:
            print("  fetching: " + url)
            req = urllib.request.Request(url, headers={"User-Agent": "gerry-build/1.0"})
            with urllib.request.urlopen(req, timeout=20) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print("    failed: " + str(e))
    fail("Could not download legislators-current.json")

def load_legislators():
    if not REFRESH and os.path.exists(CACHE_FILE):
        print("  using cached rep list (.legislators-cache.json); --refresh to re-fetch")
        with io.open(CACHE_FILE, encoding="utf-8") as f:
            return json.load(f)
    data = fetch_legislators()
    with io.open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f)
    print("  cached {} legislators".format(len(data)))
    return data

legislators = load_legislators()

def reps_for_state(abbr):
    """Return current House reps for a state, sorted by district number.

    "Current" = any term of type 'rep' in this state whose date range covers
    today. We do NOT just use terms[-1]: some legislator records aren't in
    strict chronological order (e.g. a rep with a service gap or special
    election can have older terms after newer ones), and some current terms
    have no 'end' field set in the source data. We pick the latest-starting
    qualifying term per person to handle reps who switched districts.
    """
    import datetime
    today = datetime.date.today().isoformat()  # 'YYYY-MM-DD'
    out = []
    for L in legislators:
        terms = L.get("terms") or []
        if not terms:
            continue
        # Find any current rep term in this state.
        current = None
        for t in terms:
            if t.get("type") != "rep":
                continue
            if t.get("state") != abbr:
                continue
            start = t.get("start") or ""
            end = t.get("end") or ""
            # A term covers today if start <= today AND (end empty OR end > today).
            # End dates are inclusive of the last serving day, so > today is correct.
            if start and start > today:
                continue
            if end and end < today:
                continue
            # Keep the latest-starting matching term (handles mid-term district changes)
            if current is None or (t.get("start") or "") > (current.get("start") or ""):
                current = t
        if current is None:
            continue
        name_block = L.get("name") or {}
        official = name_block.get("official_full") or (
            (name_block.get("first") or "") + " " + (name_block.get("last") or "")
        ).strip()
        out.append({
            "name": official,
            "party": (current.get("party") or "").strip(),
            "district": current.get("district"),
        })
    out.sort(key=lambda r: 999 if r["district"] is None else r["district"])
    return out

def party_short(p):
    p = (p or "").lower()
    if p.startswith("democ"): return "D"
    if p.startswith("repub"): return "R"
    return (p[:1].upper() or "I")

# ── 5. Build the collapsible "About this state" block ────────────────────
# Compute fresh delegation counts from the live rep list. The hardcoded
# HOUSE_DELEGATION in index.html is a first-paint fallback for the live JS
# (which fetches legislators and overwrites it anyway); at BUILD time we
# should use the same authoritative data the rep list comes from, so the
# summary count and the rep list can't disagree.
def compute_delegation():
    out = {}
    for name in STATE_ABBR:
        abbr = STATE_ABBR[name]
        reps = reps_for_state(abbr)
        d = sum(1 for r in reps if party_short(r["party"]) == "D")
        r = sum(1 for r in reps if party_short(r["party"]) == "R")
        i = sum(1 for r in reps if party_short(r["party"]) not in ("D", "R"))
        out[name] = {"d": d, "r": r, "i": i, "total": len(reps)}
    return out

LIVE_DELEGATION = compute_delegation()

# ─────────────────────────────────────────────────────────────────────────
# Ground truth: 2020 census apportionment. The legal number of House seats
# each state has for 2023-2033. Hardcoded because it doesn't change between
# census cycles and is rock-solid public record. Source: U.S. Census Bureau
# 2020 Apportionment Results. This is the authoritative seat count.
# ─────────────────────────────────────────────────────────────────────────
APPORTIONMENT_2020 = {
    "Alabama": 7, "Alaska": 1, "Arizona": 9, "Arkansas": 4, "California": 52,
    "Colorado": 8, "Connecticut": 5, "Delaware": 1, "Florida": 28, "Georgia": 14,
    "Hawaii": 2, "Idaho": 2, "Illinois": 17, "Indiana": 9, "Iowa": 4,
    "Kansas": 4, "Kentucky": 6, "Louisiana": 6, "Maine": 2, "Maryland": 8,
    "Massachusetts": 9, "Michigan": 13, "Minnesota": 8, "Mississippi": 4,
    "Missouri": 8, "Montana": 2, "Nebraska": 3, "Nevada": 4, "New Hampshire": 2,
    "New Jersey": 12, "New Mexico": 3, "New York": 26, "North Carolina": 14,
    "North Dakota": 1, "Ohio": 15, "Oklahoma": 5, "Oregon": 6, "Pennsylvania": 17,
    "Rhode Island": 2, "South Carolina": 7, "South Dakota": 1, "Tennessee": 9,
    "Texas": 38, "Utah": 4, "Vermont": 1, "Virginia": 11, "Washington": 10,
    "West Virginia": 2, "Wisconsin": 8, "Wyoming": 1,
    "District of Columbia": 0,  # non-voting delegate, not a House seat
}

# ─────────────────────────────────────────────────────────────────────────
# AUDIT 1 — three-way ground-truth check.
# Compare 2020 apportionment (truth) vs hardcoded HOUSE_DELEGATION (template)
# vs live rep list (currently seated). Highlight any state where things
# don't line up cleanly.
# ─────────────────────────────────────────────────────────────────────────
print("\n--- three-way audit (apportionment / hardcoded / live) ---")
suspicious = []
print("  {:<22} {:>5} {:>5} {:>5}  notes".format("STATE", "APP.", "HARD", "LIVE"))
print("  " + "-" * 60)
for name in APPORTIONMENT_2020:
    if name == "District of Columbia":
        continue  # not a House seat; skip from this table
    app = APPORTIONMENT_2020[name]
    hard = DELEGATION.get(name) or {"d": 0, "r": 0}
    hard_t = hard["d"] + hard["r"]
    live = LIVE_DELEGATION.get(name) or {"d": 0, "r": 0, "i": 0, "total": 0}
    live_t = live["total"]
    notes = []
    # The expectations:
    #   apportionment should match hardcoded exactly
    #   live should equal apportionment (full delegation) or be lower (vacancy)
    if hard_t != app:
        notes.append("HARDCODED WRONG")
    if live_t > app:
        notes.append("LIVE > APP (extra seat?)")
    elif live_t < app:
        gap = app - live_t
        notes.append("{} vacant".format(gap))
    if notes:
        suspicious.append((name, app, hard_t, live_t, ", ".join(notes)))
    flag = "  ⚠ " if "WRONG" in " ".join(notes) or "extra" in " ".join(notes) else "    "
    note_str = (" — " + ", ".join(notes)) if notes else ""
    print("  {}{:<20} {:>5} {:>5} {:>5}{}".format(flag, name, app, hard_t, live_t, note_str))

structural_issues = [s for s in suspicious if "WRONG" in s[4] or "extra" in s[4]]
if structural_issues:
    print("\n  STRUCTURAL ISSUES (need fixing in code):")
    for name, app, hard, live, notes in structural_issues:
        print("    - {}: {}".format(name, notes))
else:
    print("\n  No structural issues. Apportionment matches hardcoded for all 50 states.")

# ─────────────────────────────────────────────────────────────────────────
# AUDIT 2 — district-number gap check.
# If a state has reps in districts 1, 2, 3, 5, 6 — district 4 is missing.
# That could be a vacancy (legitimate) or a filter bug (like the Tony
# Gonzales / District 23 disappearance). We flag it for human review.
# Skipped for at-large states (1 district).
# ─────────────────────────────────────────────────────────────────────────
print("\n--- district-number gap check ---")
gap_findings = []
for name, abbr in STATE_ABBR.items():
    app = APPORTIONMENT_2020.get(name, 0)
    if app <= 1:
        continue  # at-large, no gaps possible
    reps = reps_for_state(abbr)
    have = sorted(set(r["district"] for r in reps if isinstance(r["district"], int) and r["district"] > 0))
    expected = list(range(1, app + 1))
    missing = [d for d in expected if d not in have]
    if missing:
        gap_findings.append((name, missing, len(have), app))
if gap_findings:
    print("  States with missing district numbers (vacancy OR filter bug):")
    for name, missing, have_count, app in gap_findings:
        missing_str = ", ".join(str(m) for m in missing)
        print("    - {:<20} missing District(s) {}  ({}/{} reps found)".format(name, missing_str, have_count, app))
    print("\n  These are either real vacancies (fine — SEO will say 'X seats currently")
    print("  vacant') or filter bugs (a rep is in the data but the script isn't")
    print("  matching them). Cross-check by hand with congress.gov if uncertain.")
else:
    print("  All states have continuous district numbering. No filter bugs detected.")

# ─────────────────────────────────────────────────────────────────────────
# AUDIT 3 — original D-vs-R drift audit (kept from before, slightly simpler).
# ─────────────────────────────────────────────────────────────────────────
print("\n--- delegation audit (hardcoded vs live) ---")
mismatches = []
for name in STATE_ABBR:
    hard = DELEGATION.get(name) or {"d": 0, "r": 0}
    live = LIVE_DELEGATION.get(name) or {"d": 0, "r": 0, "i": 0, "total": 0}
    hard_total = hard.get("d", 0) + hard.get("r", 0)
    if hard.get("d") != live["d"] or hard.get("r") != live["r"] or hard_total != live["total"]:
        mismatches.append((name, hard, live))
if mismatches:
    print("  {} states with stale delegation counts in index.html:".format(len(mismatches)))
    for name, hard, live in mismatches:
        ind = " ({}i)".format(live["i"]) if live.get("i") else ""
        print("    - {:<22} hardcoded {}D/{}R={} | actual {}D/{}R={}{}".format(
            name, hard.get("d", 0), hard.get("r", 0),
            hard.get("d", 0) + hard.get("r", 0),
            live["d"], live["r"], live["total"], ind))
    print("  → the SEO sections use ACTUAL counts; consider updating index.html.")
    # Emit a corrected HOUSE_DELEGATION line for paste-in. The rule:
    # if hardcoded total == live total → it's a party flip → update D/R
    # if hardcoded total >  live total → there's a vacancy → KEEP hardcoded
    #   (the constitutional total is the truth; live count is temporary)
    # if hardcoded total <  live total → live data has more seats than the
    #   hardcoded table → trust live (probably a redistricting added a seat)
    pairs = []
    kept_for_vacancy = []
    for name in DELEGATION:  # preserve original order in index.html
        hard = DELEGATION[name]
        hard_total = hard["d"] + hard["r"]
        if name in LIVE_DELEGATION:
            live = LIVE_DELEGATION[name]
            live_total = live["total"]
            if live_total < hard_total:
                # vacancy — keep hardcoded so the constitutional total holds
                pairs.append('"{}":{{"d":{},"r":{}}}'.format(name, hard["d"], hard["r"]))
                if hard["d"] != live["d"] or hard["r"] != live["r"]:
                    kept_for_vacancy.append(name)
            else:
                pairs.append('"{}":{{"d":{},"r":{}}}'.format(name, live["d"], live["r"]))
        else:
            pairs.append('"{}":{{"d":{},"r":{}}}'.format(name, hard["d"], hard["r"]))
    corrected_line = "const HOUSE_DELEGATION = {" + ",".join(pairs) + "};"
    with io.open(os.path.join(ROOT, "house-delegation-corrected.txt"), "w", encoding="utf-8") as f:
        note = ""
        if kept_for_vacancy:
            note = (
                "# Note: kept original D/R counts for {} (vacancy in live data).\n"
                "# The SEO sections will mention 'X seats currently vacant' in the\n"
                "# summary paragraph; the hardcoded total preserves the constitutional\n"
                "# seat count for first-paint correctness.\n"
            ).format(", ".join(kept_for_vacancy))
        f.write(
            "# Generated by build-state-pages.py — paste this line into index.html\n"
            "# to replace the existing 'const HOUSE_DELEGATION = ...' line.\n"
            "# This fixes the first-paint count flash on state pages.\n"
            + note + "\n"
            + corrected_line + "\n"
        )
    print("  → wrote house-delegation-corrected.txt for paste-in.")
else:
    print("  all states match.")
print("")
def build_seo_section(state_name):
    abbr = STATE_ABBR.get(state_name)
    reps = reps_for_state(abbr) if abbr else []
    # Live counts (currently seated reps) for the party breakdown.
    live = LIVE_DELEGATION.get(state_name) or {"d": 0, "r": 0, "i": 0, "total": 0}
    d_count, r_count, i_count = live["d"], live["r"], live.get("i", 0)
    live_total = live["total"]
    # Constitutional seat count for the state — the legal number of districts.
    # Use the larger of (hardcoded HOUSE_DELEGATION total, live count) so we
    # don't undercount when there's an unfilled vacancy in the live data.
    hard = DELEGATION.get(state_name) or {"d": 0, "r": 0}
    hard_total = hard.get("d", 0) + hard.get("r", 0)
    total = max(hard_total, live_total)
    vacancies = total - live_total
    redis = REDISTRICTING.get(state_name)

    # Opening paragraph
    parts = []
    if total == 1:
        parts.append("{n} has one at-large U.S. House district covering the entire state in the 119th Congress.".format(n=state_name))
    else:
        breakdown = "{d} held by Democrats and {r} held by Republicans".format(d=d_count, r=r_count)
        if i_count:
            breakdown += " (plus {} independent{})".format(i_count, "" if i_count == 1 else "s")
        if vacancies > 0:
            breakdown += ", with {} seat{} currently vacant".format(vacancies, "" if vacancies == 1 else "s")
        parts.append("{n} has {t} U.S. House congressional districts \u2014 {b} in the 119th Congress (2025-2027).".format(n=state_name, t=total, b=breakdown))

    # Redistricting note for affected states
    if redis and redis.get("status") in ("enacted", "contested", "court"):
        favors = redis.get("favors") or ""
        flabel = {"R": "Republican", "D": "Democratic"}.get(favors, "")
        seats = redis.get("seats")
        line = "{n}'s congressional map was redrawn in the 2025-26 mid-decade redistricting cycle".format(n=state_name)
        if flabel and seats and seats not in ("null", "None", None):
            try:
                s = int(seats)
                line += ", a redraw projected to favor {p}s by about {s} seat{ss}".format(p=flabel, s=s, ss="" if s == 1 else "s")
            except (TypeError, ValueError):
                pass
        line += "."
        parts.append(line)

    summary = " ".join(parts)

    # Rep list
    if reps:
        items = []
        for r in reps:
            d = r["district"]
            label = "At-large" if (d == 0 or total == 1) else "District {}".format(d)
            items.append('<li><strong>{lbl}</strong>: {nm} ({p})</li>'.format(
                lbl=label, nm=html_escape(r["name"]), p=party_short(r["party"])))
        rep_html = '<ul class="seo-rep-list">' + "".join(items) + "</ul>"
    else:
        rep_html = "<p>Representative list updates live in the map above.</p>"

    # Demographics
    demo = DEMOGRAPHICS.get(state_name) or {}
    demo_html = ""
    if demo:
        bits = []
        race = demo.get("race") or {}
        if race:
            top3 = sorted(race.items(), key=lambda kv: -(kv[1] or 0))[:3]
            rb = ["{:.1f}% {}".format(p, k.capitalize()) for k, p in top3 if p]
            if rb: bits.append("Racial composition (largest groups): " + ", ".join(rb) + ".")
        if demo.get("income"):
            bits.append("Median household income: ${:,.0f}.".format(demo["income"]))
        if demo.get("poverty") is not None:
            bits.append("Poverty rate: {:.1f}%.".format(demo["poverty"]))
        if bits: demo_html = "<p>" + " ".join(bits) + "</p>"

    return (
        '\n<details class="state-seo-details" id="state-seo-details">\n'
        '  <summary>About {n}\'s congressional districts</summary>\n'
        '  <div class="state-seo-body">\n'
        '    <p>{s}</p>\n'
        '    {dm}\n'
        '    <h2>Current U.S. House representatives</h2>\n'
        '    {rh}\n'
        '    <p class="state-seo-note">Data sourced from public records '
        '(@unitedstates/congress-legislators, U.S. Census, FEC). The interactive map '
        'above shows additional detail; this section is a static summary for reference.</p>\n'
        '  </div>\n'
        '</details>\n'
    ).format(n=html_escape(state_name), s=html_escape(summary), dm=demo_html, rh=rep_html)


# ── 6. Tag rewriters ──────────────────────────────────────────────────────
PATTERNS = [
    (re.compile(r"(<title>)[^<]*(</title>)"), r"\1{value}\2"),
    (re.compile(r'(<link\s+rel="canonical"\s+href=")[^"]*(")'), r"\1{value}\2"),
    (re.compile(r'(<meta\s+name="description"\s+content=")[^"]*(")'), r"\1{value}\2"),
    (re.compile(r'(<meta\s+property="og:url"\s+content=")[^"]*(")'), r"\1{value}\2"),
    (re.compile(r'(<meta\s+property="og:title"\s+content=")[^"]*(")'), r"\1{value}\2"),
    (re.compile(r'(<meta\s+property="og:description"\s+content=")[^"]*(")'), r"\1{value}\2"),
    (re.compile(r'(<meta\s+name="twitter:url"\s+content=")[^"]*(")'), r"\1{value}\2"),
    (re.compile(r'(<meta\s+name="twitter:title"\s+content=")[^"]*(")'), r"\1{value}\2"),
    (re.compile(r'(<meta\s+name="twitter:description"\s+content=")[^"]*(")'), r"\1{value}\2"),
]

def state_slug(name): return name.lower().strip().replace(" ", "-")

def rewrite(html, rx, tpl, value):
    safe = value.replace("\\", "\\\\").replace('"', "&quot;")
    return rx.subn(tpl.format(value=safe), html, count=1)


# ── 7. Generate ──────────────────────────────────────────────────────────
os.makedirs(OUTPUT_DIR, exist_ok=True)
written, all_misses = [], {}

for name, seo in SEO.items():
    slug = state_slug(name)
    page_url = ORIGIN + "/" + slug
    brand_title = seo["title"] + " \u00b7 Gerrymandering Revealed"

    values = [brand_title, page_url, seo["desc"],
              page_url, brand_title, seo["desc"],
              page_url, brand_title, seo["desc"]]

    html, misses = src, []
    for (rx, tpl), val in zip(PATTERNS, values):
        html, n = rewrite(html, rx, tpl, val)
        if n == 0: misses.append(rx.pattern[:40])
    if misses: all_misses[name] = misses

    # Inject collapsible section before </footer>
    seo_section = build_seo_section(name)
    if "</footer>" in html:
        html = html.replace("</footer>", seo_section + "</footer>", 1)
    else:
        html = html.replace("</body>", seo_section + "</body>", 1)

    with io.open(os.path.join(OUTPUT_DIR, slug + ".html"), "w", encoding="utf-8") as f:
        f.write(html)
    written.append(slug)

print("\nGenerated {} state pages.".format(len(written)))
if all_misses:
    print("  WARNINGS:")
    for n, m in all_misses.items():
        print("    - " + n + ": " + ", ".join(m))
else:
    print("  All SEO tags rewritten + per-state content sections injected.")
