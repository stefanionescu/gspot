---
layer: language
preset: html
title: HTML Naming
---

# HTML Naming

- File names are kebab-case and match the public route: `about-us.html`, `pricing/index.html`.
  Directory routes end in `index.html` in generated output.
- Public routes are lowercase kebab-case path segments with no trailing slash ambiguity: one
  canonical form, with the other redirected.
- `id` attributes are kebab-case and unique per page; they exist for anchors, labels, and
  descriptions, not for styling.
- `data-*` attributes are kebab-case and name the value they carry (`data-device-class`).
- Template placeholders are `UPPER_SNAKE_CASE` in one delimiter style for the whole site and
  name the thing replaced (`PAGE_TITLE`, `ASSET_STYLES_CSS`).
- Content files are named for the route or content owner they feed (`content/legal/privacy.md`).
- Asset files are kebab-case and describe the subject and role (`hero-phone-dark.webp`), never
  `image1.png` or `final-v2.svg`. Hashed names are generated, not hand-written.
- Landing or campaign variants carry a short audience or campaign name, not a number.
