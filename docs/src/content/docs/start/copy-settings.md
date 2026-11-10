---
title: Copy settings
---

To set up a new repository with the settings of a repository that already uses gspot, pass the path of its `gspot.toml`
to `--from`:

```shell
gspot init --from ../api/gspot.toml
```

`gspot init` turns on the configurations that the file lists, and the configurations that it detects in the new
repository. It copies the settings that fit any repository: the level, the limits with their reasons, naming, formatting,
prose, coverage, the lint rule lists, and the word lists. It also copies each ignore that covers a whole check or lint
rule. It also copies `hooks.enabled` and `rule_files.enabled`, so a repository that turned off its Git hooks or its rule files
passes that on. A `--level` option overrides the level of the file.

The plan lists under `left out of <file>` each setting that fits only the other repository:

- settings and records that name paths, such as `test_files`, `[[scope]]`, `security.semgrep_rules`,
  `tools.eslint.plugins`, and an ignore with `paths`
- settings and command checks that run code
- settings that describe that repository, such as `javascript.import_extension`
- `ci.enabled` and `ci.provider`, because CI stays off until you turn it on
- settings of a configuration that the new repository does not select, such as `licenses.allowed`, with the note
  `no selected configuration reads it`. To keep one, run `gspot add licenses`, then set it again with `gspot set`

When the new repository has code, init takes the indentation, line width, and quotes from it: from its own Prettier,
EditorConfig, or Ruff file, or else from the Prettier defaults. The `[format]` table of the file sets only the other
formatting keys.

`gspot init` turns on each configuration of the file, even with none of its files in the new repository, so your coding
agent gets its rules before the first file. Until such files exist, its checks report `skipped (no-files)`. To turn off
a configuration that you do not need, run `gspot remove <name> --reason "<why>"`.

`gspot init` copies the file once, so later changes to it do not reach the new repository. To share one setup with a
team, keep the shared `gspot.toml` in a repository that everyone clones. To use the file without a clone, download it at
a fixed commit first:

```shell
curl -fsSL -o ../team.toml https://raw.githubusercontent.com/acme/policies/<commit>/gspot.toml
gspot init --from ../team.toml
```

To share ESLint rules, publish them as an ESLint plugin package and install it in the new repository. Then name, in
`[[tools.eslint.plugins]]`, a module of the new repository that exports the plugin again. To share Semgrep rule files
and command check scripts, copy each file together with its lines in `gspot.toml`.
