# Naming Policy

This document decides the shipped naming policy: its schema, its term lists, its matching rules,
and how a repository extends it. Banned-term matching is a house-style check at level `all`, including reserved terms and
banned folder words. It does not run at `recommended`. `generate` and `service` are permitted
and absent from the shipped banned lists. A repository can explicitly add either at `all`.

Case, name-length, word-count, digit, ordering, and layout preferences also belong to `all`; recommended naming checks are limited to demonstrated external-contract defects. The same level applies to term bans in prose and tool templates. The policy is data. The naming engine in
[05-engines.md](05-engines.md) executes it.

## Why a term list

The rules an agent breaks most are judgments a linter cannot make: prefer duplication over the
wrong abstraction, add no defensive logic for impossible states, keep one implementation per
concept. The term list is the mechanisable shadow of those rules. A speculative guard is named
`ensureConfigIfNeeded`. A parallel implementation is named `enhancedHandler`. A concept with no
owner lands in `utils/common.ts`.

A banned-name finding asks for a house-style change. A spelling alone does not prove that
the declaration is redundant or that its abstraction is wrong.

## Schema

The shipped policy is `presets/concern/naming/policy.json`. The repository extends it through
`[naming]` in `gspot.toml`. Both use one schema.

```json
{
  "version": 1,
  "matching": { "wholeParts": true, "caseInsensitive": true },
  "banDigits": true,
  "banDuplicateWords": true,
  "groups": {
    "containers":   { "removable": true,  "terms": ["..."] },
    "roles":        { "removable": true,  "terms": ["..."] },
    "marketing":    { "removable": false, "terms": ["..."] },
    "defensive":    { "removable": false, "terms": ["..."] },
    "verbs":        { "removable": true,  "terms": ["..."] },
    "verbs-strict": { "removable": true,  "terms": ["..."] },
    "conjunctions": { "removable": true,  "terms": ["..."] },
    "test":         { "removable": true,  "terms": ["..."] }
  },
  "reserved": [
    { "term": "data",    "allowedFor": ["API success envelope field"] },
    { "term": "message", "allowedFor": ["API client message field"] },
    { "term": "id",      "allowedFor": ["identifier word"] },
    { "term": "config",  "allowedFor": ["configuration directory", "configuration file stem", "configuration variable", "configuration property"] },
    { "term": "values",  "allowedFor": ["SQL VALUES clause"] }
  ],
  "external": ["spawnSync", "setTimeout", "clearTimeout", "toJSON", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "..."],
  "languages": { "...": "per-language case tables below" },
  "rules": [ "path-scoped rules, below" ]
}
```

### Groups

Terms are whole identifier parts. One entry covers every separator and casing.

| Group        | Removable | Terms                                                                                                                                                                                                                                                                                                  |
| ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| containers   | yes       | `core`, `common`, `generic`, `misc`, `stuff`, `thing`, `things`, `details`, `info`, `object`, `data` (reserved), `catalog`, `catalogue`, `corpus`, `taxonomy`, `tmp`, `temp`                                                                                                                           |
| roles        | yes       | `helper`, `helpers`, `util`, `utils`, `manager`, `handler`, `processor`, `wrapper`, `shim`, `shims`, `support`                                                                                                                                                                                         |
| marketing    | no        | `advanced`, `enhanced`, `improved`, `intelligent`, `smart`, `modern`, `robust`, `seamless`, `ultimate`, `comprehensive`, `optimized`, `reusable`, `custom`, `final`, `latest`, `old`, `new`, `legacy`, `plus`, `combined`, `v2` (through the digit ban)                                                |
| defensive    | no        | `ensure`, `maybe`, `likely`, `should`, `if needed`, `ifneeded`, `if available`, `ifavailable`, `if changed`, `ifchanged`, `if possible`, `ifpossible`, `or throw`, `orthrow`, `waitfor`, `with retries`, `transient`, `belt and suspenders`, `fallback`, `load bearing`, `load-bearing`, `loadbearing` |
| verbs        | yes       | `render`, `sync`, `synchronize`, `synchronise`, `materialize`, `materialise`, `coerce`, `scoped`, `bind`                                                                                                                                                                                               |
| verbs-strict | yes       | `load`, `loaded`, `loader`, `loaders`, `loading`, `fetch`, `resolve`, `resolving`, `resolution`                                                                                                                                                                                                        |
| conjunctions | yes       | `and`, `or`, `with`, `when`, `what`, `whatever`, `once`, `plus`                                                                                                                                                                                                                                        |
| test         | yes       | `test case`, `testcase`, `under test`, `undertest`, `edge case`, `edge cases`, `snapshot`, `snapshots` (scoped to non-test code)                                                                                                                                                                       |

This is the union of the four reference policies plus `load bearing` (spelled out as `load-bearing`
too, and `loadBearing` through part splitting) and `bind`. Project-specific terms in them (`runpsql`,
`prelock`, `postlock`) do not ship; they belong in a repository's `[naming] banned_terms`.

Terms match declarations: a function, variable, type, file or directory named `bind` fires;
calling `handler.bind(this)` does not, because a call is not a declaration. The Vale
`gspot.idioms` rule refuses `load-bearing` in prose.

### Private names

Two rules connect naming to visibility, both in the structure engine and both at level `all`:

- `structure/private-prefix`.
    - Python: a top-level function, class or constant not listed in `__all__` starts with `_`, and a name in `__all__` never does; a method called from no other module starts with `_`.
    - Bash: a function called from no other file starts with `_`; `main` is exempt.
    - TypeScript, JavaScript and Swift have visibility keywords (`export`, `private`, `fileprivate`), so no prefix is required there. Class members outside the class contract use `#name` in JavaScript and TypeScript and `private` in Swift.
- `structure/private-before-public`. In every language, private declarations come first. Public ones come last.
    - Python: `_` names above public names, with `__all__` last.
    - Bash: `_` functions above the rest, with `main` last.
    - Swift: `private` and `fileprivate` top-level declarations above `internal` and `public` ones.
    - TypeScript and JavaScript: non-exported declarations above exported ones; `import-x/exports-last` enforces it for the export statements and `gspot/private-before-public` for exported declarations.

### File and directory stems

A file and a directory in one folder with the same stem (`turn.ts` beside `turn/`) is a finding
(`structure/file-directory-collision`), because an import of `./turn` names both.

`marketing` and `defensive` are not removable as groups because the rule files state them as
absolutes. Individual names in them take scoped `allowed` entries.

### Digits and duplicate words

`banDigits` refuses a digit in an identifier part (`user2`, `handlerV2`) except where a
path-scoped rule allows it (an `e2e` directory, a migration timestamp, a `uuid_v7` suffix).
`banDuplicateWords` refuses a part that repeats (`userUserId`).

### Reserved terms

A reserved term is banned except in the named uses. The engine reports the use it saw so a
person can add an `allowed` entry that names the kind.

### External names

Names a platform or framework fixes. They are exact identifiers, matched whole, never patterns:
Node globals and APIs (`spawnSync`, `setTimeout`, `clearTimeout`, `URLSearchParams`, `console`,
`document`, `window`, `navigator`, `localStorage`, `sessionStorage`, `CustomEvent`,
`HTMLElement`, `HTMLDialogElement`), HTTP methods, `toJSON`, `ESLint`, Python dunders
and `visit_*` visitor methods, `setUp`, `setUpClass`, `tearDown`, `tearDownClass`, environment
variable names a runtime fixes (`HF_TOKEN`, `CUDA_MODULE_LOADING`, `CODEQL_*`).

The shared policy names no framework. A framework preset carries the names its framework fixes
as `[[naming.rules]]` in its manifest (D-112). The nextjs preset holds the exports of Next.js
and its route file names. The react preset holds the hooks of React, and PascalCase for a
component and its file. Vue, Svelte, and React Native do the same.

Each language preset contributes its external names. A repository adds more under `[naming]
external`.

### Contract properties

Property keys fixed by a protocol, a package option or a data format are exempt when a named file lists them. Examples: HTTP headers (`Content-Type`, `Retry-After`), ARIA attributes, key names (`ArrowUp`), locale tags (`en-GB`), card brands. A repository lists them under
`[naming] contract_properties = [{ file = "...", names = [...] }]`. A property signature in a
type or interface whose name is snake_case or UPPER_SNAKE describes a shape another format
fixes (TOML keys, a JSON API, a generated type). It is exempt from the case check without a listing; a class field is not (D-69).

## Per-language tables

These are the defaults for `[naming.<language>]`; a repository changes them per language and
per category (see Extension below).

| Language   | Files                                       | Directories  | Types                                                     | Functions                  | Parameters | Variables                      | Properties                      | Other                                                       | Max chars | Max words |
| ---------- | ------------------------------------------- | ------------ | --------------------------------------------------------- | -------------------------- | ---------- | ------------------------------ | ------------------------------- | ----------------------------------------------------------- | --------- | --------- |
| TypeScript | kebab                                       | kebab        | pascal                                                    | camel                      | camel      | camel, upper-snake             | camel                           | routes kebab, path parameters camel, operation ids camel    | 35        | 4         |
| JavaScript | kebab                                       | kebab        | pascal (classes)                                          | camel                      | camel      | camel, upper-snake             | camel, upper-snake              | routes kebab                                                | 35        | 4         |
| Python     | snake                                       | snake        | pascal (classes, exceptions ending `Error`, type aliases) | snake (functions, methods) | snake      | snake, upper-snake (constants) | snake, upper-snake (attributes) | modules snake, packages snake                               | 35        | 4         |
| Swift      | pascal, pascal-plus (`View+Extension`)      | pascal       | pascal                                                    | camel                      | camel      | camel                          | camel                           | enum cases camel                                            | 40        | 5         |
| Shell      | kebab, snake                                | kebab, snake | none                                                      | snake                      | none       | snake, upper-snake             | none                            | none                                                        | 35        | 4         |
| SQL        | snake-migration (`YYYYMMDDHHMMSS_name.sql`) | snake        | none                                                      | snake                      | snake      | none                           | none                            | schemas, tables, columns, indexes, triggers, policies snake | 55        | 7         |

Case patterns:

```text
camel           ^[a-z][A-Za-z]*$
pascal          ^[A-Z][A-Za-z]*$
pascal-plus     ^[A-Z][A-Za-z]*(?:\+[A-Z][A-Za-z]*)+$
kebab           ^[a-z]+(?:-[a-z]+)*$
snake           ^[a-z]+(?:_[a-z]+)*$
upper-snake     ^[A-Z]+(?:_[A-Z]+)*$
snake-migration ^\d{14}_[a-z]+(?:_[a-z]+)*\.sql$
```

Digits are excluded from every pattern on purpose; the digit ban reports them with its own
message.

Acronyms follow the language, and the splitter knows which convention it is reading:

| Language               | Acronym form                                                     | Examples                                         |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| TypeScript, JavaScript | a word: initial capital, rest lowercase                          | `parseHttpUrl`, `userId`, `jsonBody`             |
| Swift                  | uppercase initialism; lowercase only when it starts a camel name | `avatarURL`, `userID`, `apiClient`, `HTTPClient` |
| Python, Shell, SQL     | lowercase inside snake_case                                      | `http_url`, `user_id`, `json_body`               |

A run of capitals is one part (`HTTPClient` splits to `http`, `client`; `userID` to `user`,
`id`). A platform name keeps its spelling and is listed under `external` (`XMLHttpRequest`,
`URLSession`).

Predicate functions use state names such as `isFixable`, `hasHeader`, and `canAsk`.
Functions that write, execute, or prompt use action verbs even when they return a boolean.
Do not infer a predicate from the return type alone. Stored booleans and options describe their
meaning, such as `defaultAnswer`, `useDefaults`, or `didChange`; they do not all need an `is`
prefix. SQL boolean columns remain bare predicates such as `enabled` and `retryable`.

These house-style checks run at `all`. The action and parameter contract in
[19-names.md](19-names.md) also applies to the naming rules and lint configuration of gspot itself.

`handle` as a leading verb is a `verbs` finding in the shared policy. A preset whose framework
uses the word allows it in its own rules: react for an event prop (`handleSubmit`), express and
nestjs for a request handler, and swift for an `@objc` selector. `Handler` as a type or role
suffix is always a `roles` finding.

The nextjs preset strips the brackets and parentheses of a route segment before matching:
`[slug]` is a path parameter in camel case, `(group)` is a folder in kebab case, and `@slot`
likewise. `_private` folders drop the underscore.

## Path-scoped rules

```toml
[[naming.rules]]
paths      = ["scripts/steps/*.sh", ".mise/tasks/**"]
categories = ["files"]
structural_prefix = "^\\d{2}-"        # stripped before case and length checks

[[naming.rules]]
paths      = ["**/e2e/**"]
categories = ["directories"]
names      = ["e2e"]
allow_digits = true

[[naming.rules]]
paths      = ["supabase/src/data/**"]
categories = ["directories"]
names      = ["data"]
exclude    = true
reason     = "The Supabase CLI names this directory."

[[naming.rules]]
paths      = ["config/**/*.py"]
categories = ["constants"]
structural_prefix = "^(?:TRT|OTEL|WS|HF)_"
```

A rule narrows by paths, languages and categories, and does one of: exclude the named names,
allow digits, allow duplicate words, strip a structural prefix, or set the case list. Every
exclusion carries a reason.

The shipped policy carries the rules every repository needs:

- `_` and single letters `i j k x y` excluded in loop and lambda positions;
- `__init__` and `__main__` excluded as Python file names;
- `.githooks` and `.mise` excluded as directory names;
- a leading underscore stripped as a structural prefix for private Python and Bash names;
- the same for the unused TypeScript and JavaScript parameters and variables ESLint asks to be marked that way;
- `pre` accepted as a shared prefix in hook directories;

## Matching

1. Split the identifier into parts at case boundaries, underscores, hyphens, dots, and spaces
   (`scule`'s `splitByCase`, with the acronym rule per language applied on top).
   `HTMLParser` splits to `html`, `parser`. `user_id` splits to `user`, `id`.
2. Lowercase every part.
3. A single-word term matches when it equals one part. `uncommon` does not match `common`;
   `andThen` does not match `and`.
4. A multi-word term matches consecutive parts: `edge case` matches `edgeCase`, `edge_case` and
   `edge-case`.
5. The whole identifier is checked against `external` and against exact `allowed` names before
   any term is tried.
6. Case, length and word count are checked after the structural prefix is stripped.
7. A finding names the identifier, the part or term that fired, the category, the file and line,
   and the policy source (shipped group, repository term, or path rule).

Substring matching, which the reference implementation used, is refused. It made the
conjunctions group a false-positive generator (`spawnSync`, `buildValuesList`) and forced
exemptions that whole-part matching does not need.

## Extraction

The engine extracts identifiers with tree-sitter per language and classifies them. One unit test for each language runs the shipped policy over a short file written the way
that language and its frameworks are written, and expects no finding (T-19).

Extraction skips: generated files (by nature), lockfiles, the paths a preset excludes
(`node_modules`, build output, `.git`, caches, `Generated/`, `vendor/`), and string contents.
Three things in a file are not declarations and are not extracted. Declaration files (`.d.ts`) describe another module. Import bindings (`const { existsSync } = require('node:fs')`, `const { default: X } = await import(...)`) belong to the imported module. The keys and methods of object literals name what another party reads (an ESLint visitor, an option table).

The `test` group applies
in non-test code only. The terminology group applies to every file, including tests.

## Extension in `gspot.toml`

```toml
[naming]
banned_terms = ["dispatcher"]
allowed      = [{ name = "createServiceRoleClient", reason = "Supabase API name" }]
external     = ["RTCPeerConnection", "RTCAudioSink"]
reserved     = [{ term = "payload", allowed_for = ["queue message body"] }]
remove_groups = [{ group = "verbs-strict", reason = "A model-serving codebase has real loaders." }]
contract_properties = [{ file = "src/app/api/checkout/route.ts", names = ["Retry-After"] }]

# Ceilings and cases per language, and per category inside a language.
[naming.python]
max_chars = 35
max_words = { value = 5, reason = "Scientific names in this domain are long." }

[naming.python.parameters]
max_words = 3

[naming.typescript.files]
case = { value = ["kebab", "pascal"], reason = "React component files are PascalCase in this repository." }

[[naming.rules]]
# as above
```

`banned_terms` adds. `allowed` exempts exact identifiers with a reason. `remove_groups` drops a
removable group with a reason. `[naming.<language>]` sets `max_chars` and `max_words` for one
language; `[naming.<language>.<category>]` narrows to one category (`files`, `directories`,
`types`, `functions`, `parameters`, `variables`, `properties`) and may also set `case` to a list
of the pattern names above. The shipped per-language table is the default for every key.

A ceiling above the default or a case list wider than the default carries a reason; tighter does
not. Every loosening entry prints in every run.

Each key has a writing command: `gspot set naming.banned_terms dispatcher`,
`gspot set naming.python.parameters.max_words 3`, `gspot set naming.allowed createServiceRoleClient
--reason "..."`, `gspot set naming.remove_groups verbs-strict --reason "..."`. The `marketing`
and `defensive` groups refuse removal by command and by hand alike (D-13).

## Prose shares the list

The Vale `gspot` style bans the words of the `marketing` and `defensive` groups in prose, so a
comment cannot say what an identifier cannot say. The style holds its own lists under
`presets/concern/prose/styles/gspot/`, and a unit test holds each list equal to its group of
`presets/concern/naming/policy.json`.
