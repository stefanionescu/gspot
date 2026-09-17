# Total Coverage: The Coverage

This is the requirement nothing in the reference repositories meets, and the reason to build gspot
rather than assemble another `quality/` folder.

The requirement, restated: once a language is chosen, every file of that language is covered,
without exception, and the consumer extends the exceptions from its own configuration rather than by
editing gspot.

## The failure mode being designed against

`yap-swift-app` runs 40-plus tools with 102 mise tasks and two git hooks, and:

- sqlfluff lints 25 of 83 SQL files because one line in `.sqlfluffignore` reads `sql/`, and
  gitignore semantics match that against two nested directories the author did not intend. Nine
  `.pgsql` files match nothing at all. Two more SQL files are in no path list.
- 982 PNG, 112 JPG and 79 WAV files are seen by secret scanners only.
- Nine TOML files, including the one that pins every tool, get spell check and end-of-line
  normalisation only.
- `project.pbxproj`, four `.xcconfig`, four `.entitlements`, three `.xcstrings`, two `.plist`, one
  storyboard, the schemes and the test plan are checked by nothing, and `pbxproj` is excluded from
  the spell checker.
- 129 shell files under `.mise/tasks/`, `.githooks/` and `quality/` get ShellCheck and shfmt but not
  the project rules, because the rule table knows only three project prefixes.
- Two checks exit zero when the Docker daemon is down, and did so during the audit, in both hooks.

Nobody was careless. The configuration is dense, well commented, and wrong in ways that reading
cannot find. The only fix is to compute coverage from the tools themselves and fail on the gap.

## The tracked file list

```text
tracked files = git ls-files
```

Tracked files only. An untracked file is not part of the repository yet.

Submodules are excluded and reported as a count. Symlinks are resolved and the link itself is
classified: `yap-swift-app` has `ios/Yap/Services` as a tracked symlink to `Info.plist`, which is
exactly the kind of thing a coverage has to say out loud rather than follow silently.

The tracked file list is not filtered by `.gitignore`, because `git ls-files` already respects it,
and it is not filtered by any tool's ignore file. A tool's ignore file is an input to a file listing, never
to the tracked file list. That inversion is the whole trick.

### Ignored files, and tools that scan on their own

A consumer never tells gspot what to skip; git already did. Anything `.gitignore`
excludes is untracked, untracked files are outside the tracked file list, and the
coverage check never sees them. There is no gspot-side copy of `.gitignore` to
keep in sync, and no second ignore syntax to get wrong.

The gap is tools that walk the tree themselves. markdownlint, typos, Vale and
jscpd resolve their own globs, and each of them reads `node_modules` and vendored
directories unless told not to. The bootstrap on this repository proved it: Vale
read the READMEs inside downloaded style packages. Two rules close it:

- A tool that accepts a file list (`takes = file-list`) receives the
  tracked files, never a glob.
- A tool that insists on scanning (`takes = project`) gets its native ignore
  file rendered by gspot from git's own answer, `git ls-files --others --ignored
  --exclude-standard --directory`, so its exclusions mirror `.gitignore` exactly.
  File listing then compares what the tool reported against the tracked files, and a
  file outside that set is a failure, not a finding.

`.gitignore` is exempt from the referent assertion every other configuration file
gets, because most of its entries name build output that is never in the tree.

## Claims, and why they are reported by the tool

A claim is `(check, path, inspection)`. The coverage check builds the claim set by running every
file listing, and a file listing answers one question: which paths would this tool process right now, under the
configuration gspot generated?

### File listing mechanisms

| Kind            | Command shape                                                                             | Tools                                                                                                                                                                        | Trust                                      |
| --------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `file-list`     | The tool enumerates its own inputs                                                        | `ruff check --show-files`, `stylelint --print-config` per file, `sqlfluff lint --nofail` with ignore notices parsed, `taplo check --verbose`                                 | high                                       |
| `print-config`  | Ask per candidate; no config means no claim                                               | `eslint --print-config <path>`, `markdownlint-cli2` with a resolved glob set                                                                                                 | high                                       |
| `project-graph` | The tool reports the graph it built                                                       | `tsc --listFiles`, `knip --reporter json`, `lint-imports` with the resolved package set, `xcodebuild -showBuildSettings` plus the target file list, `swift package describe` | high, and catches graph omissions          |
| `check-mode`  | Run the tool in check mode over the candidate set and attribute every path it reported on | `prettier --check`, `shfmt -l`, `shellcheck` with a file list, `vale --output=JSON`                                                                                          | high                                       |
| `ignore-replay` | gspot replays the tool's documented ignore semantics                                      | `typos`, `gitleaks`, `hadolint`, `jscpd`                                                                                                                                     | medium, fixture-tested                     |
| `declared`      | The preset asserts the set                                                                  | `plutil -lint` over a filename list, `actionlint` over `.github/workflows/*`                                                                                                 | low, annotated as unverified in the report |

Every `ignore-replay` file listing has a small tree beside its test in `src/coverage/`, and a test
asserting that the replay agrees with the real tool for each idiom: bare directory name, trailing
slash, leading slash, negation, `**`, character class, extension glob, and case sensitivity. The
`.sqlfluffignore` defect is a failing case of exactly that test.

### The Xcode and build-graph case

`swiftlint` lints files it is pointed at. `xcodebuild` compiles files the `.xcodeproj` lists. Those
two sets are not the same, and the difference is a real class of bug: a Swift file present in the
tree, linted, and not a member of any target, compiles nowhere. The `project-graph` file listing for
`tool:xcode` reports both sets and the coverage check flags the symmetric difference:

- In the tree, not in a target: `orphan-source`, fails.
- In a target, not in the tree: broken project file, fails.

No tool in `yap-swift-app` computes that.

## Kind required inspections

Coverage is per inspection, not a boolean. A preset declares, per extension, the inspections a file
must have.

The default required inspections for a source language:

```text
format, syntax, style, structure, naming, prose, spelling
```

Plus `types` where the language has a type checker, and minus `prose` where the language has no
comment grammar Vale can read and no stdin mapping exists.

Required inspections are the mechanism that makes a partial answer visible. A `.toml` file under `repository:configuration`
has the required inspections `format, syntax, schema, spelling`. Before `repository:configuration`, the nine TOML files in
`yap-swift-app` had `spelling` and nothing else, which the coverage check reports as `partial`
with the missing set named: `format, syntax, schema`.

Weak inspections (`spelling`, `security`) never satisfy a required inspection on their own.

## Statuses and the gate

```text
for each path in the tracked files:
    checks  = every (check, inspection) whose file listing returned this path
    nature  = classify(path)            # text, binary, generated, frozen, vendored
    required = required_for(nature, path)

    if an exception covers path:                 excepted
    elif nature is vendored:                   vendored       (requires security, dependencies)
    elif nature is generated:                  generated      (requires security, freshness)
    elif nature is frozen:                     frozen         (requires security, freshness)
    elif nature is binary:                     binary         (requires security)
    elif checks is empty:                    UNCHECKED      -> fail
    elif checks are all partial:             PARTIAL        -> fail unless declared
    elif required inspections is not satisfied:           PARTIAL  -> fail, naming the missing set
    else:                                    covered

for each config artifact and rule file gspot wrote:
    if no check reads it:                    ORPHAN         -> fail
```

Three failing statuses, one declaration mechanism, no silence and no "unknown" bucket.

### Classification inputs

| Signal                                                                                 | Effect   | Precedence |
| -------------------------------------------------------------------------------------- | -------- | ---------- |
| `gspot.toml` `[[declare]]` | Explicit | 1          |
| `.gitattributes` `linguist-generated`, `linguist-vendored`, `-text`, `filter=lfs`      | Derived  | 2          |
| A generated-file header the preset declares, for example the Supabase types banner       | Derived  | 3          |
| Content sniff for binary                                                               | Derived  | 4          |

`yap-swift-app` already marks 60-plus image and media extensions with `filter=lfs -text` in
`.gitattributes`, so the binary classification for 1,173 asset files is free. That is why
`.gitattributes` is a classification input rather than something gspot asks about.

## Do not report what nobody can fix, applied to statuses

Four of the statuses exist because of one principle: **a check whose findings nobody may act on is
noise.** A finding is actionable when the reader may edit the file it names. Four classes fail that
test, and each gets the checks that are actually actionable instead.

| Class              | Why a normal lint is unactionable                                             | What runs instead                                                                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Build artifact** | Not tracked, regenerated on every build, and the next build discards any edit | Nothing. The artifact is outside the tracked file list. Output invariants (size limit, performance limit, link resolution, reproducibility, no leaked build input) run as their own inspection, which is not linting. |
| **Generated file** | The generator is the only edit site                                           | `freshness` (run the generator, diff the committed bytes), `determinism` (run it twice, compare), `secrets`                                                                                                           |
| **Frozen file**    | Editing it is forbidden by the project's own rule                             | `freshness` (bytes match the commit that froze it), `secrets`                                                                                                                                                      |
| **Vendored file**  | Patched only by rebasing on upstream                                          | `security`, `dependencies`                                                                                                                                                                                                  |

`freshness` is the one that matters most, because no reference repository performs it. Three
generated type files are excluded from every tool and nothing verifies they match the database. A
migration landing without a type regeneration passes the whole gate today.

The inverse also holds, and it is the reason build artifacts are excluded rather than declared: **a
check that needs rules disabled to pass is telling you it should not run.** See "What to reject" in
[01-findings.md](01-findings.md) for the measured instance: five of seven rules disabled so built
HTML would pass, leaving one rule that the source check already enforced.

## Full coverage per language

Full coverage of the repository says every path has a status. Full coverage per language is the
stronger claim in the requirement, and it is a separate assertion:

> When preset `language:X` is selected, every path whose extension is in
> `language:X.claims.extensions` is `covered` under `language:X`'s required inspections, or carries an explicit
> declaration naming that extension.

Three consequences:

1. **A test directory is not an exception.** `yap-swift-app` omits `tests/**` from the api
   type-aware ESLint file list while including it for Supabase. Under full coverage per language
   that omission is `partial` with `types` missing, and the fix is either to include it or to
   declare it.
1. **A generated file is not an exception, it is a declaration.** The generated Supabase and OpenAPI
   type files carry `[[declare]]` entries naming the task that produces them. gspot then runs that
   task and diffs, which is the only assertion about a generated file worth making.
1. **An excluded-from-type-check file is a declaration with a reason.**
   `yap-text-inference/pyrightconfig.json` excludes ten source files. Under gspot those ten entries
   become `[[exception]]` entries with a reason each, and they appear in every run report until
   they are gone.

## The coverage check output

`.gspot/coverage.json` is tracked. It is the full path table, one row per path:

```json
{
  "version": 1,
  "generatedAt": "2026-09-16T00:00:00Z",
  "gspot": "0.1.0",
  "trackedFiles": 3330,
  "summary": {
    "covered": 3901, "generated": 12, "vendored": 4, "binary": 1173,
    "excepted": 6, "partial": 0, "partial": 0, "unchecked": 0, "orphan": 0
  },
  "paths": {
    "supabase/tests/suites/sql/rls/versioning.test.sql": {
      "status": "covered",
      "checks": [
        { "check": "sql/sqlfluff", "inspects": ["format", "style"], "file_list": "asks-tool" },
        { "check": "structure/function-length", "inspects": ["structure"], "file_list": "declared" },
        { "check": "prose/vale", "inspects": ["prose"], "file_list": "check-mode" },
        { "check": "spell/typos", "inspects": ["spelling"], "file_list": "ignore-replay" }
      ]
    }
  }
}
```

Tracking it has three payoffs:

- **A pull request that loses coverage shows a diff.** A file moving from `covered` to `partial` is
  visible in review, which is the review signal `yap-swift-app` never had.
- **`gspot coverage --diff` is a fast gate.** The hook compares the current coverage against the
  tracked one and fails on any regression, without needing the full run.
- **The claim list is the documentation.** "Which tool checks this file" becomes a lookup rather
  than an archaeology exercise.

## Skipped is not passed

A parallel gate, from the same evidence. `quality/nginx/lint.js` and the Trivy runner exit zero when
Docker is unavailable, and both did so during the audit run in both hooks. Coverage was 100 percent
on paper and zero in fact.

Every check declares `skip_when`. When it fires, the result is `skipped(reason)`. A skip because
the platform cannot run the check, for example Linux-only dependencies on macOS, passes and is
reported. Every other skip fails, with this message shape:

```text
skipped  docker/nginx-config      docker daemon unavailable
         This check is required. To skip it on this machine only:
           gspot.local.toml:  skip = ["docker/nginx-config"]
         To turn it off for everyone, add an [[exception]] with a reason in gspot.toml.
```

`gspot.local.toml` is untracked, so a local skip never becomes the team's default, and the run
report records it either way.

## Run time

The coverage check interrogates every tool, which is the expensive part. Three mitigations:

| Mode                             | When               | Time                                                                                                                                    |
| -------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `gspot coverage`                 | Full file listing sweep   | Seconds to a minute on a 4,000-file tree, dominated by `tsc --listFiles` and `xcodebuild`                                               |
| `gspot coverage --diff`          | Hooks              | Recomputes only paths whose classification inputs changed, plus every path in the staged set, and compares against the tracked coverage |

File listing results live in the check-result cache of [09-gates.md](09-gates.md), keyed by the
hash of the generated config plus the hash of the candidate path list. A config change invalidates
the cache, which is correct
and also the mechanism that fixes the `yap-swift-app` bug where editing lint policy never re-lints
the project.

The full coverage belongs to pre-push and to `gspot check --all`. The diff coverage belongs to
pre-commit.

## What the coverage check does not prove

Stated so nobody over-reads it:

- It proves a tool **processed** a file, not that the rule set is **good**. A file linted by ESLint
  with two rules enabled is `covered` for `style`. Rule-set quality is what the preset defaults are
  for, and what the baseline measures.
- It cannot verify a `declared` file listing. Those rows are annotated, counted, and listed in the report
  as unverified, and the roadmap moves them down the trust table over time.
- It says nothing about string literals. Prose inside an error message or a prompt is invisible to
  Vale, and the 248 em dashes inside prompt strings in `yap-swift-app` stay invisible.
  [11-prose.md](11-prose.md) names the adjacent owners for that class.
