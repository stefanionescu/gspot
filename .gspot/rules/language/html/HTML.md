# HTML

## Document

- `<html lang="...">` names the page language; set `dir` for a right-to-left language.
- One `<title>` that names the page, a `<meta name="viewport">`, and a `<meta charset="utf-8">`
  first in `<head>`.
- Landmarks such as `header`, `nav`, `main`, `footer`, and `aside` structure the page. One `main`.

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
- Generate deterministic HTML: the same inputs produce byte-identical output.
