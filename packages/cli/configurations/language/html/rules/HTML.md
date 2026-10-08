---
title: HTML
---

# HTML

## Document

- `<html lang="...">` names the page language; `dir` is set when the language is right-to-left.
- One `<title>` that names the page, a `<meta name="viewport">`, and a `<meta charset="utf-8">`
  first in `<head>`.
- Landmarks (`header`, `nav`, `main`, `footer`, `aside`) structure the page. One `main`.

## Elements

- Use the element that means the thing: `button` for actions, `a` for navigation with a real
  `href`, `nav` for navigation, `ul` and `ol` for lists, `table` for data, `time` with `datetime`
  for dates, `figure` and `figcaption` for captioned media.
- Never a `div` or `span` with a click handler standing in for a button or link.
- `target="_blank"` links carry `rel="noopener"`.

## Script safety

- Use `defer` or `type="module"` for scripts that do not need to block parsing.

## Templates and copy

<!-- level: all -->

- A template stays declarative: no logic beyond conditionals and loops the engine provides.
- Generated HTML is deterministic: the same inputs produce byte-identical output.
