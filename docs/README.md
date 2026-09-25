# gspot documentation

The manual uses Astro Starlight with four navigation sections: Get started, Guides, Reference,
and Development. Authored guides teach workflows; references come from the
CLI, policy schema, configuration manifests, and standalone plugin definitions.

## Setup and preview

Complete the [source installation](src/content/docs/guides/install.md), then run from the repository root:

```shell
mise run docs:dev
```

Build the site and validate its links before sharing a documentation change:

```shell
mise run docs:build
mise run test:docs
```

The example tests load complete policies through the production reader. With Bash on `PATH`,
run the published defect and correction separately:

```shell
mise run test:bash-example
```

The reference tests cover source-derived commands,
settings, schema fields, and loader updates. The site build checks local links and fragments.
These checks do not prove every prose claim; verify behavior in its implementation and tests.

## Write for the reader's task

Keep the root README focused on evaluation, source setup, a first useful command, and links to
routine workflows. Give each procedure one home. Other pages link to it instead of repeating
its steps. Keep initialization, installation, policy changes, and checking distinct.

A guide starts with prerequisites and the reader's action. Show the default procedure first,
its expected result, and any condition that changes the reader's choice. Put substantial
integration-specific procedures in their own task guide. Use the sidebar sections Get started,
Guides, Reference, and Development.

References describe accepted inputs, defaults, scope, effects, exits, and limitations. Change
the owning CLI help, schema, manifest, or rule definition rather than maintaining a copied
reference page. `src/content/reference/` renders those definitions and rejects duplicate
identities. Every shipped check and plugin rule requires a nonempty Markdown `example` in its
metadata. Describe the defect, correction, and required context there, and exercise that behavior
in the existing tests for its owner. Do not create a second example generator. Keep authored
guidance out of schema dumps and internal module inventories.

## Describe implemented behavior

Trace commands and settings to the source before documenting them. Distinguish a generated
configuration from an executed tool, a compiled artifact from native platform acceptance, and
a configured deployment from a live service. Document a user-visible limitation beside the
affected procedure. Keep audit counts, incomplete implementation work, and acceptance history
in `../architecture/22-remaining.md`.

Use complete policy examples when a reader needs a starting file. Label fragments and name
their destination. State required tools and working directories. Pair diagnostic examples with
a correction and the command that verifies it. Never invent successful output or imply a
manual correction is automatic. The landing page uses the captured JavaScript defect and correction in
`src/components/home/client-environment.json`. The first-check guide points to the complete JavaScript walkthrough.

Use short, direct headings and consistent terms: configuration, check, tool rule, finding, stage,
level, scope, and profile. Remove repeated claims, vague assurances, self-referential openings,
and implementation terminology that does not help the reader act. Retain exact option names,
exit codes, paths, and failure conditions when they define the behavior.

## Fonts and shared styling

The landing page and manual use self-hosted Geist Sans and Geist Mono from the pinned
Fontsource packages. `src/styles/theme.css` imports their CSS; Astro bundles the font files.
The site build retains each package license under `licenses/` in the output. Keep those
licenses with distributed site assets.

## Review the rendered result

Read the README and affected guides in their normal order. Check navigation, code wrapping,
heading hierarchy, mobile width, keyboard access, and both themes when layout changes.
Preserve published routes unless the content itself is retired; changing a title does not
require renaming its URL. Keep navigation labels aligned with page titles.

For release builds, use the [site release procedure](src/content/docs/guides/build.md#released-documentation-and-rollback).
The source version and revision identify the generated references. A local preview is not a
published release.

## Identity and layout assets

The homepage hero, feature grids, setup columns, and closing action adapt the
[Turborepo homepage source](https://github.com/vercel/turborepo/tree/1dead3cc9d421e61327a13cb44a590e8e218793f/apps/docs/app/%5Blang%5D/%28home%29)
to Astro components. The [MIT notice](public/licenses/turborepo.txt) ships with the site.
Starlight owns navigation, search, theme persistence, and code-copy behavior.

The Sweet spot mark and dimensional hero were created with the built-in image generator.
Their source images are `public/brand/identity/mark-generated.png` and `public/brand/home/hero.png`.
The SVG variants and diagrams remain editable. Keep purpose, release status, and commands
as selectable text beside artwork. `public/brand/` also holds README banners and local badges.

Most tool and framework logos come from [Simple Icons](https://github.com/simple-icons/simple-icons) under
[CC0](public/licenses/simple-icons.txt). The tool names identify integrations; they do not
claim sponsorship. Retain the notices when distributing these assets.

### Logo generation prompt

The flat mark used this prompt with the built-in image generator:

> Use case: logo-brand. Create the finished original logo symbol for "gspot", a developer tool for repository rules. This is a professional identity asset for a polished developer website at the quality of Vercel / Turborepo. Design direction: "Sweet spot". One iconic compact abstract symbol, exactly two asymmetric rounded cobalt blue forms that frame a small vivid tangerine circle in their negative space. The shapes should feel intentional, confident, subtly cheeky and beautifully optically balanced, with excellent recognition at favicon sizes. Think precise sculpted curves, not random blobs or a generic chain link. Colors cobalt #2457FF and tangerine #FF7A1A. Flat solid vector-like shapes with crisp smooth edges. Transparent background, centered symbol occupying about 75% of the square canvas. No wordmark, no text, no letters, specifically no letter G, no mascot, no explicit anatomy. No mockup, no gradient, no shadow, no border, no presentation grid. Deliver a single production-ready logo mark.

The dimensional hero uses that generated mark as its visual reference, with cobalt enamel
surfaces, a tangerine center, a slight perspective tilt, and a transparent background.
The editable SVG mark is a vector interpretation of the generated silhouette.

ShellCheck artwork comes from the [VS Code integration](https://github.com/vscode-shellcheck/vscode-shellcheck/blob/master/shellcheck.png) under its [MIT license](public/licenses/shellcheck.txt). The Semgrep symbol is extracted from the [upstream logo](https://github.com/semgrep/semgrep/blob/develop/semgrep.svg), with its [LGPL-2.1 license](public/licenses/semgrep.txt). Names and marks identify supported integrations and do not imply endorsement.
