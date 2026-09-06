# SEO Control Centre

This static site has no root `package.json` and no build step. Run the SEO tools directly with Node:

```sh
node seo/check-seo.mjs
node seo/apply-seo.mjs --dry-run
node seo/apply-seo.mjs
```

Edit `seo/seo.json` as the source of truth. Existing titles, descriptions, canonicals, and JSON-LD were lifted from the live HTML pages; do not invent SEO copy in this file.

This pass does not write `sitemap.xml`, `robots.txt`, or `vercel.json`. The injector can preview those generated outputs with:

```sh
node seo/apply-seo.mjs --dry-run --site-file-diffs
```
