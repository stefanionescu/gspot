# `language:markdown`

## Claims

```text
.md .mdx .markdown
```

## Tools

| Kind   | Tool                        | Notes                                                                           |
| ------------ | --------------------------- | ------------------------------------------------------------------------------- |
| format       | Prettier                    |                                                                                 |
| style        | `markdownlint-cli2`         |                                                                                 |
| syntax (MDX) | `@mdx-js/mdx` compile check | MDX is JSX, so it also gets `language:typescript` treatment for its expressions |
| links        | `lychee`                    | Offline in hooks, online in `check` and CI                                      |
| prose        | Vale                        | Native grammar, code spans and fences skipped                                   |
| spelling     | `typos`                     |                                                                                 |
| structure    | preset checks                 | Below                                                                           |

### markdownlint configuration

The reference configuration disables four rules and configures six, and every decision is coupled to
another tool:

| Rule                     | Setting          | Coupling                                                                                                                                                        |
| ------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MD013 line length        | off              | Prettier owns line width, at 120. The documentation rules say about 100. Resolved: one `[format].print_width`, and MD013 derives from it rather than being off. |
| MD007 list indent        | 4                | Derived from `[format].indent_width`, not hand-matched to Prettier                                                                                              |
| MD049 emphasis style     | underscore       | Derived from Prettier's output                                                                                                                                  |
| MD046, MD048             | fenced, backtick | Fixed by the preset                                                                                                                                               |
| MD050 strong style       | asterisk         | Derived from Prettier                                                                                                                                           |
| MD024 duplicate headings | siblings only    | Preset default                                                                                                                                                    |
| MD033 inline HTML        | off              | Preset default, with an allowed-tag list instead of a blanket off                                                                                                 |
| MD041 first line heading | on               | Preset default                                                                                                                                                    |

The pattern in that table is the point: five of eight settings exist to agree with Prettier, and the
reference file says so in comments. `repository:formatting` and the `[format]` block derive them
instead.

The line-width conflict is a real one the reference audit records: Prettier wraps at 120 while the
documentation rule says about 100, and markdownlint accepts `1. 2. 3.` ordered-list numbering while
the documentation rule requires `1.` on every item. Both are resolved by generating the three
configurations from one block, so a disagreement is impossible rather than commented.

### Preset structure checks

| Check                    | Enforces                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `md/toc-accurate`        | A `## Contents` list, where present, matches the headings exactly. The reference corpus has 352 H2 headings and a re-casing plan that changes every anchor, which is exactly when this check earns its place. |
| `md/heading-case`        | H1 title case, H2 and below sentence case, per the documentation rules. Vale's `gspot` rules own the text; this owns the structure.                                                                     |
| `md/no-orphan-doc`       | Every tracked Markdown file is reachable: from `README.md`, from the assembled rules index, or from a declared entry list. Catches `rules/DOCUMENTATION.md`, 4,088 lines that nothing links to.               |
| `md/code-fence-language` | Every fence declares a language, and the language is one the repository has a linter for, or `text`                                                                                                           |
| `md/fenced-code-lints`   | A fenced block tagged with a language the repository lints is extracted and linted. A `bash` block with a syntax error in a README fails.                                                                     |

`md/fenced-code-lints` is the Markdown equivalent of the heredoc extraction in [bash.md](bash.md),
and it is genuinely new coverage: the reference `rules/BASH.md` alone contains dozens of shell
examples that no ShellCheck run has ever seen.

## lychee

Offline in hooks, because a hook must not depend on the network, which is the reference repository's
stated reason for `offline = true`. The consequence the audit records is that no external link has
ever been verified.

The preset splits it:

| Task          | Mode                                                | Stage                       |
| ------------- | --------------------------------------------------- | --------------------------- |
| `lint:docs`   | offline, relative links only                        | pre-commit, pre-push        |
| `check:links` | online, every link, with caching and a retry policy | `check`, CI, requires `network` |

The online task is in the graph, so it is not optional and not forgotten. It is simply not in a
hook.

## Required kinds

```text
.md .markdown   format style links prose spelling
.mdx            format style links prose spelling syntax types
```

## Totality

| Habit                                  | Reference evidence                                                                                        | gspot                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| The rule files themselves are excluded | `markdownlint` originally excluded `!rules/**`; removed on the audited branch                             | Claimed. The rule corpus obeys the documentation rules it states. |
| Vendored style packages are linted     | `!**/quality/prose/styles/**` added to the glob list                                                      | `vendored` status, one declaration, not a glob in a tool config   |
| Untracked READMEs on disk get linted   | The reference glob list does not read `.gitignore`, so package READMEs under `node_modules` were an issue | The tracked file list is `git ls-files`, so this cannot happen    |
