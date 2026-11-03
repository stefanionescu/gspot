---
title: Migrate existing tools
description: See what gspot carries over from your configs, what needs a reason, and which commands to change.
---

gspot replaces the config files of the tools it runs, and `gspot.toml` becomes the one place for their settings. Move a
repository in these steps:

1. Run `gspot scan`. It changes nothing in your repository, and prints the plan of `gspot init`.
2. Commit your config files, so that Git holds the versions that init replaces.
3. Run `gspot init`, then `gspot install`.
4. Work through the table and the list of commands that `gspot scan` printed.
5. Run `gspot baseline` to keep the findings that predate gspot.

## Read the plan

`gspot init` prints its plan and writes without asking. To read the plan first, run `gspot scan`: it prints the plan of
the default level and changes nothing in your repository.

When the repository does not pin gspot, init adds the pin to `package.json`, or to `mise.toml` in a repository without
a `package.json`. Init installs nothing, so its last line names the install to run before `gspot install`.

The level decides which tools run and which config files init replaces. To start at level `all`:

```shell
gspot init --level all
```

To select configurations explicitly, use `gspot init --configurations typescript,react`. Repeat `--configurations`
to add more names, such as `--configurations vitest`. See [Choose configurations](/configure/gspot-toml/#choose-configurations).

The plan has these parts:

| Part                                           | What gspot does                                                                                                                 | What you do                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `write`                                        | Writes `gspot.toml`, `.gspot/`, and the generated files.                                                                        | Commit them after `gspot install`.                                              |
| `delete`                                       | Deletes the config files that gspot replaces, such as `.eslintrc.json` and `ruff.toml`. Git keeps them: `git show HEAD:<path>`. | Read the table of what init carries.                                            |
| `keep`                                         | Keeps tool sections in shared files, such as `[tool.ruff]` in `pyproject.toml`, and your CI files.                              | Delete each tool section. `gspot/conflicting-configs` reports it until it goes. |
| `change`                                       | Adds its managed block to `.gitattributes`, and sets keys in your own files, such as the Stylelint fields of `package.json`.    | Review the change.                                                              |
| `lint folders; delete when nothing calls them` | Names folders of lint scripts, such as `lint/`, for you to review; it does not change or stop them.                             | Check that nothing uses them, then delete them.                                 |
| the table of what init carries                 | Names what init wrote into `gspot.toml`, and what it could not.                                                                 | Run the lines that the table names.                                             |
| `lint commands`                                | Lists each command that calls a replaced tool. gspot edits none of them.                                                        | Replace or delete each one.                                                     |

## Style

init reads the options of your formatters and writes them into `[format]`, so code that passes today keeps passing:

- Prettier: the indent style, indent width, line width, quotes, semicolons, trailing commas, `bracketSpacing`,
  `arrowParens`, and `proseWrap`, from a JSON, YAML, or TOML file, the `prettier` key of `package.json`, or a JavaScript
  or TypeScript config. Each `overrides` entry becomes a `[[format.override]]` record.
- `.editorconfig`: the indent style, indent width, line width, and quote type. A value of `unset` leaves the option out,
  and the table lists a line width of `off` as dropped.
- Ruff: `line-length`, `indent-width`, `format.indent-style`, and `format.quote-style`, in a `[[format.override]]` record
  for the Python files.

init loads a JavaScript or TypeScript Prettier config as Prettier does, so the code of that file runs. When the file
does not load, the plan says so, and you set `format.indent_width` and `format.print_width` by hand. Prettier has more
options than `gspot.toml` holds, such as `quoteProps`. The table lists each of those as dropped. It does the same for a
value that `gspot.toml` cannot hold, such as the Ruff quote style `preserve`, and for a config file that does not parse.

A config that init replaces never stops init or `gspot scan`. A `package.json` below the root or a `pyproject.toml` that
does not parse gets a row too, and gives no dependencies or scope. A `tsconfig.json`, `pnpm-workspace.yaml`, `mise.toml`,
or root `package.json` that does not parse stops init, and the error names the file.

For a repository that has code, unspecified widths and quotes follow the defaults of Prettier: 2 spaces, 80 columns,
and double quotes. Python files follow the defaults of Ruff, through a `[[format.override]]` record: 4 spaces, 88
columns, and double quotes. Swift and SQL files keep the defaults of their formatters in the same way. Only a
repository without code gets the defaults of gspot: 4 spaces, 120 columns, and single quotes. Review the first
`gspot check` before using `--fix`.

## Ignored paths

`.prettierignore`, `.eslintignore`, and the Ruff `exclude` and `extend-exclude` settings become `[[ignore]]` records with
paths. init keeps a pattern when it matches a tracked file, because gspot reads only tracked files. A pattern that
starts with `!` has no place in an ignore, so the table lists it as dropped.

## Rules

gspot compares the names and options of your rules with the rules it runs. The table prints one row per replaced config:

| Group                                 | Meaning                                                                                                                                                                                           | What you do                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| covered                               | gspot runs the rule the same way.                                                                                                                                                                 | Nothing.                                                    |
| carried over                          | init wrote the rule into `gspot.toml`. An `ignore <rule>` entry is a rule you turned off, or gave a looser limit: init wrote an `[[ignore]]` record with the reason "Carried over from `<file>`." | Nothing. Replace the reason with your own when you know it. |
| other options, to set after init      | gspot runs the rule with other options, and only `gspot scan` could compare them.                                                                                                                 | Set them in `tools.<tool>.rules` if you want to keep them.  |
| needs a reason                        | `gspot scan` found an ESLint or Stylelint rule that you turned off, or gave a looser limit.                                                                                                       | Fix the findings, or run the `gspot ignore` line it names.  |
| keep with a plugin record             | The rule comes from a plugin that gspot does not install.                                                                                                                                         | Add a [plugin record](/configure/lint-rules/#plugins).      |
| keep with a command check of your own | gspot does not run the rule, and no plugin record can add it.                                                                                                                                     | Keep it with a [command check](/configure/command-checks/). |
| dropped                               | `gspot.toml` has no place for it.                                                                                                                                                                 | Decide whether you still need it.                           |

Each tool reads its rules from one place:

| Tool         | Rules from                    | Compared by       | `gspot.toml` setting       |
| ------------ | ----------------------------- | ----------------- | -------------------------- |
| Ruff         | `ruff.toml`, `pyproject.toml` | init and scan     | `tools.ruff.rules`         |
| markdownlint | its config file               | init and scan     | `tools.markdownlint.rules` |
| commitlint   | `commitlint --print-config`   | init and scan     | `tools.commitlint.rules`   |
| ESLint       | `eslint --print-config`       | `gspot scan` only | `tools.eslint.rules`       |
| Stylelint    | `stylelint --print-config`    | `gspot scan` only | `tools.stylelint.rules`    |

gspot resolves its own ESLint and Stylelint rules through the plugins that `gspot install` adds, and init installs
nothing. Run `gspot scan` before init to see their table. commitlint, ESLint, and Stylelint print your rules through
the copy in your `node_modules`, so run your package manager's install first.

gspot does not compare the other replaced configs. The plan lists each of them under `delete`. init reads the settings
of Prettier at the root and at a scope, and the settings of Ruff and markdownlint at the root. The table names every
other config of these tools as dropped.

To keep a rule of an ESLint or Stylelint plugin, add a `[[tools.eslint.plugins]]` or `[[tools.stylelint.plugins]]`
record. init never writes one, because a record adds code that runs in every check. See
[plugins](/configure/lint-rules/#plugins). A tool that gspot does not run can remain a
[command check](/configure/command-checks/).

## Lint commands

gspot edits no script, hook, or CI file. The plan and `gspot scan` list what still calls or repeats a replaced tool:

- `package.json` scripts, `lint-staged` entries, and hook lines
- `.pre-commit-config.yaml` entries and CI steps
- root `devDependencies` that gspot also installs, with both versions
- the settings of black, flake8, isort, and mypy

Each row names the line and what to do with it. `gspot/conflicting-configs` reports each row until it goes. Change these
commands, because CI runs no `gspot install`, so a script that calls ESLint cannot load the generated config.

## Start from another gspot repository

`gspot init --from <settings-file>`, with the `gspot.toml` of another repository, copies settings that apply across repositories and selects the
configurations named there. The plan lists settings it leaves out because they name the old repository's files or
folders. It detects the new repository's scopes and files again. Review the resulting `gspot.toml` before installing
tools.

## Findings in existing code

The first `gspot check` reports what the code holds today. To fix those findings over time, run `gspot baseline`. See
[Keep the findings that predate gspot](/use/ignore/#keep-the-findings-that-predate-gspot).

## Old settings files after init

When you raise the level or add a configuration later, a tool that starts to run can find its old settings file.
`gspot/conflicting-configs` reports such a file, such as `.commitlintrc.json` while commitlint runs. Delete it, and move
any rule you need into `gspot.toml`.

If Husky, Lefthook, or your own hooks folder runs your Git hooks, gspot keeps it and prints one line to add to each
hook; see [Existing hook managers](/use/hooks/#existing-hook-managers).
