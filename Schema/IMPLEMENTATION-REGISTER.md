# Hilston Park Schema Implementation Register

**Audit date:** 2026-09-04
**Source versions:**

- `Hilston-Park-Sitewide-Schema-v1-2026-09-04.csv`
- `Hilston-Park-Page-Specific-Schema-v1-2026-09-04.csv`

## Page-Specific Schema Audit

| Page | Schema required by source | Status | Result |
| --- | --- | --- | --- |
| `educational.html` | Course, VideoObject | Implemented | Both schema types are present. |
| `event.html` | ItemList containing Event entries, VideoObject | Implemented | Both schema types are present. |
| `activity.html` | ItemList containing Service entries | Implemented | Activity ItemList schema is present. |
| `accommodation.html` | LodgingBusiness, VideoObject | Implemented | Both schema types are present. |
| `about.html` | VideoObject | Implemented | VideoObject schema is present. |

## Sitewide Schema Rollout Audit

The sitewide v1 source requires these three entities on every public page:

- Organization: `https://hilstonpark.com/#organization`
- LocalBusiness: `https://hilstonpark.com/#localbusiness`
- WebSite: `https://hilstonpark.com/#website`

### Fully Implemented

All three entities are present on these pages:

- `index.html`
- `educational.html`
- `accommodation.html`
- `about.html`
- `event.html`
- `activity.html`

### Outstanding Sitewide Rollout

The following public pages do not yet contain the three sitewide v1 entities:

- `accessibility.html`
- `blog-thrilling-adventures.html`
- `blogs.html`
- `contact.html`
- `data-complaint.html`
- `gallery.html`
- `legal.html`
- `privacy.html`
- `terms.html`
- `visitors.html`
- All pages within `blog/`

The files in `Archive/`, `Chnages/`, and `New Updates/` are project reference material, not public site pages, and are excluded from this audit.

## Version-Control Status

This register and both v1 source files are intended to be committed together. Future SEO updates must retain these v1 files, add a new dated source file with the next version number, and update this register with the implementation result.