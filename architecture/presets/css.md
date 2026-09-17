# css

Kind: language. Requires: formatting, spelling.

## Detects and claims

| | |
| --- | --- |
| Detect | `.css`, `.scss`, `.pcss`, `.module.css` in the tree |
| Claims | the same |
| Required inspections | format, syntax, style, spelling |

## Tools

stylelint, stylelint-config-standard, prettier, purgecss (through static-site), postcss and
postcss-modules (inside gspot, for CSS module usage).

## Generated configuration

| Target | Stub | Holds |
| --- | --- | --- |
| `.gspot/stylelint.json` | `.stylelintrc.json` with `extends` | `stylelint-config-standard`, `no-descending-specificity`, `at-rule-no-unknown`, `function-no-unknown`, `import-notation: string`, `at-rule-prelude-no-invalid`, `property-no-vendor-prefix` with the two ignored properties; the reference repositories' disabled rules stay disabled with their reasons in the template |

## Checks

| Id | Stage | Command |
| --- | --- | --- |
| `css/stylelint` | commit | `stylelint --config .gspot/stylelint.json {files}`; fix, order codemod |
| `css/prettier` | commit | through formatting |
| `integrity/css-usage` | push | CSS modules: every class defined is used, every class used is defined (nextjs) |
| `css/dead-selectors` | push | PurgeCSS over the built output with a safelist (static-site) |

## Settings

`tools.stylelint.rules` (per-rule options; off is a `gspot ignore --rule`), `tools.purgecss.safelist` (reason), `tools.purgecss.content`.

## Rule files

`language/CSS.md`, `language/naming/CSS.md`; `tool/tailwind/TAILWIND.md` when Tailwind is a dependency.
