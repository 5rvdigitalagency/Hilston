#!/usr/bin/env python3
"""
update_html.py — Hilston Park
Inserts GTM + Cookie Consent snippets into all HTML pages.
Run once from the project root.
"""

import os
import glob

BASE = os.path.dirname(os.path.abspath(__file__))

# ── Snippets to insert ────────────────────────────────────────────────────────

HEAD_INSERT = (
    "  <!-- Cookie Consent — loads before GTM to initialise Consent Mode v2 -->\n"
    "  <link rel=\"stylesheet\" href=\"consent.css\">\n"
    "  <script src=\"consent.js\"></script>\n"
    "  <!-- Google Tag Manager -->\n"
    "  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':\n"
    "  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],\n"
    "  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=\n"
    "  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);\n"
    "  })(window,document,'script','dataLayer','GTM-TDVPHZJJ');</script>\n"
    "  <!-- End Google Tag Manager -->\n"
)

BODY_INSERT = (
    "  <!-- Google Tag Manager (noscript) -->\n"
    "  <noscript><iframe src=\"https://www.googletagmanager.com/ns.html?id=GTM-TDVPHZJJ\"\n"
    "  height=\"0\" width=\"0\" style=\"display:none;visibility:hidden\"></iframe></noscript>\n"
    "  <!-- End Google Tag Manager (noscript) -->\n"
)

FOOTER_OLD = '          <li><a href="privacy.html">Privacy Policy</a></li>\n'
FOOTER_NEW = (
    '          <li><a href="privacy.html">Privacy Policy</a></li>\n'
    '          <li><a href="#" class="cookie-pref-link" '
    'onclick="if(window.hilstonConsent){window.hilstonConsent.open();}return false;">'
    'Cookie Preferences</a></li>\n'
)

HEAD_ANCHOR  = "<head>\n"
BODY_ANCHOR  = "<body>\n"

# ── Process each HTML file ────────────────────────────────────────────────────

html_files = sorted(glob.glob(os.path.join(BASE, "*.html")))
print(f"Found {len(html_files)} HTML files.\n")

results = {"ok": 0, "skipped_gtm": 0, "skipped_footer": 0, "errors": []}

for path in html_files:
    filename = os.path.basename(path)
    try:
        with open(path, "r", encoding="utf-8") as f:
            original = f.read()

        content = original

        # ── 1. Insert consent + GTM after <head> ─────────────────────────────
        if "GTM-TDVPHZJJ" in content:
            print(f"  [SKIP-GTM]    {filename} — GTM already present")
            results["skipped_gtm"] += 1
        else:
            if HEAD_ANCHOR in content:
                content = content.replace(HEAD_ANCHOR, HEAD_ANCHOR + HEAD_INSERT, 1)
            else:
                print(f"  [WARN]        {filename} — <head> anchor not found")

        # ── 2. Insert noscript after <body> ───────────────────────────────────
        if "GTM-TDVPHZJJ" not in original:  # only add if we just inserted GTM above
            if BODY_ANCHOR in content:
                content = content.replace(BODY_ANCHOR, BODY_ANCHOR + BODY_INSERT, 1)
            else:
                print(f"  [WARN]        {filename} — <body> anchor not found")

        # ── 3. Add Cookie Preferences link to footer ──────────────────────────
        if "cookie-pref-link" in content:
            print(f"  [SKIP-FOOTER] {filename} — Cookie Preferences link already present")
            results["skipped_footer"] += 1
        elif FOOTER_OLD in content:
            content = content.replace(FOOTER_OLD, FOOTER_NEW, 1)
        else:
            print(f"  [WARN]        {filename} — footer Privacy Policy anchor not found")

        # ── Write if changed ──────────────────────────────────────────────────
        if content != original:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"  [OK]          {filename}")
            results["ok"] += 1
        else:
            print(f"  [NO-CHANGE]   {filename}")

    except Exception as e:
        print(f"  [ERROR]       {filename}: {e}")
        results["errors"].append(filename)

print(f"\nDone — {results['ok']} updated, "
      f"{results['skipped_gtm']} already had GTM, "
      f"{results['skipped_footer']} already had footer link, "
      f"{len(results['errors'])} errors.")
