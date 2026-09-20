---
title: "HTML"
description: "HTML files: html-validate for structure and accessibility, no inline script or handler, and templates that hold placeholders in place of copy."
---

HTML files: html-validate for structure and accessibility, no inline script or handler, and templates that hold placeholders in place of copy.

Kind: language. Requires: `formatting`.

## Tools

- html-validate 11.6.1

## Generated configuration

- `.gspot/html-validate-templates.json`
- `.gspot/html-validate-built.json`

## Checks

| Check                                                        | Stage  | What it finds                                                                                                                    |
| ------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| [`html/html-validate`](/reference/rules/html/html-validate/) | commit | Validates every HTML file: elements where they may sit, required attributes, text alternatives, and one style for void elements. |
| [`html/scripts`](/reference/rules/html/scripts/)             | commit | Refuses executable inline script, event handler attributes, javascript: links, and document.write in HTML files.                 |
| [`html/copy`](/reference/rules/html/copy/)                   | commit | In the template files named by tools.html.template_files, checks that text a person reads is a placeholder and never a literal.  |

## Settings

- `tools.html.template_files`: The HTML files that are templates filled from content; empty turns the copy check off.
- `tools.html.copy_excluded`: Template paths that may hold literal text, each with a reason.

## Rule files

- `language/HTML.md`
- `language/naming/HTML.md`
