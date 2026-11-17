"""Make a copy of index.html for each page (prices.html, about.html ...) with that page's
own title, description and link, so Google and Facebook see the right details for every page.
Netlify runs this on every deploy (see netlify.toml). Keep PAGES in step with the META
object in index.html."""
import html, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = 'https://secondwindintegration.com'
# Keep these in step with the META object in index.html. Titles stay at 60 characters or under,
# descriptions at 155. The region is where we serve shops, not where Jake lives.
PAGES = {
    'services': ('What we do | AI and tech for Albury Wodonga shops',
                 'Hours back for shops across Albury Wodonga: missed calls, website chat, invoices, posts and email, drafted for you to approve.'),
    'prices': ('Packages and prices | shops across Albury Wodonga',
               'A free Shop Tech Check, then fixed packages for shops across Albury Wodonga. Founding Shops from A$900, agreed in writing.'),
    'projects': ('Past projects | Second Wind for Albury Wodonga shops',
                 "A new website, online shop and weekly posts for Julia's Fabric Boutique. Serving shops across Albury Wodonga."),
    'about': ('About Jake McGrath | shops across Albury Wodonga',
              'Practical AI and tech for independent shops across Albury Wodonga, in plain English.'),
    'contact': ('Ring Jake | serving shops across Albury Wodonga',
                'Serving shops across Albury Wodonga. Ring 0417 813 548 or email jake@secondwindintegration.com to book a free Shop Tech Check.'),
    'start': ('Less paperwork after closing time | Second Wind Integration',
              'Book a free 30-minute Zoom chat. Less paperwork after closing for shops across Albury Wodonga, using the tools you already have.'),
    'privacy': ('Privacy policy | Second Wind, serving Albury Wodonga',
                'How Second Wind Integration, run by Jake McGrath, collects and looks after your information. Serving shops across Albury Wodonga.'),
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
    page, n = re.subn(r'\n?<script type="application/ld\+json" id="local-business">[\s\S]*?</script>', '', page, count=1)
    if n != 1:
        raise SystemExit('build_pages: JSON-LD block missing from index.html')
    (ROOT / f'{pid}.html').write_text(page, encoding='utf-8')
    print('built', f'{pid}.html')
