---
layer: language
configuration: html
title: HTML
---

# HTML

## Document

- One `h1` per page. Heading levels increase by one; no level is skipped.
- `<html lang="...">` names the page language; `dir` is set when the language is right-to-left.
- One `<title>` that names the page, a `<meta name="viewport">`, and a `<meta charset="utf-8">`
  first in `<head>`.
- Landmarks (`header`, `nav`, `main`, `footer`, `aside`) structure the page. One `main`.

## Elements

- Use the element that means the thing: `button` for actions, `a` for navigation with a real
  `href`, `nav` for navigation, `ul` and `ol` for lists, `table` for data, `time` with `datetime`
  for dates, `figure` and `figcaption` for captioned media.
- Never a `div` or `span` with a click handler standing in for a button or link.
- Every form control has a `label` linked by `for` or wrapping it. Every image has `alt`; a
  decorative image has `alt=""`.
- `target="_blank"` links carry `rel="noopener"`.
- Boolean attributes are bare (`disabled`, not `disabled="true"`). Attribute values are quoted.

## Scripts and styles

- No inline scripts, no inline event handler attributes (`onclick`), no `javascript:` URLs, no
  inline `style` attributes. Behavior lives in script files; presentation in stylesheets.
- `<script type="application/ld+json">` is data and is allowed.
- Scripts are `defer` or `type="module"`; nothing blocks parsing.
- `document.write`, `innerHTML` with untrusted content, and `insertAdjacentHTML` with untrusted
  content are banned.

## Templates and copy

- Visible copy lives in content or configuration, not in script string literals, or template
  logic.
- Template placeholders use one syntax for the whole site and name the value they carry.
- A template stays declarative: no logic beyond conditionals and loops the engine provides.
- Generated HTML is deterministic: the same inputs produce byte-identical output.
