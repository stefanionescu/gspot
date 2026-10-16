# HTML

Read this rule when you change HTML or an HTML template.

## Document

- `<html lang="...">` names the page language; set `dir` for a right-to-left language.
- One `<title>` that names the page, a `<meta name="viewport">`, and a `<meta charset="utf-8">`
  first in `<head>`.
- Landmarks such as `header`, `nav`, `main`, `footer`, and `aside` structure the page. One `main`.

## Elements

- Use the element that means the thing: `button` for actions, `a` for navigation with a real
  `href`, `nav` for navigation, `ul` and `ol` for lists, `table` for data, `time` with `datetime`
  for dates, `figure` and `figcaption` for captioned media.
- `target="_blank"` links carry `rel="noopener"`.

## Script safety

- Use `defer` or `type="module"` for scripts that do not need to block parsing.

## Templates and copy

<!-- level: all -->

- A template stays declarative: no logic beyond conditionals and loops the engine provides.
- Generate deterministic HTML: the same inputs produce byte-identical output.

## Naming

### Route and attribute names

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
