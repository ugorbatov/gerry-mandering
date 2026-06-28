#!/usr/bin/env python3
"""
build-rep-pages.py
==================
Pre-render per-rep HTML pages from the legislator data. Each rep gets a
file at  states/<state-slug>/district-<n>/<rep-slug>.html  with full
indexable SEO content: name, district, party, contact, district context.

Dynamic content (bills, news, finance, donors, PACs) is intentionally NOT
baked in — those are filled by JavaScript on page load using the same
endpoints the existing rep-modal uses. The static HTML carries the SEO
weight; the live content carries the user value.

URL pattern (mirrors stage-2 ship 1 conventions):
    /state/<state-slug>/district-<n>/<rep-slug>

Slug rules for rep names (handling real edge cases in the 537-rep dataset):
    "Steve Cohen"           → steve-cohen
    "Randy K. Weber, Sr."   → randy-weber-sr      (suffix preserved, initial dropped)
    "Michael T. McCaul"     → michael-mccaul       (middle initial dropped)
    "Joaquin Castro"        → joaquin-castro       (accent already-normalized in src)
    "Tom O'Halleran"        → tom-ohalleran        (apostrophe dropped)
    "Brian Mast"            → brian-mast
    "A. Donald McEachin"    → a-donald-mceachin    (single-letter first preserved)
    "Marc A. Veasey"        → marc-veasey

The "preserve suffix" rule (Sr./Jr./II/III) is deliberate: if it's part of
how someone is publicly known (Randy Weber Sr.) it should be in their URL.

USAGE
    python build-rep-pages.py               # uses cached rep list
    python build-rep-pages.py --refresh     # re-fetch the rep list

    Run AFTER build-state-pages.py, or as a separate step. Both scripts
    share the same .legislators-cache.json so the rep list is fetched once.
"""
import io
import json
import os
import re
import sys
import unicodedata
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(ROOT, "index.html")
OUTPUT_BASE = os.path.join(ROOT, "states")  # nests under states/<slug>/district-N/
CACHE_FILE = os.path.join(ROOT, ".legislators-cache.json")
ORIGIN = "https://gerrymandering-revealed.netlify.app"
REFRESH = "--refresh" in sys.argv


def fail(msg):
    print("  ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def html_escape(s):
    if s is None:
        return ""
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


# ─────────────────────────────────────────────────────────────────────────
# 1. Read index.html for STATE_ABBR and STATE_SEO (state context paragraphs)
# ─────────────────────────────────────────────────────────────────────────
with io.open(SOURCE, encoding="utf-8") as f:
    src = f.read()


def find_json_object(name, source):
    m = re.search(r"const " + name + r" = (\{.*?\});", source, re.S)
    return json.loads(m.group(1)) if m else {}

STATE_ABBR = find_json_object("STATE_ABBR", src)
if not STATE_ABBR:
    fail("Could not find STATE_ABBR in index.html")

# Build inverse map: abbr → name
ABBR_TO_NAME = {v: k for k, v in STATE_ABBR.items()}


# ─────────────────────────────────────────────────────────────────────────
# 2. Fetch / cache legislator data (same approach as build-state-pages.py)
# ─────────────────────────────────────────────────────────────────────────
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


# ─────────────────────────────────────────────────────────────────────────
# 3. Slug rules — derive a URL-safe slug from a rep's name.
# ─────────────────────────────────────────────────────────────────────────
def rep_slug(name):
    """Convert a rep's display name to a URL slug.

    Rules (in order):
      1. Strip diacritics → ASCII (Joaquín → Joaquin)
      2. Identify a trailing suffix (Sr., Jr., II, III, IV) — preserve it
      3. Drop middle-initial tokens (single letter followed by period or alone)
      4. Drop apostrophes (O'Halleran → OHalleran)
      5. Replace remaining non-alphanumeric runs with hyphens
      6. Lowercase
    """
    # 1. Normalize accents
    n = unicodedata.normalize("NFKD", name)
    n = "".join(ch for ch in n if not unicodedata.combining(ch))
    # 2. Detect suffix at the end (after a comma OR space)
    suffix = None
    m = re.search(r"[,\s]+(Sr|Jr|II|III|IV|V)\.?$", n)
    if m:
        suffix = m.group(1).lower()
        n = n[:m.start()].strip().rstrip(",")
    # 3. Drop middle-initial tokens like "T.", "K.", "A." — but preserve
    #    single-letter FIRST names ("A. Donald McEachin" → keep the A)
    tokens = n.split()
    cleaned = []
    for i, t in enumerate(tokens):
        if i > 0 and i < len(tokens) - 1 and re.match(r"^[A-Z]\.?$", t):
            continue  # middle initial, drop
        cleaned.append(t)
    n = " ".join(cleaned)
    # 4. Drop apostrophes (O'Halleran, D'Esposito)
    n = n.replace("'", "").replace("\u2019", "")
    # 5. Replace non-alphanumeric runs with hyphens
    n = re.sub(r"[^A-Za-z0-9]+", "-", n).strip("-").lower()
    # 6. Append suffix if present
    if suffix:
        n = n + "-" + suffix
    return n


# ─────────────────────────────────────────────────────────────────────────
# 4. Current reps — same filter as build-state-pages.py (covers today)
# ─────────────────────────────────────────────────────────────────────────
import datetime
TODAY = datetime.date.today().isoformat()


def current_term(L):
    """Return the term that covers today and is type 'rep', or None."""
    terms = L.get("terms") or []
    if not terms:
        return None
    current = None
    for t in terms:
        if t.get("type") != "rep":
            continue
        start = t.get("start") or ""
        end = t.get("end") or ""
        if start and start > TODAY:
            continue
        if end and end < TODAY:
            continue
        if current is None or (t.get("start") or "") > (current.get("start") or ""):
            current = t
    return current


def all_current_reps():
    out = []
    for L in legislators:
        t = current_term(L)
        if t is None:
            continue
        nb = L.get("name") or {}
        official = nb.get("official_full") or (
            (nb.get("first") or "") + " " + (nb.get("last") or "")
        ).strip()
        out.append({
            "name": official,
            "first": nb.get("first") or "",
            "last": nb.get("last") or "",
            "party": (t.get("party") or "").strip(),
            "state_abbr": t.get("state"),
            "district": t.get("district"),
            "bioguide": (L.get("id") or {}).get("bioguide"),
            "url": t.get("url"),
            "phone": t.get("phone"),
            "address": t.get("address"),
            "start": t.get("start"),
        })
    return out


REPS = all_current_reps()
print("  {} current reps".format(len(REPS)))


# ─────────────────────────────────────────────────────────────────────────
# 5. Slug uniqueness check — flag any collisions before generating
# ─────────────────────────────────────────────────────────────────────────
slug_map = {}  # (state_slug, district, rep_slug) → rep
collisions = []
for r in REPS:
    if not r["state_abbr"] or r["district"] is None:
        continue
    state_name = ABBR_TO_NAME.get(r["state_abbr"])
    if not state_name:
        continue
    state_slug = state_name.lower().replace(" ", "-")
    rs = rep_slug(r["name"])
    key = (state_slug, r["district"], rs)
    if key in slug_map:
        collisions.append((key, slug_map[key]["name"], r["name"]))
    else:
        slug_map[key] = r

if collisions:
    print("  SLUG COLLISIONS (same state/district/slug for different people):")
    for key, a, b in collisions:
        print("    {} ↔ {} at {}".format(a, b, key))
    fail("Resolve slug collisions before continuing.")
else:
    print("  No slug collisions across {} reps.".format(len(slug_map)))


# ─────────────────────────────────────────────────────────────────────────
# 6. The rep-page template. ONE template, substituted with each rep's data.
# Style is copy-pasted from sample-rep-page.html; keep them in sync.
# ─────────────────────────────────────────────────────────────────────────
TEMPLATE = u'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<base href="/" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />

<title>{title}</title>
<link rel="canonical" href="{canonical}" />
<meta name="description" content="{desc}" />
<meta name="keywords" content="{keywords}" />

<meta property="og:type" content="profile" />
<meta property="og:url" content="{canonical}" />
<meta property="og:title" content="{title_short}" />
<meta property="og:description" content="{desc}" />
{og_image_tag}

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content="{canonical}" />
<meta name="twitter:title" content="{title_short}" />
<meta name="twitter:description" content="{desc}" />

<script type="application/ld+json">
{jsonld}
</script>

<style>
  :root {{
    --bg: #0A0A0B; --surface: #111113; --surface-2: #18181B;
    --border: #1F1F23; --border-hi: #2E2E33;
    --text: #F4F4F5; --text-dim: #A1A1AA; --text-mute: #52525B;
    --dem: #3B82F6; --rep: #EF4444; --ind: #A855F7;
  }}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; padding: 0; background: var(--bg); color: var(--text);
    font-family: "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased; line-height: 1.55; }}
  a {{ color: var(--text-dim); text-decoration: underline; text-decoration-color: var(--border-hi); text-underline-offset: 2px; transition: color 150ms; }}
  a:hover {{ color: var(--text); text-decoration-color: var(--text-dim); }}
  .page {{ max-width: 1100px; margin: 0 auto; padding: 20px 24px 60px; }}
  .top-bar {{ display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 14px; border-bottom: 1px solid var(--border);
    font-size: 11px; letter-spacing: 0.08em; color: var(--text-mute);
    font-family: "JetBrains Mono", ui-monospace, monospace; text-transform: uppercase; }}
  .brand {{ color: var(--text); font-weight: 500; }}
  .brand .accent {{ color: var(--dem); }}
  .crumbs a {{ color: var(--text-dim); text-decoration: none; }}
  .crumbs a:hover {{ color: var(--text); }}
  .crumbs .sep {{ padding: 0 8px; color: var(--text-mute); }}
  .rep-hero {{ display: grid; grid-template-columns: 220px 1fr; gap: 28px;
    margin-top: 28px; padding: 28px 0 24px; border-bottom: 1px solid var(--border); }}
  .rep-photo-wrap {{ aspect-ratio: 4 / 5; background: var(--surface-2);
    border: 1px solid var(--border); overflow: hidden; position: relative; }}
  .rep-photo {{ width: 100%; height: 100%; object-fit: cover; display: block; filter: saturate(0.95) contrast(1.02); }}
  .rep-photo-stripe {{ position: absolute; left: 0; right: 0; bottom: 0; height: 4px; }}
  .rep-photo-stripe.dem {{ background: var(--dem); }}
  .rep-photo-stripe.rep {{ background: var(--rep); }}
  .rep-photo-stripe.ind {{ background: var(--ind); }}
  .rep-meta {{ display: flex; flex-direction: column; justify-content: center; }}
  .rep-eyebrow {{ font-size: 11px; letter-spacing: 0.12em; color: var(--text-mute);
    font-family: "JetBrains Mono", ui-monospace, monospace; text-transform: uppercase; margin-bottom: 8px; }}
  .rep-name {{ font-size: 38px; font-weight: 600; margin: 0 0 6px; letter-spacing: -0.02em; line-height: 1.1; }}
  .rep-title-line {{ font-size: 15px; color: var(--text-dim); margin-bottom: 18px; }}
  .rep-party-pill {{ display: inline-flex; align-items: center; gap: 6px;
    padding: 2px 10px; border-radius: 99px; font-size: 11px; font-weight: 500;
    letter-spacing: 0.04em; text-transform: uppercase; border: 1px solid;
    font-family: "JetBrains Mono", ui-monospace, monospace; }}
  .rep-party-pill.dem {{ color: var(--dem); border-color: rgba(59,130,246,0.5); background: rgba(59,130,246,0.08); }}
  .rep-party-pill.rep {{ color: var(--rep); border-color: rgba(239,68,68,0.5); background: rgba(239,68,68,0.08); }}
  .rep-party-pill.ind {{ color: var(--ind); border-color: rgba(168,85,247,0.5); background: rgba(168,85,247,0.08); }}
  .rep-summary {{ font-size: 15px; color: var(--text-dim); max-width: 64ch; margin: 0; }}
  .facts-row {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
    background: var(--border); border: 1px solid var(--border); margin: 28px 0 36px; }}
  .fact {{ background: var(--bg); padding: 14px 18px; }}
  .fact-label {{ font-size: 10px; letter-spacing: 0.1em; color: var(--text-mute);
    text-transform: uppercase; font-family: "JetBrains Mono", ui-monospace, monospace; margin-bottom: 6px; }}
  .fact-value {{ font-size: 14px; color: var(--text); font-weight: 500; }}
  .fact-value a {{ color: var(--text); text-decoration: none; border-bottom: 1px dashed var(--border-hi); }}
  .fact-value a:hover {{ border-color: var(--text-dim); }}
  .body-grid {{ display: grid; grid-template-columns: 1.6fr 1fr; gap: 36px; margin-bottom: 28px; }}
  .body-section h2 {{ font-size: 11px; font-weight: 500; color: var(--text-mute);
    letter-spacing: 0.12em; text-transform: uppercase;
    font-family: "JetBrains Mono", ui-monospace, monospace;
    margin: 0 0 14px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }}
  .body-section p {{ font-size: 14px; color: var(--text-dim); margin: 0 0 12px; line-height: 1.65; }}
  details.state-context {{ margin: 8px 0 28px; border: 1px solid var(--border); }}
  details.state-context summary {{ cursor: pointer; padding: 14px 18px; color: var(--text);
    font-size: 13px; font-weight: 500; list-style: none; user-select: none; background: var(--surface); }}
  details.state-context summary::-webkit-details-marker {{ display: none; }}
  details.state-context summary::before {{ content: "▸ "; color: var(--text-mute); font-size: 11px; }}
  details.state-context[open] summary::before {{ content: "▾ "; }}
  details.state-context > div {{ padding: 18px; }}
  .rep-footer {{ margin-top: 48px; padding-top: 18px; border-top: 1px solid var(--border);
    color: var(--text-mute); font-size: 11px;
    font-family: "JetBrains Mono", ui-monospace, monospace; letter-spacing: 0.04em; line-height: 1.7; }}
  .rep-footer .nav-row {{ display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 10px; }}
  .rep-footer a {{ color: var(--text-dim); }}
  @media (max-width: 720px) {{
    .rep-hero {{ grid-template-columns: 140px 1fr; gap: 18px; }}
    .rep-name {{ font-size: 26px; }}
    .facts-row {{ grid-template-columns: repeat(2, 1fr); }}
    .body-grid {{ grid-template-columns: 1fr; }}
  }}
</style>
</head>
<body>

<div class="page">

  <div class="top-bar">
    <div class="brand">▮ Gerrymandering <span class="accent">Revealed</span></div>
    <div class="crumbs">
      <a href="/">U.S. Map</a>
      <span class="sep">›</span>
      <a href="/state/{state_slug}">{state_name}</a>
      <span class="sep">›</span>
      District {district}
    </div>
  </div>

  <header class="rep-hero">
    <div class="rep-photo-wrap">
      {photo_html}
      <div class="rep-photo-stripe {party_class}"></div>
    </div>
    <div class="rep-meta">
      <div class="rep-eyebrow">{state_name} · {district_label} · 119th Congress</div>
      <h1 class="rep-name">{name}</h1>
      <div class="rep-title-line">
        U.S. Representative
        <span style="color: var(--text-mute); margin: 0 6px;">·</span>
        <span class="rep-party-pill {party_class}">{party_full}</span>
      </div>
      <p class="rep-summary">{summary}</p>
    </div>
  </header>

  <div class="facts-row">
    {facts_html}
  </div>

  <div class="body-grid">
    <section class="body-section">
      <h2>About this district</h2>
      <p>{district_paragraph}</p>
    </section>
    <aside class="body-section" style="padding: 18px; background: var(--surface); border: 1px solid var(--border);">
      <h2 style="margin-top: 0;">In the {state_name} delegation</h2>
      <p>{delegation_paragraph}</p>
      <p style="font-size: 12px; color: var(--text-mute);"><a href="/state/{state_slug}">See all {state_name} representatives →</a></p>
    </aside>
  </div>

  <details class="state-context">
    <summary>About {state_name}'s congressional districts</summary>
    <div>
      <p style="font-size: 14px; color: var(--text-dim);">{state_seo_paragraph}</p>
      <p style="font-size: 13px; color: var(--text-mute);">
        See the full <a href="/state/{state_slug}">{state_name} delegation</a> for all representatives.
      </p>
    </div>
  </details>

  <footer class="rep-footer">
    <div class="nav-row">
      <a href="/">← U.S. map</a>
      <a href="/state/{state_slug}">← {state_name}</a>
      <a href="/redistricting-tracker">Redistricting tracker</a>
      <a href="/legal-tracker">Legal tracker</a>
    </div>
    <div>
      Data sourced from public records (@unitedstates/congress-legislators,
      U.S. Census, FEC, congress.gov). This static page is generated at build
      time; live news, bills, and finance data are loaded by the interactive
      page on the live site.
    </div>
  </footer>

</div>

</body>
</html>
'''


# ─────────────────────────────────────────────────────────────────────────
# 7. Per-rep state delegation summary (used in the "in the X delegation" panel)
# ─────────────────────────────────────────────────────────────────────────
def state_delegation_text(state_name):
    abbr = STATE_ABBR.get(state_name)
    if not abbr:
        return ""
    state_reps = [r for r in REPS if r["state_abbr"] == abbr]
    d = sum(1 for r in state_reps if (r["party"] or "").lower().startswith("democ"))
    rcount = sum(1 for r in state_reps if (r["party"] or "").lower().startswith("repub"))
    total = len(state_reps)
    if total == 1:
        return "{} has one at-large U.S. House district in the 119th Congress.".format(state_name)
    return "{} sends {} representatives to the U.S. House — {} Democrat{} and {} Republican{}.".format(
        state_name, total, d, "" if d == 1 else "s", rcount, "" if rcount == 1 else "s"
    )


# Pre-compute state SEO paragraphs from STATE_SEO in index.html so the
# collapsible "about state" matches what's on the state pages.
state_seo_match = re.search(r"const STATE_SEO = \{(.*?)\n\};", src, re.S)
STATE_SEO = {}
if state_seo_match:
    entry_re = re.compile(
        r'"([A-Za-z .]+)":\s*\{\s*'
        r'title:\s*"([^"]*)",\s*'
        r'desc:\s*"([^"]*)",\s*'
        r'keyword:\s*"([^"]*)"\s*\}'
    )
    for nm, t, d, k in entry_re.findall(state_seo_match.group(1)):
        STATE_SEO[nm] = {"title": t, "desc": d, "keyword": k}


# ─────────────────────────────────────────────────────────────────────────
# 8. Generate one page per rep
# ─────────────────────────────────────────────────────────────────────────
def party_class(party):
    p = (party or "").lower()
    if p.startswith("democ"): return "dem"
    if p.startswith("repub"): return "rep"
    return "ind"


def party_full(party):
    p = (party or "").lower()
    if p.startswith("democ"): return "Democrat"
    if p.startswith("repub"): return "Republican"
    if p.startswith("indep"): return "Independent"
    return party or "Unknown"


def build_one_page(rep):
    state_name = ABBR_TO_NAME.get(rep["state_abbr"])
    if not state_name:
        return None
    state_slug = state_name.lower().replace(" ", "-")
    rs = rep_slug(rep["name"])
    district = rep["district"]
    if district is None:
        return None
    district_label = "At-Large" if district == 0 else "District {}".format(district)

    canonical = "{}/state/{}/district-{}/{}".format(ORIGIN, state_slug, district, rs)
    title_short = "{}, U.S. Representative for {}'s {} Congressional District".format(
        rep["name"], state_name,
        "at-large" if district == 0 else ordinal(district)
    )
    title = title_short + " · Gerrymandering Revealed"
    desc = "{} is the U.S. Representative for {}'s {} Congressional District ({}). District profile, contact, voting record, and election results.".format(
        rep["name"], state_name,
        "at-large" if district == 0 else ordinal(district),
        party_full(rep["party"])
    )
    keywords = "{}, {} {}, {}-{}, congressional district, U.S. House".format(
        rep["name"], state_name, district_label, rep["state_abbr"], district
    )

    # Summary paragraph templated from data
    sworn_year = ""
    if rep.get("start"):
        try:
            sworn_year = " They have held the seat since {}.".format(int(rep["start"][:4]))
        except (ValueError, TypeError):
            pass
    summary = "{name} is the U.S. Representative for {st}'s {dl} Congressional District. {pf}.{sw}".format(
        name=rep["name"], st=state_name,
        dl="at-large" if district == 0 else ordinal(district),
        pf=party_full(rep["party"]), sw=sworn_year
    )

    # Photo (bioguide.congress.gov primary, theunitedstates.io fallback)
    photo_html = ""
    og_image_tag = ""
    if rep.get("bioguide"):
        bg = rep["bioguide"]
        photo_url = "https://bioguide.congress.gov/bioguide/photo/{}/{}.jpg".format(bg[0], bg)
        fb_url = "https://theunitedstates.io/images/congress/450x550/{}.jpg".format(bg)
        photo_html = (
            '<img class="rep-photo" src="{}" alt="{}" '
            'onerror="this.onerror=null;this.src=\'{}\';" />'
        ).format(photo_url, html_escape(rep["name"]), fb_url)
        og_image_tag = '<meta property="og:image" content="{}" />'.format(photo_url)
    else:
        photo_html = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-mute);font-size:11px;">No photo</div>'

    # Facts row
    facts = []
    if rep.get("phone"):
        facts.append('<div class="fact"><div class="fact-label">Phone</div><div class="fact-value"><a href="tel:{ph}">{ph}</a></div></div>'.format(ph=html_escape(rep["phone"])))
    if rep.get("url"):
        host = re.sub(r"^https?://(www\\.)?", "", rep["url"]).rstrip("/")
        facts.append('<div class="fact"><div class="fact-label">Official Site</div><div class="fact-value"><a href="{u}" target="_blank" rel="noopener">{h}</a></div></div>'.format(u=html_escape(rep["url"]), h=html_escape(host)))
    if rep.get("start"):
        facts.append('<div class="fact"><div class="fact-label">Term Start</div><div class="fact-value">{}</div></div>'.format(html_escape(rep["start"][:4])))
    if rep.get("bioguide"):
        facts.append('<div class="fact"><div class="fact-label">Bioguide ID</div><div class="fact-value">{}</div></div>'.format(html_escape(rep["bioguide"])))
    while len(facts) < 4:
        facts.append('<div class="fact"><div class="fact-label">&nbsp;</div><div class="fact-value">&nbsp;</div></div>')
    facts_html = "\n    ".join(facts)

    # District paragraph (templated)
    district_paragraph = ("{state_name}'s {dl} Congressional District is represented by "
                          "{name} in the 119th Congress (2025-2027). "
                          "For district shape, population, and demographic breakdown, see the "
                          "interactive map. Voting record, sponsored bills, news coverage, "
                          "and campaign finance are loaded live below by the page once it opens.").format(
        state_name=state_name,
        dl="at-large" if district == 0 else ordinal(district),
        name=rep["name"]
    )

    delegation_paragraph = state_delegation_text(state_name)

    # State SEO paragraph (the collapsible context section)
    state_seo = STATE_SEO.get(state_name, {})
    state_seo_paragraph = state_seo.get("desc") or (
        "Congressional districts in " + state_name + " in the 119th Congress."
    )

    # JSON-LD
    jsonld = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": rep["name"],
        "jobTitle": "Member of the U.S. House of Representatives",
        "worksFor": {"@type": "GovernmentOrganization", "name": "U.S. House of Representatives"},
        "memberOf": {"@type": "Organization", "name": party_full(rep["party"]) + " Party"},
    }
    if rep.get("url"):
        jsonld["url"] = rep["url"]

    html = TEMPLATE.format(
        title=html_escape(title),
        title_short=html_escape(title_short),
        canonical=canonical,
        desc=html_escape(desc),
        keywords=html_escape(keywords),
        og_image_tag=og_image_tag,
        jsonld=json.dumps(jsonld, indent=2),
        state_slug=state_slug,
        state_name=html_escape(state_name),
        district=district,
        district_label=district_label,
        name=html_escape(rep["name"]),
        party_class=party_class(rep["party"]),
        party_full=party_full(rep["party"]),
        summary=html_escape(summary),
        photo_html=photo_html,
        facts_html=facts_html,
        district_paragraph=html_escape(district_paragraph),
        delegation_paragraph=html_escape(delegation_paragraph),
        state_seo_paragraph=html_escape(state_seo_paragraph),
    )

    # Output path: states/<state-slug>/district-<n>/<rep-slug>.html
    # Folder matches the URL segment exactly so a simple splat rule works:
    #   /state/*  →  /states/:splat.html
    out_dir = os.path.join(OUTPUT_BASE, state_slug, "district-{}".format(district))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, rs + ".html")
    with io.open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    return out_path


def ordinal(n):
    """Convert a number to its ordinal string: 1→1st, 2→2nd, 3→3rd, 21→21st, ..."""
    if 10 <= (n % 100) <= 20:
        return "{}th".format(n)
    return "{}{}".format(n, {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th"))


# Generate all current reps
written = []
for r in REPS:
    if not r["state_abbr"] or r["district"] is None:
        continue
    state_name = ABBR_TO_NAME.get(r["state_abbr"])
    if state_name == "District of Columbia":
        continue  # non-voting delegate, not pre-rendered
    p = build_one_page(r)
    if p:
        written.append(p)

print("\nGenerated {} rep pages".format(len(written)))
print("  output: " + OUTPUT_BASE + "/<state>/district-<n>/<rep>.html")

# ─────────────────────────────────────────────────────────────────────────
# 9. Regenerate sitemap.xml — includes main pages, state pages, and all
#    435 rep pages.
# ─────────────────────────────────────────────────────────────────────────
TODAY = datetime.date.today().isoformat()
sitemap_path = os.path.join(ROOT, "sitemap.xml")

# Build full URL list
urls = [
    ("/", "1.0", "weekly"),
    ("/redistricting-tracker", "0.9", "weekly"),
    ("/legal-tracker", "0.9", "weekly"),
    ("/vote-gap", "0.7", "monthly"),
    ("/follow-the-money", "0.6", "monthly"),
    ("/ftm-nj", "0.5", "monthly"),
    ("/ftm-wi", "0.5", "monthly"),
    ("/about", "0.3", "yearly"),
]
# State URLs (51)
for nm in STATE_ABBR:
    sg = nm.lower().replace(" ", "-")
    urls.append(("/state/" + sg, "0.6", "monthly"))
# Rep URLs (all generated)
for r in REPS:
    if not r["state_abbr"] or r["district"] is None:
        continue
    state_name = ABBR_TO_NAME.get(r["state_abbr"])
    if not state_name or state_name == "District of Columbia":
        continue
    state_slug = state_name.lower().replace(" ", "-")
    rs = rep_slug(r["name"])
    url = "/state/{}/district-{}/{}".format(state_slug, r["district"], rs)
    urls.append((url, "0.5", "monthly"))

out = ['<?xml version="1.0" encoding="UTF-8"?>',
       '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for path, prio, freq in urls:
    out.append("  <url>")
    out.append("    <loc>{}{}</loc>".format(ORIGIN, path))
    out.append("    <lastmod>{}</lastmod>".format(TODAY))
    out.append("    <changefreq>{}</changefreq>".format(freq))
    out.append("    <priority>{}</priority>".format(prio))
    out.append("  </url>")
out.append("</urlset>")
with io.open(sitemap_path, "w", encoding="utf-8") as f:
    f.write("\n".join(out) + "\n")
print("  sitemap.xml regenerated: {} URLs total".format(len(urls)))
