# gspot documentation

The manual uses Astro Starlight. Authored guides teach workflows; references come from the
CLI, policy schema, preset manifests, and standalone plugin definitions.

## Preview and verify

Complete the [source installation](src/content/docs/guides/install.md), then run from the repository root:

```shell
mise run docs:dev
```

Build the site and validate its links before sharing a documentation change:

```shell
mise run docs:build
bun test ./tests/integration/docs/documentation-examples.test.ts ./tests/integration/docs/reference-pages.test.ts ./tests/integration/docs/site-links.test.ts
```

The example tests load complete policies through the production reader. With Bash on `PATH`,
run the published defect and correction separately:

```shell
bun test --timeout 60000 ./tests/native/docs/bash-example.test.ts
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
integration-specific procedures in their own task guide. Use the sidebar to distinguish
getting started, daily work, integrations, maintenance, and reference lookup.

References describe accepted inputs, defaults, scope, effects, exits, and limitations. Change
the owning CLI help, schema, manifest, or rule definition rather than maintaining a copied
reference page. `src/content/reference.ts` renders those definitions and rejects duplicate
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
manual correction is automatic. The landing page and quickstart share the captured Bash
example in `src/components/bash-syntax.json`.

Use short, direct headings and consistent terms: preset, check, tool rule, finding, stage,
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
