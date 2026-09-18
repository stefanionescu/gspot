# Names

This document decides how gspot names things (D-92). One word carries one meaning in the code,
the setting keys, the manifest keys, the flags, and the folders. The glossary in
[README.md](README.md) holds the words and their one meaning. A row below leaves this document
in the commit that applies it.

## Rules a name follows

- A name passes the shipped naming policy. The verbs group bans `generate` and `render`, so the
  folder that writes the generated files is `emit/`, and `emit` means that and nothing else. The
  containers group bans `catalog`, so the keys a selection exposes are the `ExposedSettings`.
- A function that returns a boolean starts with `is`, `has`, `did` or one of the other prefixes
  the lint rule `unicorn/consistent-boolean-name` lists. `didWrite` writes a file and reports
  whether it changed, and the name says both.
- Two files in one folder do not share their first word. When a command has a second file, both
  move into a folder named after the verb: `lifecycle/init/command.ts` beside
  `lifecycle/init/plan.ts`. A command with one file is `<area>/<verb>-command.ts`.
- A list of entries that a gspot check skips has a key that ends in `_allowed`. A tool's own
  option keeps the tool's word, such as `tools.knip.ignore` and `tools.typos.exclude`.
- A check id is `<family>/<name>`, and [04-presets.md](04-presets.md) says what the family is.

## Still to apply

Nothing. Every rename is applied.

## Names that stay

Long constants such as `COMMENT_STYLE_BY_EXTENSION` say what they hold and pass the naming
policy. The plugin rule ids, such as `header-comments-before-imports`, follow the ESLint
convention of a full phrase. `engine.ts` exists once in each engine folder, because the folder
names the engine.
