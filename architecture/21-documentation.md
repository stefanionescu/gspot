# The README, the Manual, and the Site

This document decides what a developer reads before and after they install gspot: the README of
the repository, the manual under `docs/`, and the landing page at gspot.dev. It answers gap G-10
of [18-gaps.md](18-gaps.md). The site source already exists in `docs/`; the changes below and production deployment remain planned.

Every command and output example must be verified against the documented release. The adoption
case study comes from the redone install in yap-swift-app (D-121). The introductory examples
come from small, public fixtures in `examples/`, so readers can reproduce them without access
to that app. Content planning and theme work can precede the redo; publication of the case
study and adoption claims cannot.

## Contents

- [What exists today](#what-exists-today)
- [Reference projects and the quality gap](#reference-projects-and-the-quality-gap)
- [The README](#the-readme)
- [The manual](#the-manual)
- [The site](#the-site)
- [Visual identity and generated assets](#visual-identity-and-generated-assets)
- [Implementation and acceptance](#implementation-and-acceptance)
- [Before launch](#before-launch)
- [Deployment and released documentation](#deployment-and-released-documentation)
- [Reference generation](#reference-generation)

## What exists today

| Surface | State                                                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| README  | A sentence, two requirements, two setup commands, and a list of command names; no demonstrated finding or recovery path                   |
| Manual  | Starlight with its default theme, six authored guides, and generated reference; guide length and page count do not establish completeness |
| Site    | The index page of the manual: three paragraphs and six links. No landing page, no demonstration, no design of its own                     |

The reference generator has a real build-time role, but its output is not automatically correct.
It omits parts of the command and settings contract and includes hard-coded prose. K-303 and
K-304 in [25-simplification.md](fixes/25-simplification.md) define the correction.

## Reference projects and the quality gap

The September 20, 2026 review used official site content and repository READMEs. Browser
rendering was unavailable, so this is a content and presentation-pattern comparison, not a
pixel-level audit or an accessibility certification of those sites. The design below is a
gspot proposal, not a claim that those projects use these colors or dimensions.

| Reference                                                 | Observed pattern                                                                                     | Adopt for gspot                                                                                             |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [Starship](https://starship.rs/)                          | A short purpose statement leads to getting started, compatibility, and concrete installation steps.  | Explain the product before its vocabulary; place supported platforms beside installation.                   |
| [Charm](https://charm.land/)                              | Distinctive product names, playful descriptions, and terminal-oriented humor accompany real tools.   | Give the site personality without putting jokes in warnings or renaming commands.                           |
| [Gum README](https://github.com/charmbracelet/gum#readme) | Demonstrations and usage examples make a terminal product tangible.                                  | Show a real finding and the action that resolves it, not only a command inventory.                          |
| [Atuin](https://atuin.sh/)                                | Installation, compatibility, documentation, and product identity are visible entry points.           | Keep the next action obvious; use an original, small brand detail rather than borrowing its mascot.         |
| [uv documentation](https://docs.astral.sh/uv/)            | First steps, task guides, concepts, integrations, and reference have separate navigation roles.      | Route new users and returning users differently; do not make either search an alphabetical reference first. |
| [uv README](https://github.com/astral-sh/uv#readme)       | Installation and concrete workflows accompany the product summary and links to deeper documentation. | Make the repository page useful without requiring a visit to the website.                                   |

The current surfaces are not at this level. They name capabilities but barely demonstrate the
experience. The old plan improves coverage but does not define navigation, responsive behavior,
readable typography, or release-bound examples. It also overstates safe adoption and requires
statistics that are not yet useful evidence. Replace those gaps with the contracts below.

## The README

A reader needs purpose, release status, a visible result, and a next step in the opening screen.
Use native GitHub Markdown, not a centered HTML marketing layout. Target 700 to 1,000 words,
excluding output; this is an editorial budget, not a reason to omit safety information.
Include a compact branded illustration using the same mascot and palette as the website.
Keep the title, purpose, and release status as selectable text outside the image. The art must
not push the first useful example below a large decorative header.

Use this ordered content brief when rewriting the root README:

1. Title `gspot`. Proposed opening copy: "gspot runs your repository checks and gives coding
   agents the rules to follow." Follow with one sentence about generated configuration for
   existing tools. Publish this wording only once both behaviors are verified for the release.
1. State prerelease status and material platform limits before setup. Do not claim gspot
   detects whether a human or an agent wrote code.
1. A compact, selectable example of one finding: path, check name, explanation, and `help:`.
   Copy it from a fixture run. Link to an optional recording on the site; do not make an
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

The guides that exist stay and are rewritten with real output. The guides that are missing:

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

Two guides are wrong today: the scopes guide shows config that gspot refuses, and the findings
guide says every ignore prints on every run (K-202). Every sample of the manual is run through
the program, so a guide cannot drift from the code again (S-11).

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
Use the vocabulary in [19-names.md](19-names.md) everywhere, including search labels and `help`.

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
question and links reproducible evidence. Record the fixture or public revision, CLI version, command,
platform, tool availability, and cold or warm caches for timing. A check count is neither
coverage nor correctness. No copied competitor benchmarks, invented endorsements, or claims
that passing the gate proves code has no defects.

### The theme

Use a playful terminal field notebook: quiet reading surfaces, colorful sticker-like art,
a curious mascot, precise type, and actual command output. This is an original direction
informed by the references, not a copy of their assets.
The website can be playful; operational help, safety warnings, and errors stay literal.

Proposed design tokens:

| Token      | Dark      | Light     | Use                                      |
| ---------- | --------- | --------- | ---------------------------------------- |
| Canvas     | `#111410` | `#F7F8F2` | Page background                          |
| Panel      | `#1B2018` | `#ECEFE4` | Terminal and configuration examples      |
| Text       | `#EFF3E8` | `#182015` | Headings and prose                       |
| Muted text | `#B5BEAA` | `#4D5945` | Captions and secondary labels            |
| Accent     | `#B7F36B` | `#365D13` | Links, focus, and the brand dot          |
| Lilac      | `#C4AEFF` | `#68459A` | Secondary illustration color, not status |
| Peach      | `#FFB694` | `#984829` | Small illustration accents, not warnings |

These are implementation inputs, not a completed contrast audit. Test actual foreground and
background pairs, including syntax highlighting, selection, hover, and disabled states.
Use dark text on a bright filled button rather than white text on lime. Errors and warnings
use the terminal's semantic colors plus visible words, not the brand accent as a success signal.

- Follow system light/dark preference on first visit. An explicit saved choice wins. Apply
  the same choice on landing and manual pages, with no light flash before dark rendering.
- Use system sans-serif for prose at 17 to 18 pixels and approximately 1.6 line height. Use
  system monospace for the wordmark, short headings, commands, and small metadata. Keep prose
  near 65 characters per line.
- Use a lowercase `gspot` wordmark and one solid accent dot. Build the production mark in
  text or SVG. Generate the mascot illustrations through the workflow below, not the text,
  terminal output, or functional controls. No separate icon library is required.
- Limit the landing content to roughly 1,120 pixels. Use an 8-pixel spacing scale, thin panel
  borders, modest 8-pixel corners, and generous section spacing. Avoid nested card grids,
  huge empty heroes, glass effects, gradients, scanlines, and glowing body text.
- At desktop widths, pair hero copy with the transcript. Below about 800 pixels, stack them
  in reading order. Use 20-pixel side padding on phones. Code can scroll within its panel;
  the page itself must not overflow horizontally. Do not shrink text to fit output.
- Keep terminal prompts decorative and out of copied commands. Label commands and output
  separately. Use existing Starlight code controls where suitable. Copy feedback says
  "Copied" only after success; failure leaves selectable text and a manual-copy instruction.
- Keep fun in the mascot, colorful illustrations, terminal framing, and optional footer detail.
  Keep most of the page quiet so the artwork has room to stand out.
- Do not invent shell
  commands as section labels, hide content behind a pretend prompt, add a boot sequence,
  require Nerd Fonts, or put jokes in failure messages. No tracking widget or chat popover.
- No autoplay, blinking cursor, scroll-triggered reveal, parallax, or typing delay. Optional
  transitions stay under 150 milliseconds and respect reduced motion. A recording never
  carries information missing from the adjacent text.
- Theme Starlight through supported styling and shared tokens. Preserve its reading layout,
  search, focus handling, and mobile controls. Do not rebuild the documentation shell just
  to make it look like the landing page.

## Visual identity and generated assets

This is a required design workstream, not permission to publish arbitrary generated artwork.
The implementer drives exploration and selects a coherent direction against this brief. Show
the resulting concept board and explain the choice; another brainstorming round is not a
prerequisite unless the user requests a different direction. This architecture update does
not generate assets or implement the website.

### Character and tone

The proposed mascot is Spot: a small, rounded lime creature with two dark eyes, tiny feet,
and an oversized lilac magnifying lens. Spot notices details in code and helps the reader
investigate. Use a curious, friendly expression, not a scolding inspector. A peach detail
adds warmth. Keep a recognizable silhouette, flat rounded shapes, restrained texture, and
consistent outlines. Avoid mixing pixel art, glossy 3D, and flat illustration in one family.

The name can carry an understated wink. The visual identity is workplace-safe: no anatomy,
sexual imagery, suggestive poses, or sexual jokes in onboarding. Use discovery and finding
the right spot as the visual idea. Keep the official product spelling `gspot`; Spot is the
character, not a new name for the CLI, a check, or a rule. Proposed playful caption:
"A soft spot for readable code." It is optional brand copy, not a product guarantee.

Learn from Charm and Gum by giving a technical product warmth and a recognizable character.
Learn from Starship by keeping the purpose and next action clear. Do not copy their characters,
logos, slogans, or distinctive compositions. No competitor assets enter production.

### Image-generation workflow

Use the available OpenAI image-generation tool and the imagegen skill for original raster
concepts and mascot illustrations. The user requested `GPT Image 2.5`; that exact model is
unverified in this environment and must not be represented as a confirmed dependency. At
execution, report the tool name. Report its model when exposed. If that exact model is essential,
verify access first and report a blocker rather than claiming another model is 2.5.

Use the built-in tool by default. Do not create an API client, add an image-generation service
to the product, or make site builds depend on generation. An explicitly selected API/CLI
fallback requires its documented local credentials; never place keys in source or ask for
them in chat. If the built-in tool is unavailable, report that before changing execution mode.

Generate three concept candidates with the same palette and character brief. The compositions
are Spot with a magnifying lens, Spot beside a small terminal-shaped notebook, and a compact
sticker built around Spot and the accent dot. Explore composition and expression within one
identity. No generated words, commands, or interface.

Continue with the selection and production steps:

1. Compare the candidates on originality, workplace suitability, small-size silhouette,
   fit beside real terminal output, and readability on both backgrounds. Select one and
   record why. Keep rejected concepts out of production and out of the normal site build.
1. Generate a character reference sheet from the selected image, then use that image as an
   explicit reference for each production illustration. Preserve proportions, face, outline,
   palette, lens, and texture across variants. Inspect local inputs before editing them.
1. Generate each asset separately, inspect it, and iterate with one targeted change at a
   time. Request real transparency for cutouts and verify alpha; a painted checkerboard is
   not transparency. Check edges on both page backgrounds and at actual display sizes.
1. Compose exact words and the wordmark using native text or SVG after generation. Export
   appropriately sized delivery files and keep selected source images, prompts, actual tool
   metadata, and editing notes.

Generation is not reliably bit-for-bit reproducible, so the selected source image matters as
much as its prompt.

Base prompt for concept exploration, adapted only for the candidate composition:

```text
Use case: stylized-concept
Asset type: original mascot illustration for a developer CLI website and README
Subject: Spot, a small rounded lime creature with two dark eyes, tiny feet,
and an oversized lilac magnifying lens; curious, friendly, and helpful
Style: flat sticker illustration, rounded silhouette, consistent dark outline,
restrained print texture, readable at small sizes
Palette: lime #B7F36B, lilac #C4AEFF, peach #FFB694, charcoal #111410
Composition: isolated full character, generous clear space, no cropped limbs
Background: genuinely transparent; clean edges for light and dark surfaces
Avoid: text, letters, logos, fake terminal output, sexual imagery, suggestive
poses, competitor mascots, watermarks, glossy 3D, complex scenery
```

### Asset set and placement

The same selected character and palette serve all surfaces. Do not commission unrelated
README art after the website design is complete.

| Asset                     | Placement                                                     | Delivery contract                                                                                                            |
| ------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Primary Spot illustration | Landing hero beside, not behind, the copy and real transcript | Transparent master; responsive WebP/PNG exports; target at most 120 KB for the initially loaded size                         |
| Compact Spot illustration | Root README opening and package branding where useful         | PNG with transparency; target at most 100 KB and 160 rendered pixels high; useful in GitHub light and dark themes            |
| Investigating pose        | Website not-found page                                        | Small illustration with literal explanatory text and navigation outside it; no implication that a check failed               |
| Social preview            | Website and repository sharing                                | 1,200 by 630 pixel composed PNG; same Spot, palette, wordmark, and short product description; text added deterministically   |
| Wordmark and favicon      | Header, manual, browser tab                                   | Text/SVG wordmark and simplified dot mark; inspect favicon at 16 and 32 pixels rather than shrinking a detailed illustration |

Keep final shared assets under `docs/public/brand/`, referenced by repository-relative links
from the root README and served under `/brand/` on the site. The npm packaging step must
include any required image or use a verified release-stable hosted URL; repository-relative
links alone do not establish npm rendering. Keep chosen source art and a short asset record
under `docs/design/`, outside published static output. Record prompt, reference image, actual
tool/model when known, source, edits, dimensions, license or usage review, and consuming pages.
Do not create a branding package, generic asset pipeline, or automatic regeneration in CI.

On the landing page, use the primary illustration as a modest companion to the hero, not a
full-screen poster. The manual shares colors and wordmark but keeps illustrations out of
routine reference pages. The README uses the compact pose, not a screenshot of the website.
Functional controls and error semantics remain consistent even when decorative art differs.

### Demonstration contract

Capture the real CLI in a clean fixture at a documented revision with no personal paths or
credentials. Show the actual check name and `help` text, not a shortened invented error.
If the sequence uses automatic fixing, show which command performs it and the resulting
change; do not imply every finding is fixable. Preserve warning and failure information.
Show a separate successful check after correction, not a green website label implying success.

Keep the reproduction commands, fixture, output transcript, and CLI version with the existing
documentation sample workflow. Use the same reviewed example on the README and site. Do not
introduce a second reference generator or snapshot every volatile timing. Optional recordings
load only on request; the initial page remains useful without them or JavaScript.

## Implementation and acceptance

This work extends G-10, K-202, S-11, S-19, K-302, and K-304 rather than creating a parallel
website backlog. Implement in this order:

1. Run the concept exploration and image-generation workflow above. Select Spot's visual
   reference, produce the shared asset set, and review it across a landing composition,
   README opening, and manual header before treating the identity as finished.
1. Verify the public command and terminology contract, then correct the sample fixtures and
   reference generator. Record the release each example demonstrates. No design polish can
   make a nonexistent command acceptable documentation.
1. Rewrite the root and published package READMEs using the brief above. Revise existing
   guides and add the missing tasks. Set explicit navigation in `docs/astro.config.ts`.
1. Replace the current root manual index with one Astro landing page at `/`, using
   `docs/src/pages/index.astro`; remove the conflicting root content route in the same change.
   Keep the existing guide and reference routes.
1. Put shared design tokens in
   `docs/src/styles/theme.css`, registered with both the landing layout and Starlight.
   Extract components only for shared behavior such as the reviewed transcript or install
   control; do not introduce a theme package or general-purpose component framework.
1. Review the rendered README on GitHub, the actual npm README payload, and landing, guide,
   reference, search, and not-found pages in both themes. Check 360-, 768-, and 1,440-pixel
   viewports, keyboard-only use, reduced motion, and 200% zoom.
1. Use a static wordmark and
   title with the selected Spot art for a locally owned social preview image; add canonical
   URLs and page descriptions.
1. Run scoped documentation checks and build in a disposable checkout. Then apply the
   deployment and release contract below. Keep runtime implementation and publishing separate
   from this architecture edit.

Acceptance is task-based as well as mechanical:

- The selected art family matches across website, README, manual branding, and social preview.
  Review originality, workplace suitability, character consistency, transparency, small-size
  legibility, and asset provenance.
- Generated images contain no functional text or fabricated
  product output. Give informative images useful alt text and decorative art empty alt text.
  Explicit dimensions prevent layout shift; lazy-load below-fold art. The existing total
  page-transfer budget still applies, including the hero illustration.
- A new reader can identify what gspot does, whether their platform is supported, and whether
  a release is available without opening source code.
- A reader follows the documented fixture from installation through one finding and a clean
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
- The Adoption phase of [13-roadmap.md](13-roadmap.md) is done, and the app is redone.
- Every number and every recording on the page comes from a command kept in the repository.
- The links validator of the manual passes over the landing page too.

## Deployment and released documentation

Keep the landing page, Starlight manual, reference generator, and schema in this repository's
`docs/` project. They share CLI and preset definitions; a second repository requires a second
version-coordination mechanism without providing a product benefit.

The planned static host is GitHub Pages, with a separate `.github/workflows/site.yml`.
This is a deployment decision to implement, not evidence that a hosting account or domain has
already been configured.

- Build from a published release tag. Use its pinned runtime and frozen repository lockfile.
  Run the existing docs build, including reference generation from that tag's CLI and presets,
  and upload `docs/dist/`. Generated source changes stay in the disposable checkout.
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

Keep `docs/reference-pages.ts` as the single public-reference generator. Its filename is clear;
renaming it does not remove work. Build and dev run it before Astro. Generated pages are ignored
by Git, and the stale-copy check and its `--check` mode go (K-205). Unknown arguments fail before
writing. The generator owns marked output only, never an arbitrary file under the reference
folder, and a failed replacement cannot truncate a previous page (K-303).

Commands come from the registered public command tree, including inherited options. Settings
come from the validated configuration definitions. These include global settings and their scopes.
Manifest settings cannot silently override another definition with the same name. Page tests
compare that public contract, not only file counts or successful Markdown parsing (K-304).

Do not publish a copy of the architecture decision log as product reference. Remove its generated
page, sidebar entry, and link-rewriting code. Keep one clearly labeled architecture link at the
matching source revision. The decision log remains in this repository for contributors.
Do not add `architecture/presets.ts`: the public reference owns implemented details, while
architecture owns intended contracts and differences still to implement.
