---
title: Migrate your linters
description: See which settings gspot copies from your tool configs, which rules need a reason, and which commands to change.
---

gspot replaces the config files of the tools that it runs. After that, `gspot.toml` holds the settings of all those
tools. To move your repository to gspot, follow these steps:

1. Run `gspot scan`. It works on a copy of your files and changes nothing. It prints the plan of `gspot init`: the list
   of changes that init will make.
2. Commit your tool config files. `gspot init` deletes the ones that it replaces, and it refuses to run until Git holds
   each of them unchanged at `HEAD`.
3. Run `gspot init`. It makes the changes in the plan, installs the tools, and turns on the Git hooks.
4. Act on the table of rules and the list of lint commands that `gspot scan` printed.
5. [Record a baseline](/use/baseline/), so that the findings from before gspot do not fail the checks.

## Read the plan

`gspot init` prints its plan and then carries it out without asking. Read the plan that `gspot scan` prints before you
run init.

If the repository does not pin a gspot version yet, init adds gspot to `package.json`. Without a `package.json`, it
adds gspot to `mise.toml`. The last line of the init output then names the install command of your package manager.
Run it, so that the Git hooks run that gspot version.

The level decides which tools run, and so which tool configs init replaces. To start at level `all`:

```shell
gspot init --level all
```

To choose the configurations yourself, run `gspot init --configurations typescript,react`. Repeat `--configurations`
to add more names, such as `--configurations vitest`. [Add or remove a
configuration](/configure/gspot-toml/#add-or-remove-a-configuration) explains the names.

The plan has these sections:

| Section                                          | What gspot does                                                                                                                                          | What you do                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `write`                                          | Writes `gspot.toml`, `.gspot/`, and the generated files.                                                                                                 | Commit them after `gspot init`.                                                |
| `delete`                                         | Deletes the tool configs that gspot replaces, such as `.eslintrc.json` and `ruff.toml`. Git still holds them, so `git show HEAD:<path>` prints each one. | Read the table of what init carries.                                           |
| `keep`                                           | Leaves tool sections in shared files, such as `[tool.ruff]` in `pyproject.toml`, and leaves your CI files.                                               | Delete each tool section. `gspot/conflicting-configs` reports it until you do. |
| `change`                                         | Adds the gspot block to `.gitattributes`, and sets keys in files that gspot does not own, such as the Stylelint fields of `package.json`.                | Review the change.                                                             |
| `lint folders; delete when nothing calls them`   | Lists folders of lint scripts, such as `lint/`, for you to review. gspot does not change them, and they keep working.                                    | Check that nothing uses them, then delete them.                                |
| `what init carries from the configs it replaces` | Lists what init wrote into `gspot.toml`, and what it could not write there.                                                                              | Run the commands that the table names.                                         |
| `lint commands`                                  | Lists each command that calls a replaced tool. gspot edits none of them.                                                                                 | Replace or delete each one.                                                    |

## Formatting that init carries over

`gspot init` reads the options of your formatters and copies them into the `[format]` table of `gspot.toml`. Code that
passes your formatter today then passes the gspot format check too:

- Prettier: the indent style, indent width, line width, quotes, semicolons, trailing commas, `bracketSpacing`,
  `arrowParens`, and `proseWrap`, from a JSON, YAML, or TOML file, the `prettier` key of `package.json`, or a JavaScript
  or TypeScript config. Each `overrides` entry becomes a `[[format.override]]` record.
- `.editorconfig`: the indent style, indent width, line width, and quote type. A value of `unset` leaves the option out.
  The table lists a line width of `off` as dropped.
- Ruff: `line-length`, `indent-width`, `format.indent-style`, and `format.quote-style`, in a `[[format.override]]` record
  for the Python files.

To read a JavaScript or TypeScript Prettier config, `gspot init` loads it the way Prettier does, so the code in that
file runs. When the file fails to load, the plan says so. Then set `format.indent_width` and `format.print_width`
yourself. Prettier has options that `gspot.toml` has no setting for, such as `quoteProps`, and the table lists each of
them as dropped. The table also lists as dropped a value that `gspot.toml` cannot hold, such as the Ruff quote style
`preserve`, and a tool config that does not parse.

A tool config that init replaces never stops init or `gspot scan`. A `package.json` below the root folder, or a
`pyproject.toml`, that does not parse also gets a row in the table, and gspot reads no dependencies or scope from it. A
`tsconfig.json`, `pnpm-workspace.yaml`, `mise.toml`, or root `package.json` that does not parse stops init, and the
error names the file.

In a repository that has code, gspot fills in each width or quote style that no config sets. It uses the Prettier
defaults: 2 spaces, 80 columns, and double quotes. Python files get the Ruff defaults through a `[[format.override]]`
record: 4 spaces, 88 columns, and double quotes. Swift and SQL files keep the defaults of their formatters in the same
way. Only a repository without code gets the gspot defaults: 4 spaces, 120 columns, and single quotes. Read the
findings of the first `gspot check` before you run `gspot check --fix`.

## Ignored paths

`gspot init` turns `.prettierignore`, `.eslintignore`, the Ruff `exclude` and `extend-exclude` settings, and the pyright
`include` and `exclude` settings into `[[ignore]]` records. An `[[ignore]]` record in `gspot.toml` makes the checks
skip the paths that it names. For a pyright `include`, init ignores each folder of Python files that the `include` leaves out.
`gspot init` keeps a pattern only when it matches a tracked file, because gspot reads only tracked files. It drops a
pattern that starts with `!`, and the table lists it as dropped.

## Lint rules

gspot compares each lint rule in your configs, with its options, to the rules that gspot runs. The table prints one row
for each replaced config, and sorts the rules of that config into these groups:

| Group                                 | Meaning                                                                                                                                                                                                       | What you do                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| covered                               | gspot runs the rule the same way.                                                                                                                                                                             | Nothing.                                                                |
| carried over                          | init wrote the rule into `gspot.toml`. An entry `ignore <rule>` is a rule that you turned off or gave a looser limit. For it, init wrote an `[[ignore]]` record with the reason "Carried over from `<file>`." | Nothing. When you know the real reason, write it in place of that one.  |
| other options, to set after init      | gspot runs the rule with other options. Only `gspot scan` can compare those options.                                                                                                                          | To keep your options, set them in `tools.<tool>.rules`.                 |
| needs a reason                        | `gspot scan` found an ESLint or Stylelint rule that you turned off or gave a looser limit.                                                                                                                    | Fix the findings, or run the `gspot ignore` command that the row names. |
| keep with a plugin record             | The rule comes from a plugin that gspot does not install.                                                                                                                                                     | Add a [plugin record](/configure/lint-rules/#plugins).                  |
| keep with a command check of your own | gspot does not run the rule, and no plugin record can add it.                                                                                                                                                 | Keep it with a [command check](/configure/command-checks/).             |
| dropped                               | `gspot.toml` has no setting for it.                                                                                                                                                                           | Decide whether you still need it.                                       |

gspot reads the rules of each tool from one place:

| Tool         | Rules from                    | Compared by       | `gspot.toml` setting       |
| ------------ | ----------------------------- | ----------------- | -------------------------- |
| Ruff         | `ruff.toml`, `pyproject.toml` | init and scan     | `tools.ruff.rules`         |
| markdownlint | its tool config               | init and scan     | `tools.markdownlint.rules` |
| commitlint   | `commitlint --print-config`   | init and scan     | `tools.commitlint.rules`   |
| ESLint       | `eslint --print-config`       | `gspot scan` only | `tools.eslint.rules`       |
| Stylelint    | `stylelint --print-config`    | `gspot scan` only | `tools.stylelint.rules`    |

To list its own ESLint and Stylelint rules, gspot needs the plugins that `gspot install` adds. `gspot init` makes its
plan before it installs them, so run `gspot scan` before init to see the table for these two tools. commitlint, ESLint,
and Stylelint print your rules with the copy of the tool in your `node_modules`, so run the install command of your
package manager first.

gspot does not compare the rules of the other replaced configs, and the plan lists each of them under `delete`.
`gspot init` reads the Prettier settings in the root folder and in each scope, and the Ruff and markdownlint settings in
the root folder only. The table lists every other config of these three tools as dropped.

To keep a rule of an ESLint or Stylelint plugin, add a `[[tools.eslint.plugins]]` or `[[tools.stylelint.plugins]]`
record. `gspot init` never writes such a record, because a plugin is code that runs in every check.
[Plugins](/configure/lint-rules/#plugins) shows how to add one. To keep a tool that gspot does not run, run it as a
[command check](/configure/command-checks/).

## Commands that still call your old tools

gspot does not edit your scripts, Git hooks, or CI files. Instead, the plan and `gspot scan` list each place that still
calls a replaced tool or duplicates it:

- `package.json` scripts, `lint-staged` entries, and hook lines
- `.pre-commit-config.yaml` entries and CI steps
- root `devDependencies` that gspot also installs, with both versions
- the settings of black, flake8, isort, and mypy

Each row names the line and what to do with it. The check `gspot/conflicting-configs` reports each row until you change
the line. Change these commands, because in a clone where `gspot install` has not run, a script that calls ESLint
cannot load the generated config. In a monorepo, the `lint` scripts of the workspace packages become one `gspot check`
in the root folder, as [Monorepo task runners](/configure/monorepos/#monorepo-task-runners) shows.

## Start from another gspot repository

To set up a new repository with the settings of a repository that already uses gspot, pass the path of its
`gspot.toml` to `--from`. That file is the source file, and the repository that holds it is the source repository:

```shell
gspot init --from ../api/gspot.toml
```

`gspot init` turns on the configurations that the source file lists, and the configurations that it detects in the new
repository. It copies the settings that do not depend on one repository: the level, the limits with their reasons,
naming, formatting, prose, coverage, and the lint rule lists. It also copies the word lists, and each ignore that
covers a whole check or lint rule. A `--level` option overrides the level of the source file.

The plan lists under `left out of <file>` each setting that fits only the source repository:

- settings and records that name paths, such as `test_files` and `[[scope]]`
- settings and command checks that run code
- settings that describe the source repository, such as `javascript.import_extension`
- `ci.enabled` and `ci.provider`, because CI stays off until you turn it on
- ignores that name paths

When the new repository has code, init takes the indentation, line width, and quotes from it: from its own Prettier,
EditorConfig, or Ruff file, or else from the Prettier defaults. The `[format]` table of the source file sets only the
other formatting keys.

`gspot init` turns on each configuration of the source file, even when the new repository has none of its files yet.
Your coding agent then gets the rules of that configuration before it writes the first file. Until such files exist,
the checks of that configuration report `skipped (no-files)`. To turn off a configuration that you do not need, run
`gspot remove <name> --reason "<why>"`.

`gspot init` copies the source file once. Later changes to the source file do not reach the new repository. To share
one setup with a team, keep the shared `gspot.toml` in a repository that everyone clones. To use the file without a
clone, download it at a fixed commit first:

```shell
curl -fsSL -o ../team.toml https://raw.githubusercontent.com/acme/policies/<commit>/gspot.toml
gspot init --from ../team.toml
```

`--from` does not copy the ESLint plugins, Semgrep rule files, or command checks of the source repository, because they
need its files. To share ESLint rules, publish them as an ESLint plugin package and install it in the new repository.
Then name, in `[[tools.eslint.plugins]]`, a module of the new repository that exports the plugin again. To share
Semgrep rule files and command check scripts, copy each file together with its lines in `gspot.toml`.

## Old tool configs found after init

When you later raise the level or add a configuration, a tool starts to run and can find an old config file of its own.
The check `gspot/conflicting-configs` reports such a file, such as `.commitlintrc.json` once commitlint runs. Delete
the file, and move each rule that you need into `gspot.toml`.

If Husky, Lefthook, or a hooks folder of your own runs your Git hooks, gspot leaves it in place. gspot prints one line
to add to each hook, as [Existing hook managers](/use/hooks/#existing-hook-managers) describes.
