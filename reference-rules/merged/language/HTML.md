---
layer: language
preset: html
title: HTML
---

# HTML

## Document

- One `h1` per page. Heading levels increase by one; no level is skipped. `enforced-by: html/html-validate`
- `<html lang="...">` names the page language; `dir` is set when the language is right-to-left. `enforced-by: html/html-validate`
- One `<title>` that names the page, a `<meta name="viewport">`, and a `<meta charset="utf-8">`
  first in `<head>`. `enforced-by: html/html-validate`
- Landmarks (`header`, `nav`, `main`, `footer`, `aside`) structure the page. One `main`. `enforced-by: html/html-validate`

## Elements

- Use the element that means the thing: `button` for actions, `a` for navigation with a real
  `href`, `nav` for navigation, `ul` and `ol` for lists, `table` for data, `time` with `datetime`
  for dates, `figure` and `figcaption` for captioned media. `enforced-by: html/html-validate`
- Never a `div` or `span` with a click handler standing in for a button or link. `enforced-by: html/html-validate`
- Every form control has a `label` linked by `for` or wrapping it. Every image has `alt`; a
  decorative image has `alt=""`. `enforced-by: html/html-validate`
- `target="_blank"` links carry `rel="noopener"`. `enforced-by: html/html-validate`
- Boolean attributes are bare (`disabled`, not `disabled="true"`). Attribute values are quoted. `enforced-by: html/html-validate`

## Scripts and Styles

- No inline scripts, no inline event handler attributes (`onclick`), no `javascript:` URLs, no
  inline `style` attributes. Behaviour lives in script files; presentation in stylesheets. `enforced-by: structure/html-scripts`
- `<script type="application/ld+json">` is data and is allowed. `enforced-by: html/html-validate`
- Scripts are `defer` or `type="module"`; nothing blocks parsing. `enforced-by: html/html-validate`
- `document.write`, `innerHTML` with untrusted content, and `insertAdjacentHTML` with untrusted
  content are banned. `enforced-by: structure/html-scripts`

## Templates and Copy

- Visible copy lives in content or configuration, not in script string literals or template
  logic. `enforced-by: structure/html-copy`
- Template placeholders use one syntax for the whole site and name the value they carry. `enforced-by: structure/html-copy`
- A template stays declarative: no logic beyond conditionals and loops the engine provides. `enforced-by: structure/html-copy`
- Generated HTML is deterministic: the same inputs produce byte-identical output. `enforced-by: static-site/build-reproducible`
