# SEO Control Centre

This static site has no root `package.json` and no build step. Run the SEO tools directly with Node:

```sh
node seo/check-seo.mjs
node seo/apply-seo.mjs --dry-run
node seo/apply-seo.mjs
```

Edit `seo/seo.json` as the source of truth. Existing titles, descriptions, canonicals, and JSON-LD were lifted from the live HTML pages; do not invent SEO copy in this file.

## Hosted admin

The hosted admin lives at `/seo`. It is backed by Vercel serverless functions and fails closed until these Vercel environment variables are set:

```text
SEO_ADMIN_USERNAME
SEO_ADMIN_PASSWORD_SHA256
SEO_SESSION_SECRET
GITHUB_TOKEN
GITHUB_REPO
GITHUB_BRANCH=main
```

Generate the password hash locally with:

```sh
node -e "const crypto=require('node:crypto'); console.log(crypto.createHash('sha256').update(process.argv[1]).digest('hex'))" 'your-password-here'
```

Use a fine-grained GitHub token with contents read/write access to this repository. The admin commits changes to `seo/seo.json`, regenerates the managed HTML head blocks, and updates `sitemap.xml`.

The injector writes managed page metadata and `sitemap.xml`. It does not write `robots.txt` or `vercel.json`. It can preview generated site-file outputs with:

```sh
node seo/apply-seo.mjs --dry-run --site-file-diffs
```
