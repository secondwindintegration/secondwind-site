"""Make a copy of index.html for each page (prices.html, about.html ...) with that page's
own title, description and link, so Google and Facebook see the right details for every page.
Netlify runs this on every deploy (see netlify.toml), so only ever edit index.html."""
import html, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = 'https://secondwindintegration.com'
PAGES = {
    'services': ('What we do | Second Wind Integration',
                 'What we set up for shop owners: a website chat helper, missed-call text back, invoice reminders, social posts and email replies, all on your own accounts and approved by you.'),
    'prices': ('Packages and prices | Second Wind Integration',
               'Packages and prices: a free Shop Tech Check, then Kickstart, Shop Assistant and Online Shop, plus month-to-month Care plans. Founding Shop places available.'),
    'projects': ('Past projects | Second Wind Integration',
                 "What we set up for Julia's Fabric Boutique: a new website and online shop, and weekly Facebook posts the owner checks and approves in a few minutes."),
    'about': ('About Jake | Second Wind Integration',
              'Meet Jake McGrath from Second Wind Integration. We help shop owners all over Australia get hours back every week, over Zoom, and you can always ring us.'),
    'contact': ('Contact Jake | Second Wind Integration',
                'Ring Jake on 0417 813 548, send us a message, or book a free Shop Tech Check over Zoom. We reply by the next business day.'),
    'start': ('Less paperwork after closing time | Second Wind Integration',
              "Book a free 30-minute Zoom chat with Jake. We'll look at where your hours go and show you what we'd set up, using the tools you already have."),
    'privacy': ('Privacy policy | Second Wind Integration',
                'How Second Wind Integration collects, uses and looks after your information, under the Australian Privacy Principles.'),
}

src = (ROOT / 'index.html').read_text(encoding='utf-8')

# The thank-you email (netlify/lib/autoresponder.mjs) only answers forms whose name and source
# are in its ENQUIRY_FORMS and ENQUIRY_SOURCES lists. If a form here is renamed without updating
# those lists, the emails would silently stop, so stop the deploy instead.
def mjs_set(name, js):
    m = re.search(rf'{name} = new Set\(\[([^\]]*)\]\)', js)
    if not m:
        raise SystemExit(f'build_pages: could not find {name} in autoresponder.mjs')
    return set(re.findall(r"'([^']+)'", m.group(1)))

js = (ROOT / 'netlify' / 'lib' / 'autoresponder.mjs').read_text(encoding='utf-8')
known_forms, known_sources = mjs_set('ENQUIRY_FORMS', js), mjs_set('ENQUIRY_SOURCES', js)
lead_forms = re.findall(r'<form class="[^"]*\blead-form\b[^>]*>.*?</form>', src, re.S)
if not lead_forms:
    raise SystemExit('build_pages: found no lead forms in index.html')
for f in lead_forms:
    form_name = re.search(r'name="form-name" value="([^"]*)"', f)
    source = re.search(r'name="source" value="([^"]*)"', f)
    if not form_name or form_name.group(1) not in known_forms:
        raise SystemExit(f'build_pages: form-name {form_name and form_name.group(1)!r} is not in ENQUIRY_FORMS in netlify/lib/autoresponder.mjs')
    if not source or source.group(1) not in known_sources:
        raise SystemExit(f'build_pages: source {source and source.group(1)!r} is not in ENQUIRY_SOURCES in netlify/lib/autoresponder.mjs')
print('checked', len(lead_forms), 'enquiry forms against the thank-you email lists')

def sub(pattern, repl, text):
    out, n = re.subn(pattern, lambda m: repl, text, count=1)
    if n != 1:
        raise SystemExit(f'build_pages: could not find {pattern!r} in index.html')
    return out

for pid, (title, desc) in PAGES.items():
    t, d, url = html.escape(title), html.escape(desc), f'{SITE}/{pid}'
    page = src
    page = sub(r'<title>[^<]*</title>', f'<title>{t}</title>', page)
    page = sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{d}">', page)
    page = sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{t}">', page)
    page = sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{d}">', page)
    page = sub(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{url}">', page)
    page = sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{url}">', page)
    # show this page (not the homepage) before any script runs
    page = sub(r'<main class="page" id="home">', '<main class="page" id="home" hidden>', page)
    page = sub(rf'<main class="page" id="{pid}" hidden>', f'<main class="page" id="{pid}">', page)
    (ROOT / f'{pid}.html').write_text(page, encoding='utf-8')
    print('built', f'{pid}.html')
