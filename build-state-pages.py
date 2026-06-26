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
    out = []
    for L in legislators:
        terms = L.get("terms") or []
        if not terms: continue
        last = terms[-1]
        if last.get("type") != "rep" or last.get("state") != abbr: continue
        end = last.get("end") or ""
        if end and end < "2025-01-03": continue
        nb = L.get("name") or {}
        official = nb.get("official_full") or ((nb.get("first") or "") + " " + (nb.get("last") or "")).strip()
        out.append({"name": official, "party": (last.get("party") or "").strip(),
                    "district": last.get("district")})
    out.sort(key=lambda r: 999 if r["district"] is None else r["district"])
    return out

def party_short(p):
    p = (p or "").lower()
    if p.startswith("democ"): return "D"
    if p.startswith("repub"): return "R"
    return (p[:1].upper() or "I")

# ── 5. Build the collapsible "About this state" block ────────────────────
def build_seo_section(state_name):
    abbr = STATE_ABBR.get(state_name)
    reps = reps_for_state(abbr) if abbr else []
    deleg = DELEGATION.get(state_name) or {}
    d_count, r_count = deleg.get("d", 0), deleg.get("r", 0)
    total = d_count + r_count
    redis = REDISTRICTING.get(state_name)

    # Opening paragraph
    parts = []
    if total == 1:
        parts.append("{n} has one at-large U.S. House district covering the entire state in the 119th Congress.".format(n=state_name))
    else:
        parts.append("{n} has {t} U.S. House congressional districts \u2014 {d} held by Democrats and {r} held by Republicans in the 119th Congress (2025-2027).".format(n=state_name, t=total, d=d_count, r=r_count))

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
