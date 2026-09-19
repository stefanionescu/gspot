# The README, the Manual, and the Site

This document decides what a developer reads before and after they install gspot: the README of
the repository, the manual under `docs/`, and the landing page at gspot.dev. It answers gap G-10
of [18-gaps.md](18-gaps.md). None of it is built.

One rule holds for all three: every command and every line of output shown is copied from a real
run. The source of those runs is the redone install in yap-swift-app (D-121), so this work
starts after that redo.

## What exists today

| Surface | State                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------------------------------- |
| README  | 24 lines: a sentence, two requirements, two commands, a list of command names                                         |
| Manual  | Starlight with its default theme. Six guides, 1,257 words. 293 reference pages written from the data of the binary    |
| Site    | The index page of the manual: three paragraphs and six links. No landing page, no demonstration, no design of its own |

The reference pages are sound, because `docs/reference-pages.ts` writes them from the manifests.
The guides and the front door are what is missing.

## The README

A reader decides in the first screen. The order:

1. **One sentence.** What gspot is and who it is for, with no list of features.
2. **A recording of a terminal**, 20 seconds: `gspot init` in a small repository, the plan, the
   yes, then one finding with its `help:` line.
3. **Install**, one line for each way in: mise, npm, a release binary.
4. **What init does to your repository.** The real plan output, then the file tree after it:
   `gspot.toml`, `.gspot/`, and what was left alone. This answers the first fear of a
   developer, which is what the tool touches.
5. **What a finding looks like**, and the three things to do with one: fix it, `gspot explain`
   it, or `gspot ignore` it with a reason.
6. **Make it yours.** The table of [20-adoption.md](20-adoption.md): choose presets, take the
   `recommended` level, turn a rule off and on, add a check of your own, carry a profile to the next
   repository.
7. **Getting out.** `git commit --no-verify` for one commit, and `gspot uninstall` for good.
8. **What it supports**, as one table of languages and frameworks with the number of checks.
9. **Links**: the manual, the design folder, how to contribute, the license.

`packages/cli` and `packages/eslint-plugin` each get a short README of their own, because npm
shows that file.

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

## The site

The manual stays Starlight. The landing page is one Astro page in the same project, so one build
serves both, and gspot.dev opens on the landing page.

What the good ones do, and what gspot takes from each:

| Site                                 | What it does well                                                                                     | What gspot takes                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [Biome](https://biomejs.dev)         | The install command with a tab for each package manager, then a finding with its safe fix as the demo | the install tabs, and a real finding as the second thing on the page |
| [Ruff](https://docs.astral.sh/ruff/) | One claim, then the proof: a chart of a measured run                                                  | every number on the page is measured and names its command           |
| [mise](https://mise.jdx.dev)         | The configuration file next to the output it produces, and four numbered sections                     | `gspot.toml` beside the run it produces, and a short numbered page   |

The page, in order:

1. **Hero.** One sentence, and one install command with a button that copies it.
2. **The terminal.** A recording of a real `gspot init`, then a real finding. The terminal is the
   picture of the page. No illustration, no mascot.
3. **Three measured numbers**, each with the command that reproduces it: the minutes init
   takes, the files it adds to the root, the checks it runs.
4. **What it writes into your repository**, as a small file tree with one line for each entry.
5. **It fits what you have**: your hooks keep running, your `lint` command keeps working, your
   files are never deleted unless one tool owns them.
6. **Make it yours**: four commands, each with one line.
7. **Languages and frameworks**, as a grid that links to the preset pages.
8. **For agents**: the rule files, and the `llms.txt` the manual already builds.
9. The manual, GitHub, the license.

### The theme

What the sites a developer already likes do:

| Site                            | What it does                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| [Oxc](https://oxc.rs)           | dark, one heading, two buttons, then each tool with a measured number beside a named rival |
| [Starship](https://starship.rs) | one sentence, three features, an install block for each shell                              |
| [Charm](https://charm.land)     | mascots and jokes, down to the footer line about `/dev/null`                               |
| [mise](https://mise.jdx.dev)    | sections numbered 01 to 04, and the config file beside the output it produces              |

gspot takes the plain end of that range:

- Dark by default, with a light theme that follows the system. A near-black background,
  off-white text, and one accent color for the prompt character, links, and the copy button.
- One monospace face for headings, body, and commands.
- The page reads as a terminal session. Sections carry the numbers `01` to `06`. Each one opens
  with a command and shows its real output under it.
- Numbers are measured, and each names the command that reproduces it.
- One joke at most, in the footer. No mascot, no illustration, no gradient, and nothing moves
  except the terminal.
- The page works with scripts off, and the recording has a text form for a screen reader.

## Before launch

- A release of the binary and of the plugin exists ([11-toolchain.md](11-toolchain.md)).
- The Adoption phase of [13-roadmap.md](13-roadmap.md) is done, and the app is redone.
- Every number and every recording on the page comes from a command kept in the repository.
- The links validator of the manual passes over the landing page too.
