# HTML Naming

## Route and attribute names

<!-- level: all -->

- Use kebab-case file names that match the public route: `about-us.html`, `pricing/index.html`.
  Directory routes end in `index.html` in generated output.
- Name public route segments in lowercase kebab-case with no trailing slash ambiguity: one
  canonical form, with the other redirected.
- Use `id` attributes for anchors, labels, and descriptions, not for styling.
- Name `data-*` attributes in kebab-case for their value, such as `data-device-class`.
- Placeholders follow the engine's convention and name the value.
- Name content files for the route or content they serve, such as `content/legal/privacy.md`.
- Name asset files in kebab-case for their subject and role, such as `hero-phone-dark.webp`. Never use
  `image1.png` or `final-v2.svg`. Generate hashed names rather than writing them by hand.
