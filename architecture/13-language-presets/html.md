# `language:html` and `repository:static-site`

Added because of `yap-landing`: a single static site with vanilla JavaScript, HTML and CSS, no
framework and no TypeScript. It is the simple case, and it sets the floor for how little gspot can
demand.

## `language:html`

### Claims

```text
.html .htm
.hbs .njk .liquid .ejs      (templates, when a template preset is selected)
```

### Tools

| Kind       | Tool                                                  | Notes                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| syntax, style    | **html-validate**                                     | Real validation against the HTML specification, with a rule set and a config. `yap-landing` already uses it, and it is the right choice over `htmlhint`, which is pattern based. |
| format           | Prettier                                              |                                                                                                                                                                                  |
| style, templates | **djlint**                                            | Template linting, selected only when a template language is present                                                                                                              |
| accessibility             | **html-validate** accessibility rules, plus `pa11y` at release | The static rules catch missing alt text, label association and heading order. `pa11y` needs a served page, so it is a `network` requirement.                                              |
| links            | **linkinator**                                        | Crawls the built output. `lychee` checks Markdown and relative links; `linkinator` follows a site. Both are needed and they do different jobs.                                   |
| spelling         | `typos`                                               |                                                                                                                                                                                  |
| secrets          | gitleaks, trufflehog                                  | An inline script tag is a real place for a leaked key                                                                                                                            |
| structure        | preset checks                                           | Below                                                                                                                                                                            |

### Preset checks

Generalised from `yap-landing/quality/site/html/policy.js` and `quality/config/html/policy.js`,
which are the right ideas bound to one site:

| Check                           | Enforces                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `html/one-h1`                   | Exactly one `h1` per document, and heading levels do not skip                                             |
| `html/meta-required`            | Every page declares a title, a description, a canonical URL and a viewport                                |
| `html/no-inline-style`          | Styling comes from a stylesheet, so the CSS token rules apply to it                                       |
| `html/no-inline-script`         | Scripts come from a file, so the JavaScript rules apply to them. An inline script is invisible to ESLint. |
| `html/asset-references-resolve` | Every `src` and `href` pointing inside the repository resolves to a tracked file                          |
| `html/generated-declared`       | A generated page carries its producer, per `[[declare]]`                                                  |

`html/no-inline-script` is the one that matters most for coverage: an inline `<script>` block is
JavaScript that no JavaScript linter reads, and it is the HTML equivalent of the shell heredoc
problem in [bash.md](bash.md). Where inline scripts are unavoidable, the preset extracts them and
hands them to `language:javascript` through stdin, exactly as Vale handles borrowed grammars.

### Required kinds

```text
.html .htm     format syntax style accessibility links structure spelling secrets
templates      format syntax style spelling
```

No `prose`: Vale has no HTML comment-only mode, and the visible text of a page is product copy
rather than documentation. A marketing page's copy is out of scope, per D-17.

## `repository:static-site`

Requires `language:html`, `language:css`, `language:javascript`.

For a repository that builds a site from sources rather than running a server. `yap-landing` builds
with `esbuild` plus a custom pipeline and serves from Cloudflare.

| Check                        | Enforces                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `site/build-reproducible`    | Building twice from a clean tree produces identical output                                              |
| `site/output-not-tracked`    | Build output is git-ignored, or declared generated with its producer                                    |
| `site/dead-css`              | **purgecss** against the built output, which resolves usage exactly rather than scanning source strings |
| `site/dead-assets`           | Every tracked asset is referenced from the built output. `repository:assets` does the counting.         |
| `site/bundle-limit`          | **size-limit** with a byte ceiling per entry point, failing on regression                               |
| `site/links`                 | **linkinator** over the built output, a `network` requirement                                                    |
| `site/no-leaked-build-input` | No source map, no `.env` value and no debug flag in production output                                   |
| `site/svg-normalised`        | **svgo** in check mode, so SVG diffs are readable                                                       |
| `site/redirects-resolve`     | Every entry in a redirects or headers file names a path that exists                                     |
| `site/robots-and-sitemap`    | Present, valid, and consistent with the built page set                                                  |

`site/dead-css` against the built output is a real improvement on the design in [css.md](css.md),
which scans source for class-name strings and reports unresolvable dynamic composition. Purging
against built HTML resolves the question exactly, at the cost of requiring a build, so the preset runs
the exact check at a `build` requirement and the source scan at no requirement.

### What this preset replaces

`yap-landing/quality/` has 118 files. The static-site-specific ones:

| Path                                                                                                                          | Fate                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `quality/site/html/policy.js`, `quality/config/html/policy.js`                                                                | `html/*` preset checks                                                                                                                                                                                                                                                     |
| `quality/config/html/{copy.js,generated.json,templates.json}`                                                                 | `[[declare]]` plus the preset's template declaration                                                                                                                                                                                                                       |
| `quality/site/css/dead.js`                                                                                                    | `purgecss`, invoked directly rather than imported from a wrapper                                                                                                                                                                                                         |
| `quality/site/links/check.mjs`                                                                                                | `linkinator`                                                                                                                                                                                                                                                             |
| `quality/site/madge.config.cjs`                                                                                               | `import-x/no-cycle`                                                                                                                                                                                                                                                      |
| `quality/site/lizard/false-positives`, `.whitelizard`, `quality/repository/complexity/run.sh`, `quality/config/complexity.sh` | Lizard is dropped in favour of `sonarjs/cognitive-complexity`, which already runs and does not disagree with a second metric. The baseline-with-staleness-check pattern in `run.sh` is adopted as the baseline, so the mechanism survives even though the tool does not. |
| `quality/site/jscpd/{css,js}.json`                                                                                            | `repository:duplication`, one config                                                                                                                                                                                                                                     |
| `quality/config/complexity.sh`, `quality/repository/complexity/run.sh`                                                        | `sonarjs/cognitive-complexity`                                                                                                                                                                                                                                           |
| `quality/shared/**` (50-plus files)                                                                                           | The shared presets, identical to the other repositories                                                                                                                                                                                                                    |

## Where a simple project is currently weak

`yap-landing` is the reference for this shape, and reading it against the tool set shows eight gaps.
Each one makes a simple project measurably stricter, and each has an off-the-shelf tool. This is the
answer to "what does a project like this actually need".

### 1. Plain JavaScript gets no type checking at all

The largest gap by far. `yap-landing` has 118 JavaScript files, ESLint with six plugins, and **no
type checker**. A TypeScript project in the same set gets `tsc --noEmit` with eight strict compiler
flags. The plain-JavaScript project gets none of that, so every type error ships.

The fix costs no build change and no rewrite:

```jsonc
// tsconfig.json for a plain-JavaScript project
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,          // type check .js files
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

`checkJs` runs the full TypeScript checker over `.js` files, taking types from JSDoc annotations and
inference. Types come from comments rather than syntax, so nothing about the build, the output or
the runtime changes.

`language:javascript` therefore claims the `types` kind, and the required kinds for `.js` gains it. A
plain-JavaScript file with no type coverage becomes `partial`, which is the correct report:
the reference repository has zero type checking and nothing says so.

Paired with it: **`type-coverage`** works on `checkJs` projects and enforces a percentage of fully
typed expressions, so `any` leakage through untyped JSDoc is measurable rather than invisible.

### 2. DOM injection is unchecked

A static site's JavaScript exists to touch the DOM. `innerHTML`, `insertAdjacentHTML`,
`document.write` and `outerHTML` are the injection surface, and `eslint-plugin-security` does not
cover them.

**`eslint-plugin-no-unsanitized`** does exactly this: it fails any assignment to a sink like
`innerHTML` unless the value passes a declared sanitizer. For a repository whose whole product is
rendered markup, this is the single most valuable security rule available, and no reference
repository has it.

### 3. Browser support is declared and unenforced

`yap-landing` targets browsers through `browserslist` and checks nothing against it. Two tools close
that:

- **`eslint-plugin-compat`** fails a JavaScript API call that the declared browser set does not
  support.
- **`stylelint-no-unsupported-browser-features`** does the same for CSS.

Without them, `browserslist` is a comment. This is the enforcement-on-paper pattern in a place
nobody looks.

### 4. Inline scripts and handlers: already solved, worth generalising

This one is **not** a gap. `yap-landing/quality/config/html/policy.js` already bans inline
`<script>` (allowing `application/ld+json`), `on*` attributes, `javascript:` URLs and
`document.write`, with a written message for each. It is the fullest HTML policy in the reference
set and it is 17 lines of configuration plus a checker.

Two things generalise from it:

- **The four bans become preset checks**, because every HTML project wants them.
  `html/no-inline-script`, `html/no-inline-handler`, `html/no-javascript-url`,
  `html/no-document-write`.
- **The `ld+json` allowance is the right shape.** Structured data is data, not code, so the ban
  carries a type allowlist rather than an exemption per file.

What gspot adds is the extraction path: where a build genuinely needs an inline block, the preset
hands it to `language:javascript` through stdin rather than only banning it.

`yap-landing` also lints the built output with a second `html-validate` config that disables five of
its seven rules. The preset does not do that: it lints source only, and asserts invariants on the
output instead. See "What to reject" in [01-findings.md](../01-findings.md).

HTML gets one rule engine, `html-validate`, which already carries `require-img-alt`,
`no-duplicate-id`, `require-lang` and `no-inline-style`. Policy the engine lacks is a preset check.

### 5. The design system is unenforced, and ten standard rules are off

`yap-landing/.stylelintrc.json` extends `stylelint-config-standard` and then disables ten rules:
`alpha-value-notation`, `color-function-alias-notation`, `color-function-notation`,
`color-hex-length`, `comment-empty-line-before`, `declaration-block-single-line-max-declarations`,
`keyframes-name-pattern`, `media-feature-range-notation`, `rule-empty-line-before`, and a narrowed
`property-no-vendor-prefix`. None carries a reason.

Eight of the ten are notation choices that a formatter settles. Under gspot they move into the
`[format]` block and stop being disabled rules, and the two that remain become counted against the
limit entries with a reason and an owner.

No stylelint plugin is installed. `slopshop/CLEANUP.md` section 22 describes a styling system with
three words for layered UI and one word with seven homes, and `yap-landing` has a single
`styles.css` with literal values throughout. Both are the same problem, and four plugins fix it with
no original code:

| Plugin                                     | Enforces                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| **`stylelint-declaration-strict-value`**   | Colour, spacing, radius and font values come from custom properties, never literals  |
| **`stylelint-order`**                      | A declared property order, so diffs are readable                                     |
| **`stylelint-plugin-defensive-css`**       | Background shorthand safety, `flex-wrap`, scroll chaining, custom-property fallbacks |
| **`stylelint-high-performance-animation`** | Animating a property that triggers layout                                            |

### 6. Accessibility is checked by nothing

`html-validate` carries some accessibility rules and `@html-eslint` adds `require-img-alt` and
`require-lang`. Static rules reach heading order, label association, alternative text and language
declaration. They do not reach contrast or focus order, which need a rendered page.

So the preset splits it: static rules at no requirement, and **`pa11y`** against the built output at
a `network` requirement, in the release gate. Stated rather than implied, because a static site that fails
contrast ships.

### 7. Nothing measures the output

A static site's product is bytes delivered to a browser, and no reference repository measures them.

| Tool                                  | Gate                                                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **`size-limit`**                      | A byte ceiling per entry point, failing on regression                                                           |
| **`lighthouse-ci`**                   | Assertions on Largest Contentful Paint, Cumulative Layout Shift and Total Blocking Time, with a limit per route |
| Preset check `html/image-dimensions`    | Every `img` declares width and height, so layout does not shift                                                 |
| Preset check `html/modern-image-format` | Every raster asset has a WebP or AVIF sibling                                                                   |

`html/image-dimensions` is worth naming: `yap-landing` tracks 982 images across the reference set
and a missing dimension pair is the most common cause of layout shift.

### 8. Delivery configuration is unvalidated, and there is no Content Security Policy

`yap-landing` tracks `_headers`, `_redirects`, `robots.txt`, `site.webmanifest` and `404.html`.
Nothing validates any of them.

`_headers` sets `X-Frame-Options`, `X-Robots-Tag`, `X-Content-Type-Options` and `Referrer-Policy`.
It sets **no `Content-Security-Policy`**. For a site whose product is rendered markup, that is the
one header that matters most, and its absence is the strongest single finding in this section.

| File               | Check                                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `_headers`         | Header syntax; a Content Security Policy that parses, with no `unsafe-inline` and no wildcard source; the required security header set present |
| `_redirects`       | Every source and destination parses; no loop; no unreachable rule shadowed by an earlier one                                                   |
| `site.webmanifest` | Schema, plus every icon path resolves                                                                                                          |
| `robots.txt`       | Syntax, plus consistency with the sitemap and the built page set                                                                               |
| `404.html`         | Exists and is reachable through the delivery configuration                                                                                     |

The Content Security Policy check is the one with teeth. A static site's only real defence against
injected script is its policy header, and a policy with `unsafe-inline` is a policy that does
nothing.

## The resulting strictness, compared

| Kind                                  | `yap-landing` today                                                 | Under gspot                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| JavaScript types                            | none                                                                | `tsc --checkJs --strict` plus `type-coverage`                                    |
| DOM injection                               | none                                                                | `eslint-plugin-no-unsanitized`                                                   |
| Browser support                             | `browserslist`, unenforced                                          | `eslint-plugin-compat`, `stylelint-no-unsupported-browser-features`              |
| Inline script and handlers                  | invisible                                                           | banned, or extracted and linted                                                  |
| HTML conformance                            | `html-validate` over source, plus a weaker second pass over `dist/` | `html-validate` over source only, plus preset checks for policy                    |
| Inline script, handlers, `javascript:` URLs | bespoke policy, complete                                            | the same four bans as preset checks, plus extraction                               |
| Accessibility                               | none                                                                | static rules, plus `pa11y` at release                                            |
| Design tokens                               | none                                                                | `stylelint-declaration-strict-value`                                             |
| CSS robustness                              | `stylelint-config-standard`                                         | plus three plugins                                                               |
| Output size                                 | none                                                                | `size-limit`                                                                     |
| Page performance                            | none                                                                | `lighthouse-ci` limits                                                           |
| Images                                      | none                                                                | dimensions, modern format, orphan detection                                      |
| Delivery config                             | none                                                                | headers, redirects, manifest, robots                                             |
| Content Security Policy                     | absent                                                              | required, parsed, no `unsafe-inline`, no wildcard                                |
| stylelint rules                             | 10 standard rules off, no reasons                                   | 8 resolved by `[format]`, 2 counted against the limit with reasons               |
| Dead CSS                                    | `purgecss`, wrapped in bespoke code                                 | `purgecss`, invoked directly                                                     |
| Links                                       | `linkinator`                                                        | `linkinator` plus `lychee`                                                       |
| Complexity                                  | Lizard with a validated baseline                                    | `sonarjs/cognitive-complexity`, with the baseline mechanism kept as the baseline |

Seventeen rows. Twelve go from nothing to a maintained tool, two replace bespoke code with
configuration, and none needs original code.

Two rows go the other way, and both are worth stating: `yap-landing`'s HTML policy and its
two-required kinds `html-validate` setup are better than the gspot draft was, and both are adopted rather
than replaced.

## Why this is the floor

`yap-landing` is the smallest reference repository and it still carries 118 files of quality
tooling, a five-file rule corpus, 15 mise tasks, a `.qlty` directory, two git hooks and 33 dev
dependencies. Under gspot it selects seven presets and writes one `gspot.toml`.

If the design does not make this repository both simpler and stricter, it is not worth adopting
anywhere. A monorepo absorbs tooling overhead and a small project does not, and a simple project is
where unchecked code hides most easily: there is no type checker, no framework contract and no
reviewer expecting complexity. The test is in [18-proof.md](../18-proof.md) for the monorepo and in
`fixtures/single-project/` for this one.
