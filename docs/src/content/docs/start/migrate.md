---
title: Migrate your linters
---

gspot replaces the config files of the tools that it runs, and `gspot.toml` then holds the settings of all those tools.
To move your repository to gspot, follow these steps:

1. Install your project's dependencies, then run `npx @gspothq/cli scan`, which works on a copy of your files. Only the
   scan compares your ESLint and Stylelint rules, and it loads those configs to read them.
2. Read two sections of the scan report: `What gspot init would carry over and drop` and `Commands that would break`.
   [Lint rules](#lint-rules) and [`Commands that would break`](#commands-that-would-break) say what to do with each line.
3. Commit your tool config files. `gspot init` deletes the ones that it replaces, and it refuses to run until Git holds
   each of them unchanged at `HEAD`.
4. Add gspot and run `gspot init`, as the [Quickstart](/start/quickstart/#set-up-gspot) shows. It makes the changes in
   the plan, installs the tools, and turns on the Git hooks, or prints a line for your
   [hook manager](/use/hooks/#existing-hook-managers). To start at level `all`, add `--level all`. To choose the
   configurations yourself, add `--configurations typescript,react`.
5. Commit the setup files, as [Clean up the first findings](/start/quickstart/#clean-up-the-first-findings) shows, then
   fix each file as you touch it.

The scan shows the plan for level `basic`. Level `all` also replaces the configs of the tools that it adds, such as
`.commitlintrc.json`.

To start from another repository's `gspot.toml`, follow
[Copy settings from another repository](/start/copy-settings/). It also copies `hooks.enabled` and `rule_files.enabled`.

## Read the plan

`gspot init` prints a plan of the files that it will write, delete, keep, and change, then carries it out without asking.
`gspot scan` prints the same plan and changes nothing, so read it there first:

| Heading in the plan                                                                  | What it lists                                                                                                                                  | What you do                                                        |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `write`                                                                              | Files that init creates or overwrites: `gspot.toml`, the `.gspot/` folder, and small config files such as `eslint.config.mjs` and `ruff.toml`. | Commit them.                                                       |
| `delete`                                                                             | Your old tool configs, such as `.eslintrc.json`. Git keeps the committed copy, so `git show HEAD:<path>` prints it.                            | Read `what init carries` for the settings that init kept.          |
| `keep`                                                                               | Files that init leaves alone: tool sections in shared files, such as `[tool.ruff]` in `pyproject.toml`, your CI files, and your own Git hooks. | Delete the tool sections. `gspot check` reports each until you do. |
| `change`                                                                             | Files that init edits and does not own, such as `.gitattributes` and the Stylelint fields of `package.json`.                                   | Review the diff.                                                   |
| `lint folders`                                                                       | Root folders named `lint`, `linting`, `quality`, `code-quality`, or `.qlty`, which often hold old lint scripts. gspot does not change them.    | Delete each one when nothing calls it.                             |
| `What gspot init would carry over and drop` in the scan, `what init carries` in init | Each setting that init copied from your old configs, and each one that it dropped.                                                             | Run the `gspot ignore` command on each `needs a reason` line.      |
| `Commands that would break` in the scan, `lint commands` in init                     | Scripts, hooks, and CI steps that still run a replaced tool.                                                                                   | Replace each with `gspot check`, or delete it.                     |

## Formatting that init carries over

`gspot init` copies the options of these formatters into the `[format]` table of `gspot.toml`. `what init carries` marks
an option that init cannot copy as dropped, and the format check then expects the format that gspot writes. A `format`
script that calls another formatter stays in place, and the plan lists it, because the two formatters can disagree on
the same file.

- Prettier: the indent style, indent width, line width, quotes, semicolons, trailing commas, `bracketSpacing`,
  `arrowParens`, and `proseWrap`, from a JSON, YAML, or TOML file, the `prettier` key of `package.json`, or a JavaScript
  or TypeScript config. Each `overrides` entry becomes a `[[format.override]]` record.
- `.editorconfig`: the indent style, indent width, line width, and quote type. A value of `unset` leaves the option out,
  and `what init carries` marks a line width of `off` as dropped.
- Ruff: `line-length`, `indent-width`, `format.indent-style`, and `format.quote-style`, in a `[[format.override]]` record
  for the Python files.

`gspot init` reads Prettier settings in the root folder and in each scope. To read a JavaScript or TypeScript config, it
loads the file the way Prettier does, so the code in that file runs. When the file fails to load, the plan says so, and
you set `format.indent_width` and `format.print_width` yourself. `gspot.toml` has no setting for some Prettier options,
such as `quoteProps`, and cannot hold some values, such as the Ruff quote style `preserve`, so init drops them.

In a repository that has code, gspot fills in each width or quote style that no config sets, with the Prettier defaults:
2 spaces, 80 columns, and double quotes. Python files get the Ruff defaults through a `[[format.override]]` record: 4
spaces, 88 columns, and double quotes. Swift and SQL files keep the defaults of their formatters in the same way. Only a
repository without code gets the gspot defaults: 4 spaces, 120 columns, and single quotes.

The scan report says how many files differ, under `Formatting`. If most of your files differ, set `format.indent_width`,
`format.print_width`, and `format.quotes` to match them, so that the format check accepts each file that you touch.

## Ignored paths

`gspot init` turns `.prettierignore`, `.eslintignore`, the Ruff `exclude` and `extend-exclude` settings, and the pyright
`include` and `exclude` settings into `[[ignore]]` records, which make the checks skip those paths. It keeps a pattern
only when it matches a file in the repository. It drops a pattern that starts with `!`, and `what init carries` lists
it.

## Lint rules

gspot compares each lint rule in your configs, with its options, to the rules that gspot runs. `what init carries` prints
one row for each replaced config, and sorts the rules of that config into these groups:

| Group                                 | Meaning                                                                                                                                                                                                                                           | What you do                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| covered                               | gspot runs the rule the same way.                                                                                                                                                                                                                 | Nothing.                                                                |
| carried over                          | For Ruff, markdownlint, and commitlint, init wrote the rule into `gspot.toml`. An entry `ignore <rule>` is a rule that you turned off or gave a weaker limit, and init wrote an `[[ignore]]` record with the reason "Carried over from `<file>`." | Nothing. When you know the real reason, write it in place of that one.  |
| other options, to set after init      | For ESLint and Stylelint, gspot runs the rule with options other than yours.                                                                                                                                                                      | To keep your options, set them in `tools.<tool>.rules`.                 |
| needs a reason                        | For ESLint and Stylelint, `gspot scan` found a rule that you turned off or gave a weaker limit.                                                                                                                                                   | Fix the findings, or run the `gspot ignore` command that the row names. |
| keep with a plugin record             | The rule comes from a plugin that gspot does not install. `gspot init` never writes such a record, because a plugin is code that runs in every check.                                                                                             | Add a [plugin record](/configure/lint-rules/#plugins).                  |
| keep with a command check of your own | gspot does not run the rule, and no plugin record can add it.                                                                                                                                                                                     | Keep it with a [command check](/configure/command-checks/).             |
| dropped                               | `gspot.toml` has no setting for it.                                                                                                                                                                                                               | Decide whether you still need it.                                       |

`gspot init` compares the rules of three tools itself. Your ESLint and Stylelint rules need the plugins that
`gspot install` adds, and init makes its plan before it installs them, so only `gspot scan` compares those:

| Tool         | Compared by       | `gspot.toml` setting       |
| ------------ | ----------------- | -------------------------- |
| Ruff         | init and scan     | `tools.ruff.rules`         |
| markdownlint | init and scan     | `tools.markdownlint.rules` |
| commitlint   | init and scan     | `tools.commitlint.rules`   |
| ESLint       | `gspot scan` only | `tools.eslint.rules`       |
| Stylelint    | `gspot scan` only | `tools.stylelint.rules`    |

commitlint, ESLint, and Stylelint print your rules with the copy of the tool in your `node_modules`, so install your
dependencies first. For any tool not in this table, such as Knip, init deletes the config and does not copy its rules,
so set them again in `gspot.toml`. init reads Ruff and markdownlint configs only in the root folder, and drops a config
of either in a subfolder.

## `Commands that would break`

gspot does not edit your scripts, Git hooks, or CI files. The plan and `gspot scan` list each place that still calls a
replaced tool or repeats it:

- `package.json` scripts, `lint-staged` entries, and hook lines
- `.pre-commit-config.yaml` entries and CI steps
- root `devDependencies` that gspot also installs, with both versions
- the settings of black, flake8, isort, and mypy

Each row names the line and what to do with it. Change or delete each one, because the check
`gspot/conflicting-configs` fails until you do. In a monorepo, the `lint` scripts of the workspace packages become one
`gspot check` in the root folder, as [Monorepo task runners](/configure/monorepos/#monorepo-task-runners) shows.

## Old tool configs found after init

When you raise the level or add a configuration, a tool that starts to run can find an old config file of its own, such
as `.commitlintrc.json` for commitlint. `gspot/conflicting-configs` reports the file, so delete it and move each rule
that you need into `gspot.toml`.
