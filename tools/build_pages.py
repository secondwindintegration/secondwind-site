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
    'start': ('Where are your hours going? | Second Wind Integration',
              "Tell us about your shop and we'll show you what we can take off your plate. Book a free Shop Tech Check with Jake over Zoom."),
    'privacy': ('Privacy policy | Second Wind Integration',
                'How Second Wind Integration collects, uses and looks after your information, under the Australian Privacy Principles.'),
}

src = (ROOT / 'index.html').read_text(encoding='utf-8')

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
