# The README, the Manual, and the Site

The existing Astro/Starlight project owns the landing page at gspot.dev, the manual, and shared
plain text branding. The root and published package READMEs provide first-use routes. This contract
preserves the full design brief below; [remaining work](22-remaining.md) alone records acceptance.

Verify command and output examples against the documented release. Keep reproducible examples
in their guides or demonstrations and exercise the same behavior through ordinary command tests.
The adoption case study depends on the deferred Yap handoff; introductory examples must work
without access to Yap. No separate documentation fixture system or root examples inventory is required.

## Contents

- [What exists today](#what-exists-today)
- [Reference projects and the quality gap](#reference-projects-and-the-quality-gap)
- [The README](#the-readme)
- [The manual](#the-manual)
- [The site](#the-site)
- [Demonstrations](#demonstrations)
- [Implementation and acceptance](#implementation-and-acceptance)
- [Before launch](#before-launch)
- [Deployment and released documentation](#deployment-and-released-documentation)
- [Reference generation](#reference-generation)

## What exists today

The project already has a custom Astro landing page, Starlight navigation and guides, shared
light/dark tokens and a real finding/correction transcript. The implementation is
visible in `docs/src/pages/index.astro`, `docs/src/styles/theme.css`, and `docs/astro.config.ts`.
The content configuration currently uses Starlight's loader, and `docs/src/content/reference.ts`
loads references into Astro content storage. The reference contract below governs
that content loader. It does not require rebuilding the site shell.

## Reference projects and the quality gap

Use the inspected [Nx content-loader pattern](15-prior-art.md#nx-and-turborepo) for reference
mechanics. The visual brief remains gspot's own terminal field notebook design. Its reader
patterns draw on Starship's clear first action, Charm and Gum's warm terminal demonstrations,
Atuin's visible installation routes, and uv's separation of guides from reference. These are
design influences, not copied artwork or claims of those sites' accessibility. Verify gspot's
rendered experience against the acceptance criteria below.

## The README

A reader needs purpose, release status, a visible result, and a next step in the opening screen.
Use native GitHub Markdown, not a centered HTML marketing layout. Target 700 to 1,000 words,
excluding output; this is an editorial budget, not a reason to omit safety information.
Use a plain lowercase `gspot` title. Do not add decorative illustrations or a separate logo system.
Keep the title, purpose, and release status as selectable text outside the image. The art must
not push the first useful example below a large decorative header.

Use this ordered content brief when rewriting the root README:

1. Title `gspot`. Proposed opening copy: "gspot runs your repository checks and gives coding
   agents the rules to follow." Follow with one sentence about generated configuration for
   existing tools. Publish this wording only once both behaviors are verified for the release.
1. State prerelease status and material platform limits before setup. Do not claim gspot
   detects whether a human or an agent wrote code.
1. A compact, selectable example of one finding: path, check name, explanation, and `help:`.
   Copy it from a test repository run. Link to an optional recording on the site; do not make an
   autoplaying GIF or large banner the entire first screen.
1. `## Install`: prerequisites and one complete recommended installation path. Link to the
   installation guide for alternatives. Show only published, verified mise, npm, or binary
   routes, not placeholder registry commands. Distinguish installing the CLI from running
   repository setup. State downloads and supported operating systems beside the commands.
1. `## First run`: from the repository root, run `gspot init`, review and accept its plan, then
   run `gspot check` separately. Initialization does not run a check. Explain writes to
   `gspot.toml`, generated configuration, locks, and hooks before confirmation. Include the
   route for an existing setup. Do not hide takeover consequences behind `--yes`.
1. `## Use it every day`: a small command-and-purpose table for `check`, `explain`, `apply`,
   and `install`. Explain that teammates run `gspot install` after cloning; gspot does not
   inject a `prepare` script. Link the full command reference instead of listing every command.
1. `## Choose your checks`: one runnable configuration example, one scoped exception with a
   reason, and links to presets and profiles. Explain `recommended` versus `all`: banned names
   and house-style checks belong to `all`. Do not confuse a check name with a tool rule name.
1. `## Adopt and remove`: summarize carryover, retained unsupported configuration, recovery
   copies, and uninstall conflicts. Link the complete recovery procedure. Explain that affected
   project-wide tools can report errors in unchanged files. Describe `git commit --no-verify`
   and `git push --no-verify` as bypassing local hooks. CI and server policy remain enforced.
1. `## Support and help`: summarize verified language and platform support with links to the
   release-matched presets. Link troubleshooting for missing tools and configuration errors.
   Avoid a hand-maintained total of checks as a proxy for support quality.
1. `## Contribute` and `## License`: link contribution instructions, the actual license,
   release notes, and a private security-reporting route once configured. Label architecture
   as contributor design, not the user manual. No badge wall or unverified support address.

The npm-distributed CLI package and `packages/eslint-plugin` each need a short package README.
Use the actual published package name and ensure packaging includes the file. The CLI page
links normal setup; the ESLint plugin page documents its independent import and configuration.
Do not copy the complete root README into every package or assume the source CLI README is the
one npm publishes.

## The manual

The manual provides these tasks with real output:

| Guide                     | The question it answers                                                         |
| ------------------------- | ------------------------------------------------------------------------------- |
| Quick start               | What happens in my first five minutes                                           |
| A repository with a setup | What happens to my hooks, my tasks, my `lint` command, and my old configuration |
| Customize                 | How to take only some of it, turn a rule off and on, and change a limit         |
| Profiles                  | How a team keeps one setup across many repositories                             |
| A check of your own       | How to run my script as part of the gate                                        |
| Hooks and CI              | What runs on commit, on push, and in CI, and how to pass a failing hook         |
| Uninstall                 | How to leave and get my old files back                                          |
| Troubleshooting           | A missing tool, a slow check, a version pin that differs                        |

Guide examples must match the production parser and the ordinary behavioral tests for the
commands they describe. Do not require a universal parser for every prose code block.

Each command gets a worked example on its reference page. `docs/readme-shape` requires the
sections that the README template names, so the README cannot thin out again.

### Navigation and page contracts

Use an explicit task order, not alphabetical guide discovery. Keep the existing guide URLs
where their purpose remains the same. The landing page owns `/`; `/guides/install/` is the
primary start destination. Guides and reference keep their existing URL families, with
`/reference/commands/check/` as the direct command-reference entry. Do not move the entire
manual under `/docs/` just to make room for a landing page.

The sidebar groups are:

- Start: install, quick start, existing repository, joining a configured repository.
- Daily work: findings, customization, presets and profiles, editors, working with agents.
- Integrate: hooks and CI, other CI systems, scopes and monorepos, below the Git root,
  coexistence with existing lint, folders without Git, custom checks.
- Maintain: upgrades, recovery and uninstall, troubleshooting.
- Reference: commands, presets, checks, settings, engines. Keep long lists collapsed.

These are navigation groups, not a requirement for another index page per group. Reuse the
existing guide that owns a task; add only missing tasks. Add a short concepts section to the
customization guide for preset, check, tool rule, finding, level, stage, scope, and profile.
Use the [public vocabulary](README.md#glossary) everywhere, including search labels and `help`.

A guide states starting conditions, commands, expected results, and recovery for consequential
steps. Do not enforce a two-page limit or one command per step when that hides necessary
context. The joining guide must include CLI prerequisites, `gspot install`, and a check before
the first commit. It must not imply that cloning installs the CLI.

Command reference includes inherited options, working directory, input, output, exit status,
side effects, noninteractive behavior, and an example. Check reference includes its name,
purpose, level, stage, scope, a triggering example, a corrected example, and the scoped
exception procedure. Settings reference includes type, default, scope, precedence, and a
complete configuration fragment. Link tool rules to their upstream reference. Keep these
facts with the generator's source definitions, not a second hand-written table.

Keep Starlight search, mobile navigation, heading links, and keyboard access. Validate search
with literal check names, setting names, and common symptoms such as "missing tool." Offer
direct start and reference links even when search scripts fail. Show product version and a
source edit link; generated pages link to the owning definition, never an untracked output.
Retain `llms.txt` from the same release content without creating a second agent-only manual.

## The site

The manual stays Starlight. The landing page is one Astro page in the same project, so one build
serves both, and gspot.dev opens on the landing page.

The header contains the wordmark, Get started, Reference, GitHub, and a theme control. The
landing page answers evaluation questions; it does not repeat every guide. Its sections are:

1. Hero: proposed headline "One place for your repository checks." Use the README purpose
   sentence underneath. Primary action: Get started. Secondary action: See a finding, an
   anchor within the landing page. Show a verified install command, its platform label, and Copy.
1. See a finding: a real terminal transcript with one actionable failure, its explanation,
   and the successful rerun after correction. Show `init` and `check` as separate actions.
   The default is static HTML text. Optional playback is user-started and has pause/replay.
1. Review what changes: a short excerpt of the actual initialization plan. Explain acceptance,
   retained files, generated files, and recovery. Link the existing-repository guide. Do not
   promise that all configurations translate or that uninstall always restores edited files.
1. Choose what runs: a small `gspot.toml` example beside its observed effect. Explain
   `recommended` and optional `all`; link customization. On phones, put configuration before
   output. This is a static example, not a browser-based config editor.
1. Work with your tools: a compact selection of verified presets, links to the full catalog,
   and separate routes for local hooks, CI, and coding-agent rule files. Explain that agent
   instructions guide behavior while checks enforce the subset they can measure.
1. Footer: Get started, Reference, GitHub, releases, contribution, and license. A small
   decorative `:wq` sign-off supplies personality; it is not a navigation control or command
   instruction. Keep functional labels literal.

Put release status beside the hero install command. If no release is installable, say so and
link contributor setup instead of displaying an install command that cannot work.

Do not require three statistics cards. Add an adoption case study only when it answers a real
question and links reproducible evidence. Record the test repository or public revision, CLI version, command,
platform, tool availability, and cold or warm caches for timing. A check count is neither
coverage nor correctness. No copied competitor benchmarks, invented endorsements, or claims
that passing the gate proves code has no defects.

### The theme

Use quiet reading surfaces, precise type, and actual command output. The product name is plain
text. Keep the landing page focused on setup, configuration, and findings.

Proposed design tokens:

| Token      | Dark      | Light     | Use                                 |
| ---------- | --------- | --------- | ----------------------------------- |
| Canvas     | `#111410` | `#F7F8F2` | Page background                     |
| Panel      | `#1B2018` | `#ECEFE4` | Terminal and configuration examples |
| Text       | `#EFF3E8` | `#182015` | Headings and prose                  |
| Muted text | `#B5BEAA` | `#4D5945` | Captions and secondary labels       |
| Accent     | `#B7F36B` | `#365D13` | Links and focus                     |

These are implementation inputs, not a completed contrast audit. Test actual foreground and
background pairs, including syntax highlighting, selection, hover, and disabled states.
Use dark text on a bright filled button rather than white text on lime. Errors and warnings
use the terminal's semantic colors plus visible words, not the brand accent as a success signal.

- Follow system light/dark preference on first visit. An explicit saved choice wins. Apply
  the same choice on landing and manual pages, with no light flash before dark rendering.
- Use system sans-serif for prose at 17 to 18 pixels and approximately 1.6 line height. Use
  system monospace for the wordmark, short headings, commands, and small metadata. Keep prose
  near 65 characters per line.
- Use lowercase `gspot` text in headers and a plain letter favicon. No illustrated character,
  generated artwork, concept board, or branding pipeline belongs in the project.
- Limit the landing content to roughly 1,120 pixels. Use an 8-pixel spacing scale, thin panel
  borders, modest 8-pixel corners, and generous section spacing. Avoid nested card grids,
  huge empty heroes, glass effects, gradients, scanlines, and glowing body text.
- At desktop widths, pair hero copy with the transcript. Below about 800 pixels, stack them
  in reading order. Use 20-pixel side padding on phones. Code can scroll within its panel;
  the page itself must not overflow horizontally. Do not shrink text to fit output.
- Keep terminal prompts decorative and out of copied commands. Label commands and output
  separately. Use existing Starlight code controls where suitable. Copy feedback says
  "Copied" only after success; failure leaves selectable text and a manual-copy instruction.
- Do not invent shell
  commands as section labels, hide content behind a pretend prompt, add a boot sequence,
  require Nerd Fonts, or put jokes in failure messages. No tracking widget or chat popover.
- No autoplay, blinking cursor, scroll-triggered reveal, parallax, or typing delay. Optional
  transitions stay under 150 milliseconds and respect reduced motion. A recording never
  carries information missing from the adjacent text.
- Theme Starlight through supported styling and shared tokens. Preserve its reading layout,
  search, focus handling, and mobile controls. Do not rebuild the documentation shell just
  to make it look like the landing page.

## Demonstrations

Capture the real CLI in a clean test repository at a documented revision with no personal paths or
credentials. Show the actual check name and `help` text, not a shortened invented error.
If the sequence uses automatic fixing, show which command performs it and the resulting
change; do not imply every finding is fixable. Preserve warning and failure information.
Show a separate successful check after correction, not a green website label implying success.

Keep the reproduction commands, test repository, output transcript, and CLI version with the guide or demonstration that owns the example. Use the same reviewed example on the README and site. Do not
introduce a second reference generator or snapshot every volatile timing. Optional recordings
load only on request; the initial page remains useful without them or JavaScript.

## Implementation and acceptance

This work extends G-10, K-202, S-11, S-19, K-302, and K-304 rather than creating a parallel
website backlog. Complete the remaining design and acceptance work in this order, retaining the existing implementation:

1. Verify the public command and terminology contract, then correct the sample test data and
   reference generator. Record the release each example demonstrates. No design polish can
   make a nonexistent command acceptable documentation.
1. Rewrite the root and published package READMEs using the brief above. Revise existing
   guides and add the missing tasks. Set explicit navigation in `docs/astro.config.ts`.
1. Retain one Astro landing page at `/`, using `docs/src/pages/index.astro`, with no competing
   root content route.
   Keep the existing guide and reference routes.
1. Put shared design tokens in
   `docs/src/styles/theme.css`, registered with both the landing layout and Starlight.
   Extract components only for shared behavior such as the reviewed transcript or install
   control; do not introduce a theme package or general-purpose component framework.
1. Review the rendered README on GitHub, the actual npm README payload, and landing, guide,
   reference, search, and not-found pages in both themes. Check 360-, 768-, and 1,440-pixel
   viewports, keyboard-only use, reduced motion, and 200% zoom.
1. Use plain text titles, canonical URLs, and page descriptions for sharing metadata.
1. Run scoped documentation checks and build in a disposable checkout. Then apply the
   deployment and release contract below. Keep runtime implementation and publishing separate
   from this architecture edit.

Acceptance is task-based as well as mechanical:

- A new reader can identify what gspot does, whether their platform is supported, and whether
  a release is available without opening source code.
- A reader follows the documented test repository from installation through one finding and a clean
  rerun. A teammate follows the clone/install path. A third task covers a scoped exception
  and finding recovery instructions.
- Record where readers get stuck; do not use page count
  or a forced five-minute completion claim as evidence of usability.
- Internal links, command samples, generated-reference completeness, and release/version
  consistency pass. No unshipped command or setting appears as supported public behavior.
- All controls have accessible names, visible focus, and keyboard operation. Text contrast
  is at least 4.5:1 for normal text; meaningful control boundaries and focus indicators reach
  3:1. Aim for 44-pixel touch targets.
- Confirm reading order and transcript access with a
  screen reader; an automated accessibility scan alone is insufficient.
- With scripts disabled, the landing page still provides purpose, installation text, the
  transcript, and manual links. With media blocked, no procedure loses information.
- Target at most 500 KB of compressed initial landing-page transfer, excluding user-started
  media, and at most 50 KB of landing-page JavaScript. Keep Starlight search outside that
  landing budget.
- Measure mobile loading and layout shift on the production build and
  record conditions; do not advertise a lab score as a universal speed guarantee.

## Before launch

- A release of the binary and of the plugin exists ([11-toolchain.md](11-toolchain.md)).
- The [candidate and deferred adoption gates](22-remaining.md#candidate-gate) are satisfied.
- Every number and every recording on the page comes from a command kept in the repository.
- The links validator of the manual passes over the landing page too.

## Deployment and released documentation

Keep the landing page, Starlight manual, reference generator, and schema in this repository's
`docs/` project. They share CLI and preset definitions; a second repository requires a second
version-coordination mechanism without providing a product benefit.

The GitHub Pages definition is `.github/workflows/site.yml`. Its presence does not establish
that the protected environment, hosting account, domain, or live rollback has been verified.

- Build from a published release tag. Use its pinned runtime and frozen repository lockfile.
  Run the existing docs build, including reference generation from that tag's CLI and presets,
  and upload `docs/dist/`. Generated reference entries and staged schema copies stay in build output.
- The build job has read-only repository access. A separate deployment job uses the protected
  `github-pages` environment and the Pages artifact. Only that job receives `pages: write`
  and `id-token: write`, following [GitHub's custom Pages workflow contract](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
  Pin actions to verified commits; serialize production deploys.
- A pull request builds and checks the same output, but cannot deploy or access production
  secrets. Its downloadable build artifact is the initial preview mechanism; the contributor
  can serve it locally. A hosted preview URL is not promised by this first deployment.
- The owner must confirm access to the repository's Pages settings and `gspot.dev` DNS.
  Verify the domain and HTTPS, then test the provider URL before changing public DNS.
  Keep the current site until that check passes.
- Missing account or domain access blocks cutover, not the local site build.
- Show the published version on every reference page. Production describes the latest stable
  release, never unreleased default-branch behavior. Historical release-tag artifacts remain
  downloadable; a version switcher is outside the first deployment.
- A documentation correction is built from a reviewed docs-only commit based on the stable release, retaining its CLI and
  preset definitions and recording both source revision and product version.
- Keep the preceding production artifact and source revision for rollback. Redeploy that
  artifact, or rebuild its exact pinned source if retention has expired; do not roll back DNS
  for an ordinary content defect.

Acceptance requires a clean build, internal-link checks, accessible landing-page controls,
a preview artifact, a successful deployment with HTTPS at `gspot.dev`, and one exercised
rollback. Record the hosting environment and rollback commands in the contributor guide.
No deployment or DNS change is part of this architecture-editing task.

## Reference generation

Render reference content from validated command, configuration, preset, and plugin definitions
through Astro's content store. Keep authored guides in their own collection and generated
entries under separate ownership. Use the existing Astro/Starlight project and content
configuration, with route rendering that preserves all public reference URLs and anchors.
Do not create another package or generic documentation framework.

Commands come from the registered public Commander tree, including inherited global options,
usage, choices, defaults, implicit help, and nested commands. Exclude hidden/internal commands.
Settings cover the complete root, scope, integration, and preset configuration contracts.
Matching shared settings list every owner; conflicting definitions fail the build. Include
plugin rules, public options, and both exported levels without duplicating manually maintained
lists. Generated pages show the release version and link to the owning source definition.

Validate every definition and rendered identity before updating generated entries. Reject
invalid schemas, duplicate routes or identities, conflicts with authored routes, and missing
required content. A build must fail rather than publish an incomplete reference. Development
reloads remove stale generated entries within their collection without touching authored guides.

Verify content-store output against the validated definitions and existing public routes. Check
inherited options, complete settings, plugin exports, duplicates, search, links, and source
provenance. Reuse ordinary behavior tests for worked command examples. Do not parse every prose
code block or maintain a separate fixture hierarchy as a condition of documentation correctness.

One Astro reference loader owns rendering and source attribution. It writes content-store entries,
not generated Markdown files. No file replacement, ownership markers, staging, or pruning remain.
The Bash demonstration transcript lives beside its documentation component. Theme tokens,
search, release-aligned deployment, and rollback remain part of the site contract.

Architecture owns target contracts. Public reference describes released behavior and never
copies an architecture decision log. Missing implementations stay visible in remaining work.

## Acceptance contracts

These clauses specify required behavior. [Remaining work](22-remaining.md) owns status and evidence.

### Acceptance K-302

Keep one site in docs and implement [21-documentation.md](21-documentation.md).
Include version alignment and rollback.

Build release-aligned references, provide unprivileged PR build artifacts, deploy through the protected Pages environment, and verify ownership, HTTPS, and domain cutover. External account and DNS changes require the owner's access.

Clean frozen-lock build, internal links, accessible landing controls, no PR deploy permissions, released-version labels, provider URL, custom-domain HTTPS, and rollback to the preceding artifact.

### Acceptance K-205

Build references from validated definitions without tracked copies. The Astro content loader replaces intermediate generated source Markdown after route, content, and authored-guide preservation acceptance passes. Build from a clean frozen checkout; never restore a public architecture decision mirror.

### Acceptance K-303

Authored guides and generated reference entries have separate ownership. Preserve authored content and reject invalid definitions before publication. Replace the existing generated-Markdown writer and pruning machinery only after the content-loader contract in this document is verified.

### Acceptance K-304

Render complete public reference from validated command, configuration, preset, and plugin definitions through the Astro content store. Preserve routes and inherited command options. Include global and integration settings. Reject duplicate identities and conflicting setting definitions. Publish only release-matched behavior, with source links to definitions.

### Acceptance S-4

Check architecture links and anchors. Public guides and demonstrations use reproducible commands and complete configurations exercised by ordinary behavioral tests. Generated reference derives from validated definitions. Do not require a separate documentation fixture system, root examples inventory, or universal parser of prose code blocks.

### Acceptance S-15

Verify product promises with observable CLI and installed-package behavior. Describe unimplemented capabilities as target contracts in architecture and track their acceptance in remaining work. Do not infer completeness from a source-file or test-count inventory.

### Acceptance G-10

Preserve the README, guide navigation, landing page, plain text identity and visual acceptance in this owner. Demonstrations retain real reproduction inputs, output, version, and correction. Explain all five `explain` subjects and editor coexistence. Reuse ordinary command tests and inspect both themes, responsive layout, keyboard, screen-reader access, script-free content, and loading budgets. A successful build alone does not establish usability.

### Acceptance S-19

Provide guides for first use, an existing setup, customization, profiles, custom checks, and hooks and CI. Include prerequisites, expected results, and recovery. Keep reproducible examples in their guides or demonstrations and reuse the ordinary command tests.
