# `html`

Kind: language. Requires: formatting. Recommends: spelling.

## Detects and claims

|                      |                                                                    |
| -------------------- | ------------------------------------------------------------------ |
| Detect               | `.html`, `.htm` in the tree outside build output                   |
| Claims               | `.html`, `.htm`; inline `<script>` bodies are handed to javascript |
| Required inspections | format, syntax, style, structure, spelling                         |

## Tools

html-validate, prettier; tree-sitter html inside gspot.

## Generated configuration

| Target                                | Stub                 | Holds                                                                                                                                                                                    |
| ------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gspot/html-validate-templates.json` | `.htmlvalidate.json` | `html-validate:recommended`, `doctype-style: lowercase`, `element-required-attributes`, `no-inline-style`, `no-raw-characters`, `void-style: selfclosing`, `wcag/h37`; `no-autoplay` off |
| `.gspot/html-validate-built.json`     | none                 | recommended with the template-only rules off; `wcag/h37` on; used by static-site over built output                                                                                       |

## Checks

| Id                   | Stage  | Command                                                                                                                                                                                                                                     |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `html/html-validate` | commit | `html-validate --config .gspot/html-validate-templates.json {files}`                                                                                                                                                                        |
| `html/copy`          | commit | no hard-coded user-facing text in template files: text nodes, `alt`, `aria-label`, `aria-description`, `placeholder`, `title`, and button, input and option values are placeholders only; `[tools.html] copy_excluded` names the exceptions |
| `html/scripts`       | commit | no executable inline script except `application/ld+json`, no `on*` handlers, no `javascript:` URLs, no `document.write`                                                                                                                     |

`html/scripts` refuses executable inline script, so no inline script body is left for ESLint to
read, and the earlier row for it is gone. `html/copy` runs only over `tools.html.template_files`.

## Settings

`tools.html-validate.rules` (per-rule options; off is a `gspot ignore --rule`), `tools.html.template_files`, `tools.html.copy_excluded`
(paths with reasons), `tools.html.inline_script_types`.

## Rule files

`language/HTML.md`, `language/naming/HTML.md`, `repository/static-site/STATIC-SITE.md`.
