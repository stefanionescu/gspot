# Tests: parsers and settings

577 rows. delete 216, keep 154, move 140, merge 36, split 18, inline 13.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `tests/cli/parsers/bash.test.ts`

- (the file) (file): **move** to `tests/unit/cli/parsers/bash.test.ts`. Tests parsers/bash.ts (PAR-007); its data goes to tests/config/bash/checks.ts.
- Bash comments preserve quoted and parameter hashes in %s (test (test.each), 5-8): **keep** to `tests/unit/cli/parsers/bash.test.ts` `Bash comments keep quoted and parameter hashes as code: %s`. Real behavior; plain title (TTC-032).
- COMMENT_CASES (test (test.each), 5-5): **keep** to `tests/unit/cli/parsers/bash.test.ts` `Bash comments keep quoted and parameter hashes as code: %s`. Table of the test above; its rows come from tests/config/bash/checks.ts (BASH_COMMENT_CASES).
- masked comments retain code line numbers and omit blank lines (test (test), 10-13): **keep** to `tests/unit/cli/parsers/bash.test.ts` `comment masking keeps line numbers and drops blank lines`. Real behavior; plain title (TTC-032).
- native Bash syntax resolves only exact temporary cleanup paths in $source (test (test.each), 15-21): **keep** to `tests/unit/cli/parsers/bash.test.ts` `only a trap that removes exactly the mktemp path counts as cleanup: $source`. Real behavior; title from TTC-032.
- TEMPORARY_CASES (test (test.each), 15-15): **keep** to `tests/unit/cli/parsers/bash.test.ts` `only a trap that removes exactly the mktemp path counts as cleanup: $source`. Table of the test above; its rows come from tests/config/bash/checks.ts (MKTEMP_CLEANUP_CASES).
- Bash functions retain source ranges, bodies, statements, and positional reads (test (test), 23-43): **keep** to `tests/unit/cli/parsers/bash.test.ts` `Bash functions report their lines, bodies and the highest positional parameter they read`. Real behavior; PAR-002 drops the statements field and the minimumStatements option from the expectations.
- Bash one-line functions distinguish owned parameters from nested functions and quoted command arguments (test (test), 45-56): **keep** to `tests/unit/cli/parsers/bash.test.ts` `one-line Bash functions count only their own parameters, not those of nested functions`. Real behavior; PAR-002 drops the minimumStatements option.

## `tests/cli/parsers/command.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/framework/nextjs.test.ts`. PAR-021: parseNextBuildFlags moves with nextSettingsFindings into checks/framework/nextjs.ts, so its test joins that check's test.
- Next.js build scripts preserve quoted paths and empty flags while refusing unresolved expansions (test (test), 4-11): **keep** to `tests/unit/cli/checks/framework/nextjs.test.ts` `next build flags keep quoted paths and empty flags and refuse unresolved expansions`. Real behavior; moves with its file (PAR-021).
- Next.js build scripts decode an escaped space as one literal argument (test (test), 13-15): **keep** to `tests/unit/cli/checks/framework/nextjs.test.ts` `next build flags read an escaped space as part of one argument`. Real behavior; moves with its file (PAR-021).

## `tests/cli/parsers/comments.test.ts`

- (the file) (file): **move** to `tests/unit/cli/parsers/comments.test.ts`. Tests parseComments and commentText in parsers/comments.ts (PAR-007); its data goes to tests/config/comments.ts.
- a shell comment after a quoted apostrophe stays a comment while quoted marker text stays literal (test (test), 13-17): **keep** to `tests/unit/cli/parsers/comments.test.ts` `a Bash comment after a quoted apostrophe is a comment, and quoted marker text is not`. Real behavior; plain title.
- an unterminated SQL %s value hides the comment text after it (test (test.each), 19-22): **keep** to `tests/unit/cli/parsers/comments.test.ts` `an unterminated SQL %s value hides the comment text after it`. Real behavior.
- \["'", "E'", '"'\] (test (test.each), 19-19): **keep** to `tests/unit/cli/parsers/comments.test.ts` `an unterminated SQL %s value hides the comment text after it`. Table of the test above; same decision.
- %s preserves the comment boundary (test (test.each), 24-26): **keep** to `tests/unit/cli/parsers/comments.test.ts` `%s keeps the comment boundary`. Real behavior.
- COMMENT_BOUNDARIES (test (test.each), 24-24): **keep** to `tests/unit/cli/parsers/comments.test.ts` `%s keeps the comment boundary`. Table of the test above; its rows come from tests/config/comments.ts.
- markedLines (function, 6-11): **move** to `tests/unit/cli/parsers/comments.test.ts` `markedLines`. Helper of the three tests in the file; rewrite its comment as two sentences (IGN-002). Values to config: MARKER_COMMENT = /^(?:\\/\\/|#|--|&lt;!--) ?marker:/u -&gt; tests/config/comments.ts

## `tests/cli/parsers/configurations/checks.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/configurations/manifests.test.ts`. Tests parseManifest (configurations/manifests.ts) and the manifest rules; PAR-009 moves the manifest schema out of parsers/, so the test leaves parsers/ and joins declarations.test.ts.
- parseManifest check declarations (describe (describe), 8-51): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- parseManifest check declarations &gt; file isolation refuses the incomplete command %s (test (test.each), 9-18): **keep** to `tests/unit/cli/configurations/manifests.test.ts` `a check that runs in a scratch copy refuses an incomplete command: %s`. Real: a manifest rule, not a schema line (TPP-016 keeps file isolation). Glossary: scratch copy.
- parseManifest check declarations &gt; \['runs = "once"\\ncommand = \["x", "{files}"\]', 'command = \["x"\]'\] (test (test.each), 9-9): **keep** to `tests/unit/cli/configurations/manifests.test.ts` `a check that runs in a scratch copy refuses an incomplete command: %s`. Table of the test above; same decision.
- parseManifest check declarations &gt; file isolation accepts the complete command %s (test (test.each), 20-29): **delete**. Weak: only checks that nothing is thrown; the shipped docker, jest and markdown manifests, which every test loads, hold complete scratch-copy commands.
- parseManifest check declarations &gt; \['command = \["x", "{files}"\]', 'runs = "scope"\\ncommand = \["x", "{root}"\]'\] (test (test.each), 20-20): **delete**. Weak: table of the test above.
- parseManifest check declarations &gt; manifest loading rejects $name at its declared field (test (test.each), 31-40): **delete**. TPP-010: the empty command is tested once, in the schema agreement cases.
- parseManifest check declarations &gt; \[{ name: 'an empty command', execution: 'command = \[\]', message: 'check.0.command' }\] (test (test.each), 31-31): **delete**. Table of the test above; same decision.
- parseManifest check declarations &gt; a generated configuration needs a reader in its manifest or the configuration it requires (test (test), 42-50): **keep** to `tests/unit/cli/configurations/manifests.test.ts` `a generated tool file needs a check that reads it, in its manifest or a configuration it requires`. Real: manifest rule (manifestErrors).
- every tool named by a manifest command is declared by a shipped configuration (test (test), 53-73): **delete**. Polices the shipped manifests (TPP-012).
- native tool metadata refuses %s (test (test.each), 75-87): **delete**. TPP-016: restates schema lines; bare toThrow (TPP-018).
- \[ 'requires = \[1\]', 'requires = \[""\]', 'when = { setting = 1 }', 'when = { setting = "architecture.modul (test (test.each), 75-81): **delete**. Table of the test above; same decision.
- native file-to-tool metadata refuses %s (test (test.each), 89-98): **delete**. TPP-016: restates schema lines; bare toThrow (TPP-018).
- \['tool = { "package.json" = 1 }', 'tool = { "package.json" = "" }'\] (test (test.each), 89-89): **delete**. Table of the test above; same decision.
- native declaration references refuse an undeclared peer: %s (test (test.each), 100-110): **delete**. assertManifests moves to the build script (LIF-007, ROOT-017), which runs it on every shipped manifest, and the owner deletes the tests of scripts/.
- \[ 'requires = \["missing-peer"\]', '\\n\[\[check\]\]\\nname = "parse"\\n${CHECK_FIELDS}command = \["native"\]\\ntool = { "pa (test (test.each), 100-103): **delete**. Table of the test above; same decision.

## `tests/cli/parsers/configurations/declarations.test.ts`

- (the file) (file): **move** to `tests/unit/cli/configurations/manifests.test.ts`. Tests parseManifest and the manifest schema (PAR-009); checks.test.ts joins it, and its tables come from tests/config/configurations.ts.
- the folder gives a configuration its name and kind, and the \[configuration\] table cannot repeat them (test (test), 16-32): **keep** to `tests/unit/cli/configurations/manifests.test.ts` `the folder gives a configuration its name and group, and [configuration] cannot repeat them`. Real: parseManifest rule; group names per NMU-009.
- a template pointer rejects a conflicting emission mode (test (test), 34-43): **delete**. TPP-016: restates a strictObject line; its title is wrong (TPP-033).
- query-pack metadata refuses a version range and accepts an exact release (test (test), 45-58): **keep** to `tests/unit/cli/configurations/manifests.test.ts` `a query pack needs an exact version, not a range`. Real: version refinement.
- a tool names its rule page with the rule placeholder and its crash pattern as a regular expression (test (test), 60-82): **keep** to `tests/unit/cli/configurations/manifests.test.ts` `a tool rule page needs the {rule} placeholder, and its crash pattern must be a regular expression`. TPP-016 keeps both refinements.
- a tool refuses invalid prefix metadata %s (test (test.each), 84-91): **delete**. TPP-016: restates z.string().min(1).
- \['rule_prefix = ""', 'rule_prefix = 1'\] (test (test.each), 84-84): **delete**. Table of the test above; same decision.
- tool suppression metadata validates an inline pattern without requiring it (test (test), 93-115): **delete**. Duplicate: once PAR-026 makes one regexSchema, the bad-pattern refusal is the crash-pattern case of 'a tool rule page needs the {rule} placeholder, and its crash pattern must be a regular expression'; the optional inline marker restates the schema (TPP-016).
- tool failure headers validate their pattern and survive manifest parsing (test (test), 117-128): **delete**. PAR-026 makes one regexSchema, whose refusal the crash-pattern and suppression tests already cover; the kept field restates a schema line (TPP-016).
- companion tools refuse a configuration with no consuming tool or check (test (test), 130-137): **keep** to `tests/unit/cli/configurations/manifests.test.ts` `a companion tool file needs a tool or check that reads it`. TPP-016 keeps the companion-tool refinement.
- syntax selector coverage has no separate level declaration and retains its file and allowance fields (test (test), 139-156): **delete**. Self-policing: its level loop checks a removed key (TPP-003), the field assertion restates the selector schema (TPP-016), and the selector tests of generation/eslint/blocks.test.ts cover files and allowed.
- Semgrep packs infer their scoped security declaration while explicit unrelated targets stay authored (test (test), 158-173): **keep** to `tests/unit/cli/configurations/manifests.test.ts` `Semgrep rule packs in the configuration folder become tool files read by the security configuration`. Real behavior; plain title (no "authored").
- every shipped setting declares a default (test (test), 175-181): **delete**. Polices the shipped manifests (TPP-012).
- settings omit neutral direction and retain only actual enforcement directions (test (test), 183-195): **delete**. TPP-016: copies the direction enum.
- configuration product names validate once as native manifest words (test (test), 197-207): **delete**. TPP-016: restates z.array(z.string()).
- a manifest cannot hide authored paths through $path (test (test.each), 209-213): **keep** to `tests/unit/cli/configurations/manifests.test.ts` `a manifest cannot ignore a path outside .gspot: $path`. TPP-016 keeps the isIgnoredPath refinement.
- IGNORED_PATH_REFUSALS (test (test.each), 209-209): **keep** to `tests/unit/cli/configurations/manifests.test.ts` `a manifest cannot ignore a path outside .gspot: $path`. Table of the test above; its rows come from tests/config/configurations.ts.
- a manifest can ignore its installation folder inside .gspot (test (test), 215-219): **delete**. Weak: only checks that nothing is thrown; the shipped prose manifest, which every test loads, ignores folders inside .gspot.
- native prefix collision facts validate once and have no policy allowance or disable field (test (test), 221-234): **delete**. TPP-016: restates the prefix_collisions schema.

## `tests/cli/parsers/eslint-schema.test.ts`

- (the file) (file): **delete**. PAR-031 moves captureEslintPreset out of the CLI into a scripts/ module, and the owner deletes the tests of scripts/.
- preset capture retains ordered options, file intersections, ignores, and the exact public export (test (test), 4-35): **delete**. Tests scripts/ code once PAR-031 moves it there; the owner deletes the tests of scripts/.
- preset capture refuses a missing public export and non-configuration blocks (test (test), 37-44): **delete**. Tests scripts/ code once PAR-031 moves it there; the owner deletes the tests of scripts/.

## `tests/cli/parsers/expo.test.ts`

- (the file) (file): **delete**. Duplicate: tests/cli/checks/framework/expo.test.ts runs the same REPORT and PASSING_REPORT through the Expo check and expects the same issues; PAR-011 moves parseExpoDoctor into that check.
- parseExpoDoctor (describe (describe), 6-13): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- parseExpoDoctor &gt; each failed check retains its complete issues without advice (test (test), 7-9): **delete**. Duplicate of the Expo check test row 'failed SDK checks' (same input, same expected issues).
- parseExpoDoctor &gt; a passing report yields nothing (test (test), 10-12): **delete**. Duplicate of the Expo check test row 'successful checks'.

## `tests/cli/parsers/generated-header.test.ts`

- (the file) (file): **move** to `tests/unit/cli/parsers/generated-header.test.ts`. Tests parsers/generated-header.ts (EXG-048); its data goes to tests/config/generated-files.ts.
- generated markers recognize comment formats, CRLF, opening lines, and the first JSON key (test (test), 5-8): **keep** to `tests/unit/cli/parsers/generated-header.test.ts` `the generated header is found in every comment form, after a shebang, with CRLF and as the first JSON key`. Real behavior (hasGeneratedHeader, PAR-064); its two lists come from tests/config/generated-files.ts.

## `tests/cli/parsers/git.test.ts`

- (the file) (file): **move** to `tests/unit/cli/parsers/git.test.ts`. Tests parsers/git.ts (PAR-007); its data goes to tests/config/git.ts.
- %s entries retain full identities, modes, and unquoted paths (test (test.each), 14-32): **keep** to `tests/unit/cli/parsers/git.test.ts` `tree entries keep full object IDs, modes and unquoted paths`. PAR-003: parseTreeEntries reads only committed trees; the index case goes.
- \['index', 'commit'\] as const (test (test.each), 14-14): **delete**. PAR-003: one case is left, so the test.each becomes a plain test.
- 'entry parsing rejects ${name}' (test (test), 35-41): **keep** to `tests/unit/cli/parsers/git.test.ts` `a Git entry listing is refused: ${name}`. Real behavior; PAR-003: rows run against parseTreeEntries and parseIndexEntries, the stage row against parseIndexRevision.
- batch parsing retains binary content and an empty blob in response order (test (test), 43-56): **keep** to `tests/unit/cli/parsers/git.test.ts` `a batch keeps binary content and an empty blob in response order`. Real behavior.
- 'batch parsing rejects ${name}' (test (test), 59-63): **keep** to `tests/unit/cli/parsers/git.test.ts` `a batch is refused: ${name}`. Real behavior.
- a nonempty response without requested objects is rejected (test (test), 65-70): **delete**. Duplicate of the 'trailing response data' row of INVALID_BLOBS: same end-of-stream check, same message.
- working index entries preserve stage %i and its full identity (test (test.each), 72-76): **keep** to `tests/unit/cli/parsers/git.test.ts` `index entries keep stage %i and the full object ID`. Real behavior.
- \[0, 1, 2, 3\] (test (test.each), 72-72): **keep** to `tests/unit/cli/parsers/git.test.ts` `index entries keep stage %i and the full object ID`. Table of the test above; stages 2 and 3 take the same path as stage 1, so the table is \[0, 1\].
- batch framing accepts every split between the header, binary body and delimiters (test (test), 78-93): **keep** to `tests/unit/cli/parsers/git.test.ts` `a batch parses the same for every split between header, body and delimiters`. Real behavior.

## `tests/cli/parsers/json.test.ts`

- (the file) (file): **move** to `tests/unit/cli/parsers/json.test.ts`. Tests parsers/json.ts (PAR-040). jsonc.test.ts joins it (TPP-019).
- strict JSON configuration parsing preserves field values and empty objects (test (test), 5-12): **delete**. TPP-013: tests JSON.parse; ROOT-004 deletes the \_\_proto\_\_ case.
- 'JSON configuration rejects a non-object root ${text}' (test (test), 15-17): **keep** to `tests/unit/cli/parsers/json.test.ts` `JSON must hold an object, not ${text}`. TPP-013 keeps the non-object refusal; 'true' and '"text"' reach the same branch as '42', so the list is \['null', '\[\]', '42'\] and stays in the test file as a short literal.
- 'strict JSON configuration rejects syntax errors ${text}' (test (test), 20-22): **delete**. TPP-013: tests Bun's own parse error text.

## `tests/cli/parsers/jsonc.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/parsers/json.test.ts`. TPP-019: one json.test.ts; parseJsonc lives in parsers/json.ts.
- 'JSONC rejects partial results and names the fault in ${entry.source}' (test (test), 7-9): **keep** to `tests/unit/cli/parsers/json.test.ts` `JSON with comments names the error offset`. TPP-013 keeps the error text test; the three rows only vary jsonc-parser's error kind, which gspot formats one way, so one row is left as a plain test.
- 'JSONC retains comments, trailing commas, and authored values in ${entry.source}' (test (test), 12-14): **delete**. TPP-013: tests jsonc-parser; its title is wrong (TPP-033).
- 'Wrangler returns the syntax diagnostic without partial fields in ${entry.source}' (test (test), 17-22): **delete**. TPP-019: re-runs the JSONC inputs through parseWrangler.
- 'Wrangler accepts only an object from ${entry.source}' (test (test), 25-31): **delete**. Weak: re-runs the JSON-with-comments inputs and misses the TOML branch (TPP-019).

## `tests/cli/parsers/lockfiles.test.ts`

- (the file) (file): **move** to `tests/unit/cli/tools/npm/lockfiles.test.ts`. Tests rootLockfileDependencies (PAR-085), which goes to tools/npm/lockfiles.ts, so its test follows; drop the header comment (TPP-045).
- %s reads only its root development requirements (test (test.each), 6-8): **keep** to `tests/unit/cli/tools/npm/lockfiles.test.ts` `%s lockfile: only the root dev dependencies`. Real behavior; follows rootLockfileDependencies to tools/npm/lockfiles.ts; add the pnpm row with no dev dependencies (PAR-044).
- ROOT_DEPENDENCIES (test (test.each), 6-6): **keep** to `tests/unit/cli/tools/npm/lockfiles.test.ts` `%s lockfile: only the root dev dependencies`. Table of the test above; its rows come from tests/config/npm.ts.

## `tests/cli/parsers/naming.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/general/naming/sql.test.ts`. PAR-013 moves sqlIdentifiers into the naming check, flat in checks/general/naming/ (architecture Proposed layout); TCG-025 and TPP-042 make it the home of the SQL name tests.
- sqlIdentifiers (describe (describe), 5-23): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- sqlIdentifiers &gt; every declared name arrives with its category and its line (test (test), 6-22): **keep** to `tests/unit/cli/checks/general/naming/sql.test.ts` `every SQL name comes with its category and line`. Real behavior; the kind field is label (PAR-080).
- psql declaration variables are excluded while authored names retain their locations (test (test), 25-32): **keep** to `tests/unit/cli/checks/general/naming/sql.test.ts` `psql variables are not names, and quoted names keep their positions`. Real behavior; plain title.

## `tests/cli/parsers/nextjs.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/framework/nextjs.test.ts`. PAR-011 moves nextSettingsFindings into checks/framework/nextjs.ts, so its test joins that check's test; its data goes to tests/config/nextjs.ts.
- Next configuration parsing preserves $name (test (test.each), 5-7): **keep** to `tests/unit/cli/checks/framework/nextjs.test.ts` `next.config secrets and turned-off checks: $name`. Real behavior.
- \[...NEXT_CONFIG_CASES\] (test (test.each), 5-5): **keep** to `tests/unit/cli/checks/framework/nextjs.test.ts` `next.config secrets and turned-off checks: $name`. Table of the test above; its rows come from tests/config/nextjs.ts.

## `tests/cli/parsers/nginx.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/infrastructure/nginx.test.ts`. PAR-011 and PAR-083 move the nginx tokenizer into the nginx check; CKO-005 with NMU-009 makes checks/tool/ checks/infrastructure/.
- nginx directive parsing preserves argument boundaries in $source (test (test.each), 5-31): **keep** to `tests/unit/cli/checks/infrastructure/nginx.test.ts` `nginx directives keep argument boundaries: $source`. Real behavior; drop satisfies DirectiveCase.
- \[ { source: 'location / { proxy_pass "<https://api:3000>"; add_header X-Value "two spaces # text"; }', (test (test.each), 5-26): **keep** to `tests/unit/cli/checks/infrastructure/nginx.test.ts` `nginx directives keep argument boundaries: $source`. Table of the test above; same decision. Values to config: NGINX_DIRECTIVE_CASES = the three { source, expected } rows -&gt; tests/config/nginx.ts

## `tests/cli/parsers/output/contract.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/parsers/output/formats.test.ts`. Tests parseOutput for every format, which lives in parsers/output/formats.ts (PAR-014); drop the header comment (TPP-045).
- the $format format has one outcome for $input output (test (test.each), 17-44): **keep** to `tests/unit/cli/parsers/output/formats.test.ts` `the $format format gives one result for $input output`. Real behavior; replace the try/catch with expect(...).toThrow(GspotError).
- OUTPUTS.flatMap((output) =&gt; \['empty', 'foreign'\].map((input) =&gt; ({ format: output.format, output, input }))) (test (test.each), 17-17): **keep** to `tests/unit/cli/parsers/output/formats.test.ts` `the $format format gives one result for $input output`. Table of the test above; its rows come from tests/config/output.ts.

## `tests/cli/parsers/output/declared-checks.test.ts`

- (the file) (file): **split** to `tests/unit/cli/execution/command/check.test.ts; tests/unit/cli/execution/command/output.test.ts`. TPP-020: they test running command checks, not parsers. The runner of a command check is execution/command/check.ts; checkedFindings goes to execution/command/output.ts (architecture and EXG layout).
- a declared regex check verifies reported files only when it has a configuration manifest (test (test), 27-57): **keep** to `tests/unit/cli/execution/command/output.test.ts` `reported files are checked to exist only for a check with a configuration manifest`. Real behavior of checkedFindings; the check is written as a \[\[command_check\]\] record with name, its output an inline table.
- a named check entry (describe (describe), 59-73): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- a named check entry &gt; runs the command of the repository and reports file and line through its output format (test (test), 60-72): **keep** to `tests/unit/cli/execution/command/check.test.ts` `a command check runs its command and reports file and line through its output format`. Real behavior (TPP-020); glossary: command check.
- malformed custom JSON output produces inability instead of a discarded finding (test (test), 75-88): **keep** to `tests/unit/cli/execution/command/check.test.ts` `a command check with malformed JSON output ends with status error`. Real behavior; plain title; the check is written as a \[\[command_check\]\] record with name.
- a successful SARIF command retains a %s finding without invented coordinates (test (test.each), 90-132): **keep** to `tests/unit/cli/execution/command/check.test.ts` `a SARIF command check keeps a %s finding without made-up line and column`. Real behavior; the check is written as a \[\[command_check\]\] record with name.
- \[ \['repository', undefined\], \['file', { artifactLocation: { uri: 'source.txt' }, region: { charOffset: 100 } }\], (test (test.each), 90-93): **keep** to `tests/unit/cli/execution/command/check.test.ts` `a SARIF command check keeps a %s finding without made-up line and column`. Table of the test above; same decision. Values to config: SARIF_LOCATION_CASES = the repository and file location rows -&gt; tests/config/output.ts
- ENTRY (const, 13-25): **inline** to `tests/unit/cli/execution/command/check.test.ts` `a command check runs its command and reports file and line through its output format`. Used by one test and built at load time from process.execPath and PENDING_NOTES_SCRIPT, so it stays in the test; it is a \[\[command_check\]\] record with name and an inline output table, without finding_count_pattern (TML-004: the PENDING script already exits 1 when it finds a line).

## `tests/cli/parsers/output/formats.test.ts`

- (the file) (file): **split** to `tests/unit/cli/parsers/output/formats.test.ts; tests/unit/cli/parsers/output/markdownlint.test.ts; tests/unit/cli/parsers/output/typos.test.ts`. Tests parseOutput (output/formats.ts); the markdownlint and typos tests go to the files of their readers (PAR-014), and contract.test.ts joins formats.test.ts.
- valid Markdown records parse (test (test), 19-27): **move** to `tests/unit/cli/parsers/output/markdownlint.test.ts` `a markdownlint record becomes a finding`. PAR-014: one file per output format.
- a valid spelling record parses (test (test), 29-37): **move** to `tests/unit/cli/parsers/output/typos.test.ts` `a typos record becomes a finding`. PAR-014: one file per output format.
- ShellCheck retains its path, position, and rule with %s (test (test.each), 39-59): **keep** to `tests/unit/cli/parsers/output/formats.test.ts` `ShellCheck output keeps path, position and rule with %s line endings`. Real behavior; TPP-037 keeps the checkedFindings assertion here only.
- \[ \['LF', '\\n'\], \['CRLF', '\\r\\n'\], \] (test (test.each), 39-42): **keep** to `tests/unit/cli/parsers/output/formats.test.ts` `ShellCheck output keeps path, position and rule with %s line endings`. Table of the test above; same decision.
- XML diagnostics with carriage returns remain findings on real files (test (test), 61-78): **delete**. Duplicate: xmllint and ShellCheck both use the regex output format, and the CRLF row of 'ShellCheck output keeps path, position and rule with %s line endings' checks the same CRLF line handling.
- Taplo reports one finding from %s (test (test.each), 80-99): **keep** to `tests/unit/cli/parsers/output/formats.test.ts` `Taplo reports one finding from %s`. Real behavior; drop the checkedFindings copy (TPP-037).
- \['diff', 'log', 'both'\] (test (test.each), 80-80): **keep** to `tests/unit/cli/parsers/output/formats.test.ts` `Taplo reports one finding from %s`. Table of the test above; same decision.
- a Taplo syntax error names its file by a Windows path with a drive letter (test (test), 101-107): **keep** to `tests/unit/cli/parsers/output/formats.test.ts` `a Taplo syntax error names its file by a Windows path with a drive letter`. Real behavior.
- grouped output strips line endings and relativizes native absolute paths (test (test), 109-118): **keep** to `tests/unit/cli/parsers/output/formats.test.ts` `grouped output drops line endings and makes absolute paths relative`. Real behavior; no "native" (TTC-032).
- EditorConfig retains file-level and line findings with %s (test (test.each), 120-141): **keep** to `tests/unit/cli/parsers/output/formats.test.ts` `EditorConfig output keeps file and line findings`. Real behavior; drop the checkedFindings copy (TPP-037); its CRLF row repeats the grouped-format CRLF test, so it runs once, with LF.
- \[ \['LF', '\\n'\], \['CRLF', '\\r\\n'\], \] (test (test.each), 120-123): **delete**. Padding: the CRLF row repeats the grouped-format CRLF test, and one row is left, so the table goes.
- an absolute path that names the root in another case is still relative to it (test (test.skipIf), 144-156): **keep** to `tests/unit/cli/parsers/output/formats.test.ts` `an absolute path that names the root in another case is still relative to it`. TPP-035: the skip is needed; rewrite its comment (IGN-002).
- process.platform === 'linux' (test (test.skipIf), 144-144): **keep** to `tests/unit/cli/parsers/output/formats.test.ts` `an absolute path that names the root in another case is still relative to it`. Skip condition of the test above (TPP-035 keeps it).
- a syntax diagnostic cannot promise an automatic fix when its check has no fixer (test (test), 158-164): **keep** to `tests/unit/cli/parsers/output/formats.test.ts` `a syntax finding is not fixable when its check has no fix command`. Real behavior; glossary: fix.
- malformed ESLint output fails for %s (test (test.each), 166-176): **delete**. Duplicate: the JSON report validation tests in output/json.test.ts and the empty-output rows of the format test run the same parseJson paths.
- \[ \['empty report', ''\], \['non-JSON text', 'not JSON'\], \['unfinished array', '\['\], \['non-array report', ' (test (test.each), 166-173): **delete**. Table of the test above; same decision.
- an empty ESLint report has no findings (test (test), 178-181): **delete**. Duplicate of the valid empty report test in output/json.test.ts ('\[\]' gives no findings).
- ESLint locations respect the root boundary %s for %s (test (test.each), 183-196): **keep** to `tests/unit/cli/parsers/output/formats.test.ts` `ESLint paths are relative to the root only inside it: %s, %s`. Real behavior of path handling in parseOutput.
- \[ \['/repo', '/repo/a.js', 'a.js'\], \['/repo', '/repository/a.js', '/repository/a.js'\], // Bun escapes a non-A (test (test.each), 183-188): **keep** to `tests/unit/cli/parsers/output/formats.test.ts` `ESLint paths are relative to the root only inside it: %s, %s`. Table of the test above; the rows call win32.normalize at load time, so they stay in the test file.
- $configuration rejects $name: $message (test (test.each), 198-210): **split** to `tests/unit/cli/parsers/output/markdownlint.test.ts; tests/unit/cli/parsers/output/typos.test.ts` `markdownlint refuses $name: $message; typos refuses $name: $message`. Each half of REPORT_ERRORS joins its reader's test file (PAR-014), with rows from tests/config/markdown.ts and tests/config/spelling.ts; PAR-017 deletes the markdown rows about positions outside the source and the missing source file.
- \[...REPORT_ERRORS\] (test (test.each), 198-198): **split** to `tests/unit/cli/parsers/output/markdownlint.test.ts; tests/unit/cli/parsers/output/typos.test.ts` `markdownlint refuses $name: $message; typos refuses $name: $message`. Table of the test above; rows come from tests/config/markdown.ts (MARKDOWNLINT_REPORT_ERRORS) and tests/config/spelling.ts (TYPOS_REPORT_ERRORS).
- configurationCheck (function, 212-216): **delete**. TPP-036: use allChecks(configurationManifests().values()).get(id)!.check.

## `tests/cli/parsers/output/json.test.ts`

- (the file) (file): **move** to `tests/unit/cli/parsers/output/json.test.ts`. Tests parsers/output/json.ts (PAR-014). The Vale tests leave for the prose check (PAR-015).
- JSON finding fields (describe (describe), 7-40): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- JSON finding fields &gt; a flat list maps its fields to a finding (test (test), 8-25): **keep** to `tests/unit/cli/parsers/output/json.test.ts` `a flat JSON list maps its fields to a finding`. Real behavior.
- JSON finding fields &gt; a nested list reads the file from the item and the rest from the child (test (test), 27-39): **keep** to `tests/unit/cli/parsers/output/json.test.ts` `a nested list reads the file from the item and the rest from the child`. Real behavior.
- generic JSON %s fix fields preserve native fix availability (test (test.each), 42-60): **keep** to `tests/unit/cli/parsers/output/json.test.ts` `a JSON finding is fixable only when the check has a fix command: %s fix field`. Real behavior; no "native" (TTC-032).
- \[ \['absent', {}, false\], \['object', { fix: { range: \[0, 1\], text: '' } }, true\], \['null', { fix: null }, tru (test (test.each), 42-47): **keep** to `tests/unit/cli/parsers/output/json.test.ts` `a JSON finding is fixable only when the check has a fix command: %s fix field`. Table of the test above; 'object', 'null' and 'false' take the same 'field present' branch, so only 'absent' and 'false' stay, as two short rows in the test file.
- JSON positions and nested records (describe (describe), 62-101): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- JSON positions and nested records &gt; a tool that counts lines from zero names its base (test (test), 63-72): **keep** to `tests/unit/cli/parsers/output/json.test.ts` `a tool that counts lines from zero names its line base`. Real behavior.
- JSON positions and nested records &gt; lists nested two levels down read the file from the top and join several message paths (test (test), 74-100): **keep** to `tests/unit/cli/parsers/output/json.test.ts` `lists nested two levels down read the file from the top and join several message paths`. Real behavior.
- JSON report validation (describe (describe), 103-124): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- JSON report validation &gt; invalid report %s is rejected (test (test.each), 104-112): **keep** to `tests/unit/cli/parsers/output/json.test.ts` `an invalid JSON report is refused: %s`. Real behavior.
- JSON report validation &gt; \[ \['', 'no JSON report'\], \['fatal error', 'no JSON report'\], \['{ broken', 'JSON Parse error'\], (test (test.each), 104-110): **keep** to `tests/unit/cli/parsers/output/json.test.ts` `an invalid JSON report is refused: %s`. Table of the test above; 'fatal error' repeats the no-JSON branch of '' and '{}' repeats the not-an-array branch of '{"items":null}', so '', '{ broken' and '{"items":null}' stay as short rows in the test file.
- JSON report validation &gt; valid empty reports remain clean and missing nested lists are rejected (test (test), 114-123): **keep** to `tests/unit/cli/parsers/output/json.test.ts` `an empty report has no findings, and missing nested lists are refused`. Real behavior.
- vale output (describe (describe), 126-175): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- vale output &gt; JSON output parses native source and stdin locations into alerts (test (test), 127-148): **move** to `tests/unit/cli/checks/general/prose.test.ts` `Vale JSON output becomes alerts for files and stdin`. PAR-015: parseAlerts (valeAlerts) moves into the Vale check, checks/general/prose.ts (CKG layout).
- vale output &gt; native paths and filenames with control characters retain their complete locations (test (test), 150-167): **move** to `tests/unit/cli/checks/general/prose.test.ts` `Vale paths with control characters keep their full location`. PAR-015; no "native" (TTC-032).
- vale output &gt; malformed output %s cannot become a clean result (test (test.each), 169-171): **move** to `tests/unit/cli/checks/general/prose.test.ts` `malformed Vale output %s is refused`. PAR-015.
- vale output &gt; \['diagnostic text', '{"file.md":\[{}\]}'\] (test (test.each), 169-169): **move** to `tests/unit/cli/checks/general/prose.test.ts` `malformed Vale output %s is refused`. Table of the test above; same decision.
- vale output &gt; an empty native report has no alerts (test (test), 172-174): **move** to `tests/unit/cli/checks/general/prose.test.ts` `an empty Vale report has no alerts`. PAR-015.

## `tests/cli/parsers/output/knip.test.ts`

- (the file) (file): **move** to `tests/unit/cli/parsers/output/knip.test.ts`. Tests parsers/output/knip.ts (PAR-014); its data goes to tests/config/knip.ts.
- the declared Knip check retains every native category, grouped symbol and position (test (test), 12-25): **delete**. Weak: the expected findings copy the source message table.
- the declared Knip check rejects invalid structured output %s (test (test.each), 27-30): **keep** to `tests/unit/cli/parsers/output/knip.test.ts` `an invalid Knip report is refused: %s`. Real behavior.
- INVALID_KNIP_REPORTS (test (test.each), 27-27): **keep** to `tests/unit/cli/parsers/output/knip.test.ts` `an invalid Knip report is refused: %s`. Table of the test above; rows come from tests/config/knip.ts, without 'not JSON' (the format contract test already refuses other-tool output for knip).
- check (const, 8-10): **move** to `tests/unit/cli/parsers/output/knip.test.ts` `check`. Shared by both tests in the file; built at load time with allChecks(...).get('javascript/knip')!.check (TPP-036), so it stays in the test file.

## `tests/cli/parsers/output/semgrep.test.ts`

- (the file) (file): **move** to `tests/unit/cli/parsers/output/semgrep.test.ts`. Tests parsers/output/semgrep.ts (PAR-014); its data goes to tests/config/semgrep.ts.
- Semgrep retains both rule and source parse diagnostics with positions and Unicode paths (test (test), 9-42): **keep** to `tests/unit/cli/parsers/output/semgrep.test.ts` `Semgrep rule findings and source parse errors keep positions and Unicode paths`. Real behavior; find the check with allChecks (TPP-036).
- Semgrep scanner, rule, unpositioned, and malformed reports remain execution errors (test (test), 44-72): **keep** to `tests/unit/cli/parsers/output/semgrep.test.ts` `Semgrep scanner, rule, unpositioned and malformed reports are errors`. Real behavior; find the check with allChecks (TPP-036); its list leaves out '' and 'not JSON', which the format contract test covers for semgrep.

## `tests/cli/parsers/setting-values.test.ts`

- (the file) (file): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001, TPP-011, TPP-040).
- a path declaration permits an empty disabling value only when its native default declares it (test (test), 12-26): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001).
- compiled keys retain their item type at the actual runtime boundary (test (test), 28-37): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001, TPP-040).
- compiled namespace records use native rule schemas and typed declaration fields (test (test), 39-56): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001, TPP-005).
- the compiler-owned schema equals a fresh declaration compilation (test (test), 58-68): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001); it also repeats the build check (TPP-011).
- effective namespaces require only defaults guaranteed by their real provider closures (test (test), 70-102): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001); it also pins generated field lists (TPP-040).
- declared string path validation compiles the shared runtime and JSON schema constraint (test (test), 104-124): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001, TPP-008).

## `tests/cli/parsers/settings.test.ts`

- (the file) (file): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001); every test here tests compileSettingValue, settingSchemaSources or the manifest type/items language.
- typed record items validate fields, nested paths and bounds without reader casts (test (test), 15-48): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001).
- scalar constraints share the compiler used for typed fields (test (test), 50-56): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001).
- declared choices retain their primitive type and numeric bounds (test (test), 58-66): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001).
- item metadata refuses an undeclared field type and unknown field options (test (test), 68-75): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001).
- list declarations without a native item owner refuse compilation (test (test), 77-83): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001); bare toThrow (TPP-018).
- declarations validate both levels of defaults with their item schema (test (test), 85-115): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001).
- scalar declarations refuse list metadata and invalid numeric defaults (test (test), 117-130): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001).
- default validation uses the composed role schema including declared configuration roles (test (test), 132-157): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001).
- $name retains its native item validation at both levels (test (test.each), 159-179): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001).
- NATIVE_ITEM_DECLARATIONS (test (test.each), 159-159): **delete**. Table of the test above; same decision.
- %s refuses a native item reference without an owned array (test (test.each), 181-188): **delete**. The setting-schema compiler and the generated schemas are deleted (POL-001).
- INVALID_NATIVE_ITEM_OWNERS (test (test.each), 181-181): **delete**. Table of the test above; same decision.

## `tests/cli/parsers/sql/pg.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/parsers/sql/postgres.test.ts`. TPP-013: its library tests go; its one gspot test (empty SQL) joins sql/postgres.test.ts.
- concurrent SQL parsing returns independent results in a fresh process (test (test), 8-17): **delete**. TPP-013: tests libpg-query in a fresh process.
- empty SQL has no statements (test (test), 19-23): **move** to `tests/unit/cli/parsers/sql/postgres.test.ts` `empty SQL has no statements`. TPP-013 keeps it; parse lives in parsers/sql/postgres.ts (PAR-007).
- SQL declarations parse without errors and retain their statement (test (test), 25-29): **delete**. TPP-013: tests libpg-query.

## `tests/cli/parsers/sql/statements.test.ts`

- (the file) (file): **move** to `tests/unit/cli/parsers/sql/postgres.test.ts`. Tests parseSqlFile and positionAt in parsers/sql/postgres.ts (PAR-007).
- SQL analyses share concurrent parses and refresh after source corrections (test (test), 8-34): **keep** to `tests/unit/cli/parsers/sql/postgres.test.ts` `SQL parses are shared, cached and refreshed after a correction`. TPP-042: its identifier assertions move to checks/general/naming/sql.test.ts; the cache, error and correction part stays.
- SQL statement positions skip nested comments and count Unicode prefixes correctly (test (test), 36-54): **keep** to `tests/unit/cli/parsers/sql/postgres.test.ts` `SQL statement positions skip nested comments and count Unicode correctly`. Real behavior.
- psql commands and variables preserve diagnostic positions and PostgreSQL casts (test (test), 56-72): **keep** to `tests/unit/cli/parsers/sql/postgres.test.ts` `psql commands and variables keep error positions and PostgreSQL casts`. Real behavior.
- psql tokens inside quoted SQL and nested comments retain their literal contents (test (test), 74-87): **keep** to `tests/unit/cli/parsers/sql/postgres.test.ts` `psql tokens inside quoted SQL and nested comments stay literal`. Real behavior.
- SQL errors after Unicode point at the original token (test (test), 89-99): **keep** to `tests/unit/cli/parsers/sql/postgres.test.ts` `an SQL error after Unicode points at the right token`. Real behavior.
- an unterminated SQL %s value preserves client-shaped text for the native error (test (test.each), 101-112): **keep** to `tests/unit/cli/parsers/sql/postgres.test.ts` `an unterminated SQL %s value gives the parser error at its start`. Real behavior; no "native".
- \["'", "E'", '"'\] (test (test.each), 101-101): **keep** to `tests/unit/cli/parsers/sql/postgres.test.ts` `an unterminated SQL %s value gives the parser error at its start`. Table of the test above; same decision.

## `tests/cli/parsers/statements.test.ts`

- (the file) (file): **move** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts`. Tests isTrivialFile and executableStatements, which move into the trivial-functions check (S08-002), so the test follows its source; its data goes to tests/config/structure.ts.
- %s counts two executable statements past comments and documentation (test (test.each), 6-21): **keep** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts` `%s counts two statements past comments and docstrings`. Real behavior; follows its source into the trivial-functions check (S08-002).
- \[ \['python', 'def example():\\n """Contract."""\\n work()\\n work()\\n'\], \['swift', 'func example() { /\* co (test (test.each), 6-10): **keep** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts` `%s counts two statements past comments and docstrings`. Table of the test above; same decision. Values to config: STATEMENT_COUNT_CASES = the python, swift and bash rows -&gt; tests/config/structure.ts
- Python package documentation does not hide structural code: %s (test (test.each), 23-33): **keep** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts` `a Python package docstring does not hide code: %s`. Real behavior; follows its source into the trivial-functions check (S08-002).
- \[ \['', false\], \['# Package marker\\n', false\], \['# Package marker\\n"""Package documentation."""\\n', false\], (test (test.each), 23-29): **keep** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts` `a Python package docstring does not hide code: %s`. Table of the test above; same decision. Values to config: PACKAGE_DOCSTRING_CASES = the five \[source, expected\] rows -&gt; tests/config/structure.ts
- $name has trivial-file outcome $expected (test (test.each), 35-38): **keep** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts` `$name is trivial: $expected`. Real behavior; follows its source into the trivial-functions check (S08-002).
- \[...TRIVIAL_FILES\] (test (test.each), 35-35): **keep** to `tests/unit/cli/checks/general/structure/trivial-functions.test.ts` `$name is trivial: $expected`. Table of the test above; its rows come from tests/config/structure.ts.

## `tests/cli/parsers/swift/coverage.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/checks/testing/swift-tests.test.ts`. PAR-016 merges the Swift coverage reader (parseSwiftCoverage, coverageShortfalls) into checks/testing/swift-tests.ts (CKO-005, NMU-009), so its test joins the one swift-tests test file.
- Swift package coverage measures actual custom target paths and applies every target floor (test (test), 8-37): **keep** to `tests/unit/cli/checks/testing/swift-tests.test.ts` `Swift package coverage measures each target's own paths and applies its line floor`. Real behavior; coverage.overrides becomes \[\[coverage.target\]\] records with name, lines and reason (TMF-004), so the test passes { name, lines } targets; its data comes from tests/config/swift.ts.

## `tests/cli/parsers/swift/source.test.ts`

- (the file) (file): **delete**. PAR-001: the Swift function reader is dead; only this test keeps it.
- Swift reports constructors, accessors, decorated methods, nested functions, and leaves closures in place (test (test), 6-20): **delete**. PAR-001: tests deleted code.

## `tests/cli/parsers/toml.test.ts`

- (the file) (file): **move** to `tests/unit/cli/parsers/toml/document.test.ts`. Tests openTomlFile in parsers/toml/document.ts (PAR-007, PAR-065).
- adding a root key retains leading comments on their authored tool table (test (test), 5-14): **keep** to `tests/unit/cli/parsers/toml/document.test.ts` `adding a root key keeps the leading comments on their table`. Real behavior; no "authored".
- deleting a root key retains separate prose and the next table comments (test (test), 16-25): **keep** to `tests/unit/cli/parsers/toml/document.test.ts` `deleting a root key keeps separate comments and the next table's comments`. Real behavior.
- TOML field reads preserve nested tables, arrays, scalars, and missing keys (test (test), 27-37): **keep** to `tests/unit/cli/parsers/toml/document.test.ts` `reading TOML values: nested tables, arrays, scalars and missing keys`. Real behavior.
- TOML syntax errors name the file and retain the parser cause (test (test), 39-47): **keep** to `tests/unit/cli/parsers/toml/document.test.ts` `a TOML syntax error names the file and keeps the parser error as its cause`. Real behavior; delete the weaker first assertion (TPP-018).
- TOML edits name the file when an authored scalar blocks a required table (test (test), 49-58): **keep** to `tests/unit/cli/parsers/toml/document.test.ts` `a TOML edit names the file when a scalar is in the way of a table`. Real behavior.
- TOML table edits preserve authored dates, array order, and prototype-named fields (test (test), 60-76): **keep** to `tests/unit/cli/parsers/toml/document.test.ts` `TOML edits keep dates, array order and keys named like object properties`. Real behavior; ROOT-004 deletes the \_\_proto\_\_ entry.

## `tests/cli/parsers/tool/tool-file.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/repository/tooling/files.test.ts`. hasIniSection, which replaces getIniSection (PAR-018), lives in repository/tooling.ts, so its test joins that file's tests.
- INI selection retains exact section text and treats malformed headings as content (test (test), 4-10): **keep** to `tests/unit/cli/repository/tooling/files.test.ts` `an INI file has a section, or a subsection of it, only under an exact heading`. Real behavior; hasIniSection lives in repository/tooling.ts; assert its boolean (PAR-018).
- INI selection rejects duplicate selected headings and accepts repeated unrelated sections (test (test), 12-17): **delete**. PAR-018 drops the duplicate-section error; the repeated-section case is a plain true answer the test above covers.

## `tests/cli/parsers/tool/version.test.ts`

- (the file) (file): **move** to `tests/unit/cli/tools/versions.test.ts`. PAR-011 moves parseVersionOutput to tools/versions.ts; its data goes to tests/config/tools.ts.
- native wrappers report their executable version when the package has a different version (test (test), 6-16): **keep** to `tests/unit/cli/tools/versions.test.ts` `when the npm package version differs from the pin, the version comes from the command output`. Real behavior; title from TTC-032.
- color escapes and explicit version patterns are interpreted before version validation (test (test), 18-23): **keep** to `tests/unit/cli/tools/versions.test.ts` `color codes and a version pattern are applied before the version is checked`. Real behavior.
- a mise shim without a selected version reports one actionable line (test (test), 25-34): **keep** to `tests/unit/cli/tools/versions.test.ts` `a mise shim with no version set reports not installed`. Real behavior; its data comes from tests/config/tools.ts.

## `tests/cli/parsers/tree-sitter.test.ts`

- (the file) (file): **move** to `tests/unit/cli/parsers/tree-sitter.test.ts`. Tests parseSource and visitParsed in parsers/tree-sitter.ts (PAR-007); TPP-041 cuts it to one test per behavior, Python only (PAR-001).
- run-owned parses separate grammars and copied trees survive cache cleanup (test (test), 14-40): **keep** to `tests/unit/cli/parsers/tree-sitter.test.ts` `parses are cached per run and copied trees outlive the cache`. Real behavior of the parse cache.
- a native parser that returns no tree is refused before a reader receives it (test (test), 42-45): **delete**. TPP-017: forces a null tree through a mock, a state gspot cannot reach.
- a rejected observation read is evicted and partial trees are released before a retry (test (test), 47-74): **delete**. Weak: asserts unexplained call counts 1, 2 and 5 of internal spies (TPP-017, TPP-041).
- observation caches separate readers and retain selected path order (test (test), 76-102): **keep** to `tests/unit/cli/parsers/tree-sitter.test.ts` `a second visit with the same files returns the same value, in the same path order`. TPP-041 behavior 1; PAR-001 drops the Swift reader line.
- $language observations reuse selected paths while isolating scopes and resource owners (test (test.each), 115-150): **delete**. TPP-041: the same flow again, for two languages; PAR-001 deletes the Swift reader.
- observations (test (test.each), 115-115): **delete**. Table of the test above; same decision.
- standalone $language readers dispose selected trees after both success and failure (test (test.each), 151-183): **delete**. TPP-041; PAR-081 gives visitParsed one path (callers pass a DisposableStack), so the standalone mode goes.
- observations (test (test.each), 151-151): **delete**. Table of the test above; same decision.
- disposeObservations (function, 105-108): **delete**. Exists only for the two-language tests, which go (PAR-001).
- observations (const, 110-113): **delete**. Exists only for the two-language tests, which go (PAR-001).

## `tests/cli/parsers/xcode.test.ts`

- (the file) (file): **move** to `tests/unit/cli/parsers/xcode.test.ts`. Tests parsePbxproj in parsers/xcode.ts (PAR-011, PAR-059).
- project directory offsets and source roots resolve separately (test (test), 5-12): **keep** to `tests/unit/cli/parsers/xcode.test.ts` `the project folder offset and source roots apply separately`. Real behavior.
- quoted project strings preserve escapes and ignore comment-like text (test (test), 14-28): **keep** to `tests/unit/cli/parsers/xcode.test.ts` `quoted project strings keep escapes and ignore comment-like text`. Real behavior.
- the parser refuses a project with $name (test (test.each), 29-55): **keep** to `tests/unit/cli/parsers/xcode.test.ts` `a project with $name is refused`. Real behavior.
- \[ { name: 'missing value', source: PBXPROJ_PROJECT.slice(0, -3), message: 'Unexpected end of (test (test.each), 29-53): **keep** to `tests/unit/cli/parsers/xcode.test.ts` `a project with $name is refused`. Table of the test above; same decision; a constant derived only from config values goes to config. Values to config: XCODE_PROJECT_REFUSALS = the four { name, source, message } rows, derived only from GROUPED_PBXPROJ -&gt; tests/config/xcode.ts

## `tests/cli/policy/edit.test.ts`

- (the file) (file): **move** to `tests/unit/cli/settings/edit.test.ts`. Tests editPolicy, setKey and addToList in settings/edit.ts (POL-044).
- policy edits keep a trailing array comma and write inline tables without one (test (test), 11-29): **keep** to `tests/unit/cli/settings/edit.test.ts` `an edit keeps a trailing array comma and writes inline tables without one`. Real behavior.
- preparePolicy rejects an external symlink before evaluating its mutation (test (test), 31-45): **merge** to `tests/unit/cli/settings/file.test.ts` `an edit of a gspot.toml that is a link is refused and the link target is unchanged: $kind`. TPP-043: one test.each over the three link kinds; POL-043 makes one reader in settings/file.ts.
- editPolicy (describe (describe), 76-80): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- editPolicy &gt; sets a nested key, then deletes it and the empty table (test (test), 77-77): **keep** to `tests/unit/cli/settings/edit.test.ts` `setting a nested key, then deleting it, removes the empty table`. Real behavior; its body goes back inside the test (TPP-028).
- editPolicy &gt; deduplicates scalar list values and record entries with reordered keys (test (test), 79-79): **keep** to `tests/unit/cli/settings/edit.test.ts` `adding to a list skips values and records that are already there`. Real behavior; its body goes back inside the test (TPP-028).
- changesKey (function, 47-57): **inline** to `tests/unit/cli/settings/edit.test.ts` `setting a nested key, then deleting it, removes the empty table`. TPP-028: a one-use body hoisted to dodge max-nested-callbacks.
- deduplicatesEntries (function, 59-74): **inline** to `tests/unit/cli/settings/edit.test.ts` `adding to a list skips values and records that are already there`. TPP-028: a one-use body hoisted to dodge max-nested-callbacks; its settings use naming.banned_words and \[\[format.override\]\].

## `tests/cli/policy/expiry.test.ts`

- (the file) (file): **split** to `tests/unit/cli/settings/schema/parts.test.ts; tests/unit/cli/settings/layout.test.ts; tests/unit/cli/settings/file.test.ts`. The until date is checked by schema/parts.ts, the comment error comes from layout.ts, the TOML error location from file.ts. TPP-013 deletes the library tests.
- '${name} retains strict native expiry validation and source locations' (test (test), 11-27): **move** to `tests/unit/cli/settings/schema/parts.test.ts` `${name}: the until date of an ignore must be a TOML date`. Real behavior; title from TTC-032; TPP-013 keeps one valid date and the not-a-date rows except 'offset timezone', which repeats 'offset datetime'; rows come from tests/config/settings/schema.ts.
- the published expiry representation agrees with the documented native calendar values (test (test), 29-45): **delete**. TPP-013: tests Ajv's date format against zod.
- invalid CLI expiry arguments refuse calendar rollover and time components (test (test), 47-51): **delete**. Tests zod iso.date() (TPP-013); ignore --until itself stays.
- a surviving inline field comment refuses an unrepresentable write with its exact field path (test (test), 53-58): **move** to `tests/unit/cli/settings/layout.test.ts` `a comment on a field in an inline table inside a mixed array cannot be written`. Real behavior; the error is thrown by layout.ts; tools.&lt;tool&gt;.extra is written { value = {...}, reason = "..." } (CFR-002), so the message path reads tools.eslint.extra.value.mixed.0.enabled.
- native parser failures retain the supplied template location and Unicode column (test (test), 60-67): **move** to `tests/unit/cli/settings/file.test.ts` `a TOML syntax error names the file, line and column`. Real behavior of parseTomlText; title from TTC-032.

## `tests/cli/policy/file.test.ts`

- (the file) (file): **split** to `tests/unit/cli/settings/file.test.ts; tests/unit/cli/settings/layout.test.ts; tests/unit/cli/settings/comments.test.ts; tests/unit/cli/settings/drop-defaults.test.ts; tests/unit/cli/settings/edit.test.ts`. Split by the source file that does each job (TPP-029): file.ts writes the file, layout.ts lays out text, comments.ts keeps comments, drop-defaults.ts drops defaults, edit.ts edits.
- $name keeps canonical values and comments through repeated writes (test (test.each), 24-33): **split** to `tests/unit/cli/settings/layout.test.ts; tests/unit/cli/settings/comments.test.ts; tests/unit/cli/settings/drop-defaults.test.ts` `writing $name gives the same text twice in a row`. POLICY_FILE_CASES splits by behavior into DEFAULT_CASES, COMMENT_CASES and LAYOUT_CASES in tests/config/settings/file.ts; each test file gets this one-line test.each over its rows.
- POLICY_FILE_CASES (test (test.each), 24-24): **split** to `tests/unit/cli/settings/layout.test.ts; tests/unit/cli/settings/comments.test.ts; tests/unit/cli/settings/drop-defaults.test.ts` `writing $name gives the same text twice in a row`. Table of the test above; its rows come from tests/config/settings/file.ts.
- writePolicyFile (describe (describe), 91-125): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- writePolicyFile &gt; policy edits retain invalid UTF-8 bytes (test (test), 92-92): **keep** to `tests/unit/cli/settings/file.test.ts` `an edit of a file with invalid UTF-8 is refused and the file is unchanged`. Real behavior; title from TPP-033; body inline (TPP-028).
- writePolicyFile &gt; policy edits refuse a mode change after read (test (test), 93-93): **delete**. Duplicate: the same writer identity check refuses a mode change after the read in 'an edit planned from old bytes is refused, and a new plan is accepted', and the mode row of 'a stale read of ${name} refuses replacement and removal' covers the mode.
- writePolicyFile &gt; a scope setting written into %s loads with the ones already there (test (test.each), 95-124): **move** to `tests/unit/cli/settings/edit.test.ts` `a scope setting written into %s loads with the settings already there`. Tests setKey into a scope (edit.ts); a scope is a \[\[scope\]\] record with path, written with a dotted key (limits.file_lines = 100) and with an inline table (limits = { file_lines = 100 }), and its path is relative to the repository root (CFR-003, CFR-004).
- writePolicyFile &gt; \[ \['a sub-table', '\[scope."api"\]\\n\[scope."api".limits\]\\nfile_lines = 100\\n'\], \['an inline table', '\[scop (test (test.each), 95-98): **move** to `tests/unit/cli/settings/edit.test.ts` `a scope setting written into %s loads with the settings already there`. Table of the test above; the rows are \[\[scope\]\] records with path and dotted keys (CFR-003).
- a prepared policy edit refuses stale bytes and accepts a fresh plan (test (test), 127-161): **keep** to `tests/unit/cli/settings/file.test.ts` `an edit planned from old bytes is refused, and a new plan is written`. Real behavior.
- policy reads and edits reject a missing file without creating one (test (test), 163-168): **keep** to `tests/unit/cli/settings/file.test.ts` `reading or editing a missing gspot.toml is refused and creates nothing`. TPP-010 keeps this copy; POL-043 makes one reader.
- an unchanged policy does not publish or change its native identity (test (test), 170-190): **keep** to `tests/unit/cli/settings/file.test.ts` `writing an unchanged file does not touch it`. Real behavior; no "native" (TTC-032).
- policy inspection accepts linked authored text inside the root while edits preserve its target (test (test), 192-205): **keep** to `tests/unit/cli/settings/file.test.ts` `an edit of a gspot.toml that is a link is refused and the link target is unchanged: $kind`. TPP-043: one test.each over symlink inside, symlink outside and hardlink; its two hasPolicy lines go with hasPolicy (S09-003).
- policy inspection accepts hardlinked authored text while edits preserve both names (test (test), 207-230): **merge** to `tests/unit/cli/settings/file.test.ts` `an edit of a gspot.toml that is a link is refused and the link target is unchanged: $kind`. TPP-043: one row of the link test; its hasPolicy line goes with hasPolicy (S09-003).
- canonical writes retain an explicitly empty project path (test (test), 232-238): **delete**. An explicitly empty xcode.project goes: absent means the Swift package, and TML-010 names this test as the special case to delete.
- an in-place native expiry mutation changes the captured policy and retains its comment (test (test), 240-252): **move** to `tests/unit/cli/settings/edit.test.ts` `changing an until date in place rewrites it and keeps its comment`. Real behavior of editPolicy; title from TTC-032.
- reordering native table keys leaves the captured text unchanged (test (test), 254-264): **move** to `tests/unit/cli/settings/edit.test.ts` `reordering keys does not change the file`. Real behavior of editPolicy; title from TTC-032.
- proposeEdit (function, 36-44): **move** to `tests/unit/cli/settings/file.test.ts` `proposeEdit`. Helper of three tests in the file; rewrite its doc comment in plain words (TPP-045).
- refusesBytes (function, 46-64): **inline** to `tests/unit/cli/settings/file.test.ts` `an edit of a file with invalid UTF-8 is refused and the file is unchanged`. TPP-028: one-use body hoisted to dodge max-nested-callbacks.
- refusesMode (function, 66-89): **delete**. Its test is deleted as a duplicate of the stale-plan and stale-read tests.

## `tests/cli/policy/key-paths.test.ts`

- (the file) (file): **move** to `tests/unit/cli/settings/read.test.ts`. Tests the error locations that settings/read.ts builds (parseSettings).
- parseStrictPolicy (describe (describe), 38-93): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- parseStrictPolicy &gt; semantic errors name the key path of $name and pass after the fix (test (test.each), 39-42): **delete**. Duplicate: same input and message as 'turning off an ESLint rule in a scope points to gspot ignore at its key path' in the settings read test (TPP-010).
- parseStrictPolicy &gt; SEMANTIC_KEY_PATH_CASES (test (test.each), 39-39): **delete**. TPP-010: SEMANTIC_KEY_PATH_CASES goes.
- parseStrictPolicy &gt; schema errors name the key path of $name and pass after the fix (test (test.each), 44-85): **keep** to `tests/unit/cli/settings/read.test.ts` `an error names the key path of $name, and the fix clears it`. Real behavior; the TOML spelling of a key is gone after parsing, so KEY_PATH_CASES keeps one row (the multi-line array index), CFR-004 removes the nested-array-under-a-scope row, and the inline \[\[scope\]\] row tests the scope prefix (TPP-007); ESLint error paths read tools.eslint.override.0...
- parseStrictPolicy &gt; \[ ...SCHEMA_KEY_PATH_CASES, ...\[ { correction: \['paths = \[\]', 'paths = \["src (test (test.each), 44-77): **keep** to `tests/unit/cli/settings/read.test.ts` `an error names the key path of $name, and the fix clears it`. Table of the test above; KEY_PATH_CASES (one row) comes from tests/config/settings/errors.ts, and the inline rows use \[\[tools.eslint.override\]\].
- parseStrictPolicy &gt; syntax errors name their location without copying neighboring source with %j lines (test (test.each), 87-90): **keep** to `tests/unit/cli/settings/read.test.ts` `a TOML syntax error names its line and does not copy the source: %j line endings`. Real behavior; body inline (TPP-028). TPP-010 keeps this copy.
- parseStrictPolicy &gt; \['\\n', '\\r\\n'\] (test (test.each), 87-87): **keep** to `tests/unit/cli/settings/read.test.ts` `a TOML syntax error names its line and does not copy the source: %j line endings`. Table of the test above; same decision.
- parseStrictPolicy &gt; scope %s cannot follow an external directory symlink (test (test.each), 92-92): **keep** to `tests/unit/cli/settings/read.test.ts` `a scope path through a link to a folder outside the repository is refused`. Real behavior; body inline (TPP-028); the parent-link walk of 'linked/nested' belongs to the safe-folder tests, so one row is left and it is a plain test.
- parseStrictPolicy &gt; \['linked', 'linked/nested'\] (test (test.each), 92-92): **delete**. Padding: one row is left, so the table goes.
- override rule severities are refused without accepting sibling rule selections (scoped: %s) (test (test.each), 95-110): **delete**. TPP-005: ESLint severity refusal is tested once, in the rule table of schema/tools.test.ts; TPP-007 scope doubling; POL-065 deletes readPolicyTable.
- \[false, true\] (test (test.each), 95-95): **delete**. Table of the test above; same decision.
- semanticErrors (function, 10-16): **delete**. TPP-010: goes with SEMANTIC_KEY_PATH_CASES.
- syntaxErrors (function, 18-26): **inline** to `tests/unit/cli/settings/read.test.ts` `a TOML syntax error names its line and does not copy the source: %j line endings`. TPP-028: one-use body.
- externalScope (function, 28-36): **inline** to `tests/unit/cli/settings/read.test.ts` `a scope path through a link to a folder outside the repository is refused: %s`. TPP-028: one-use body; the scope is a \[\[scope\]\] record with path (CFR-003).

## `tests/cli/policy/public-shape.test.ts`

- (the file) (file): **split** to `tests/unit/cli/settings/normalize.test.ts; tests/unit/cli/settings/errors/reasons.test.ts; tests/unit/cli/settings/errors/keys.test.ts; tests/unit/cli/settings/schema/architecture.test.ts; tests/unit/cli/settings/drop-defaults.test.ts`. TPP-030: the name says nothing and the file mixes five subjects; each test goes to the source file that does its job, after the TPP-003 and POL-024 deletions and the deletion of the scope path, test role and reasons-table tests (CFR-002, CFR-003, TML-001).
- the authored policy refuses superseded $key input (test (test.each), 21-24): **delete**. TPP-002, TPP-003: polices removed setting names.
- POLICY_PUBLIC_REFUSALS (test (test.each), 21-21): **delete**. Table of the test above; same decision.
- scope and command maps retain literal identities through parsing, editing, and canonical writing (test (test), 26-59): **delete**. POL-004, POL-006 and POL-007 make scope paths and check names plain values, so dotted map keys are gone; TPP-003 deletes its four removed-name assertions.
- scope validation reports the literal map key and its authored value position (test (test), 61-65): **delete**. Duplicate of the scope rows of the key-path test in read.test.ts (TPP-007); POL-006 changes the scope shape.
- scope path leaves normalize once while inherited roots and module identities retain their origin (test (test), 67-93): **delete**. It tests the prefixing of paths written in a scope (deleted with scopePolicyPaths), record lists in a scope (refused), the deleted types and test_harness roles, and tools.eslint.runtimes, which is the runtime field of a root \[\[tools.eslint.override\]\] (CFR-003, CFR-004, TML-001).
- a hooks table needs its explicit enabled choice to generate or require hooks (test (test), 95-104): **delete**. Duplicate: the defaults test in normalize.test.ts checks that hooks.enabled defaults to false, and tests/cli/lifecycle/hooks.test.ts:97 checks that no hooks install.
- schema validation preserves authored absence while execution fills only declared defaults (test (test), 106-119): **move** to `tests/unit/cli/settings/normalize.test.ts` `parsing keeps only what was written, and the settings get the defaults`. Real behavior of settings/normalize.ts (TPP-030): the raw table keeps what was written (POL-042) and normalize fills only declared defaults; the sample uses \[hooks\] and \[rules\] enabled = false (TML-002, TML-003).
- root and scoped reasons must name a setting authored in their own table (test (test), 121-130): **delete**. A reason sits next to its value, so a reason without a setting cannot be written; the \[reasons\] table and validateAuthoredReasons go (CFR-002).
- module import edges name declared modules and preserve authored absence (test (test), 132-158): **move** to `tests/unit/cli/settings/schema/architecture.test.ts` `module imports must name declared modules`. Real behavior (TPP-030); TPP-003 deletes the imports_allowed assertion; the record header is \[\[architecture.module\]\], root only (CFR-004).
- architecture roles refuse misspellings and retain the declared harness name (test (test), 160-166): **delete**. TPP-016: restates a strictObject; TPP-003: test_support history.
- configuration-declared roles use the owning defaults and preserve raw authored absence (test (test), 168-183): **delete**. Weak: the expected values copy the shipped zustand and javascript role globs, so a manifest edit breaks it without a bug.
- a configuration role follows selected ancestor configurations and refuses an unrelated sibling owner (test (test), 185-199): **move** to `tests/unit/cli/settings/errors/keys.test.ts` `a role must be declared by a configuration selected in that scope or above`. Real behavior of the known-settings check (errors/keys.ts); the scope role is written architecture.roles.scripts = \["app/scripts/\*\*"\] inside a \[\[scope\]\] record (CFR-003).
- test roles follow effective test files unless an authored role replaces them (test (test), 201-219): **delete**. The tests role goes as a second name for test_files (TML-001); test_files inheritance is tested by the scope view tests.
- scope $path retains inherited path origins and native empty disabling values (test (test.each), 221-240): **delete**. It tests the prefixing of folders written in a scope, which is deleted (CFR-003), and supabase.types_file = "" as an off value, which absence replaces (TML-010).
- PATH_SCOPE_CASES (test (test.each), 221-221): **delete**. Table of the deleted test above; same decision.
- omitting defaults preserves path origins in every selected descendant (test (test), 242-261): **move** to `tests/unit/cli/settings/drop-defaults.test.ts` `dropping defaults keeps every scope's paths the same`. Real behavior of drop-defaults.ts on scope paths: a root-written supabase/functions still differs from the default inside a child scope; scopes are \[\[scope\]\] records with path and dotted keys (CFR-003), and the third sample goes with supabase.types_file = "" (TML-010).
- effective architecture delivery inherits modules by field and preserves their authored path origin (test (test), 263-306): **delete**. POL-024: declaredArchitectures is called only by this test.
- native options named reason retain their values separately from the policy explanation (test (test), 308-320): **move** to `tests/unit/cli/settings/errors/reasons.test.ts` `a tool option named reason is passed on and is not a gspot reason`. Real behavior: an option named reason stays in the value, written tools.prettier.extra = { value = { reason = false }, reason = "..." } (POL-034, CFR-002).

## `tests/cli/policy/read/boundaries.test.ts`

- (the file) (file): **move** to `tests/unit/cli/settings/schema/parts.test.ts`. Tests relativePath in settings/schema/parts.ts (TPP-008 keeps this test).
- configuration directory boundaries (describe (describe), 8-60): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- configuration directory boundaries &gt; $where refuses escaping directory $path before filesystem discovery (test (test.each), 9-26): **keep** to `tests/unit/cli/settings/schema/parts.test.ts` `$where refuses the path $path`. Real behavior; agent_rules.folder, own_rules_folder and architecture.roles.test_harness go (TML-001, TML-003), so the test is test.each(UNSAFE_DIRECTORIES) over the \[\[scope\]\] path.
- configuration directory boundaries &gt; UNSAFE_DIRECTORIES.flatMap((path) =&gt; \[ { where: 'scope.${path}', path, values: { scope: { \[path\]: {} } } }, (test (test.each), 9-20): **keep** to `tests/unit/cli/settings/schema/parts.test.ts` `$where refuses the path $path`. Table of the test above; only the \[\[scope\]\] path rows are left, from UNSAFE_DIRECTORIES in tests/config/settings/schema.ts.
- configuration directory boundaries &gt; accepts relative directories containing spaces, percent signs, and Unicode (test (test), 28-59): **keep** to `tests/unit/cli/settings/schema/parts.test.ts` `relative folders with spaces, percent signs and Unicode are accepted`. Real behavior; the sample keeps a \[\[scope\]\] path with spaces, percent signs and Unicode, while the \_\_proto\_\_ parts (ROOT-004), agent_rules.folder, own_rules_folder, test_harness, the words map and the scope test_files prefix assertions go (TML-001, TML-003, TMF-007, CFR-003).

## `tests/cli/policy/read/commitlint.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/settings/schema/tools.test.ts`. TPP-006: one rule-table test; its data file goes too.
- keeps commitlint severity and coverage with the level in root and scoped settings (test (test), 6-35): **merge** to `tests/unit/cli/settings/schema/tools.test.ts` `$tool rule settings cannot turn rules on or off: $toml`. TPP-006 rows, one per refusal branch, from tests/config/settings/errors.ts (REFUSED_RULE_OPTIONS); TPP-007 one scope; the refusal names tools.&lt;tool&gt;.extra (CFR-002).

## `tests/cli/policy/read/recovery.test.ts`

- (the file) (file): **split** to `tests/unit/cli/settings/errors/reasons.test.ts; tests/unit/cli/settings/errors/keys.test.ts; tests/unit/cli/settings/read.test.ts`. One read path (POL-065), so readPolicyTable and the drop-and-continue behavior go; the errors stay as strict-read tests.
- forbidden ShellCheck settings in a scope are reported and removed at the scoped key (test (test), 13-22): **delete**. POL-065 deletes the drop; the ShellCheck refusal is a row of the rule table (TPP-006, TPP-007).
- $name (test (test.each), 23-35): **move** to `tests/unit/cli/settings/errors/reasons.test.ts` `a record without a reason is refused at its reason field`. Real behavior; POL-065 leaves only the refusal; POL-019 makes reason required with the same text.
- MISSING_REASON_CASES (test (test.each), 23-23): **delete**. POL-065: one case is left, so the test.each becomes a plain test.
- a limit with a placeholder reason is dropped with its value, and the tightened limit stays (test (test), 37-45): **delete**. Duplicate of the refused-reason test ('because'): same word-count rule; POL-065 deletes the drop.
- a loosening without a reason and an unknown nested setting are findings, and the defaults stand (test (test), 47-76): **move** to `tests/unit/cli/settings/errors/keys.test.ts` `a limit looser than the default needs a reason, and a tighter one does not`. Real behavior; POL-065 deletes the drop and TPP-002 the unknown-key half; POL-031 renames limits.duplication.min_lines; the refusal asks for the reason form (Write it as { value = 1000, reason = "..." }, CFR-002), and scopes are \[\[scope\]\] records (CFR-003).
- an unknown configuration stops reading and names a matching configuration (test (test), 78-84): **merge** to `tests/unit/cli/settings/read.test.ts` `unknown configurations are refused where they are written, with a suggestion`. Its suggestion check joins the test of unknown configuration errors.
- an unknown native tool option is refused at its table (test (test), 86-91): **delete**. TPP-002: unknown keys are tested once.
- a syntax error stops reading with a TOML diagnostic (test (test), 93-99): **delete**. TPP-010: duplicate of the syntax error test.
- an unknown top-level key stops reading and names that key (test (test), 101-107): **delete**. TPP-002: unknown keys are tested once.
- unknown configurations retain duplicate root entries and scoped declaration order (test (test), 109-122): **move** to `tests/unit/cli/settings/read.test.ts` `unknown configurations are refused where they are written, with a suggestion`. Real behavior: each unknown name at its key path; scopes are \[\[scope\]\] records (CFR-003), so error paths read scope.0.configurations.N.
- an existing naming entry %j asks for a reason on that entry (test (test.each), 124-138): **delete**. TML-005 deletes naming.allowed; record reasons are tested by the reason tests.
- \["author's name", '$(printf injected); \*'\] (test (test.each), 124-124): **delete**. Table of the test above; same decision.

## `tests/cli/policy/read/settings.test.ts`

- (the file) (file): **split** to `tests/unit/cli/settings/errors/reasons.test.ts; tests/unit/cli/settings/errors/keys.test.ts; tests/unit/cli/settings/normalize.test.ts; tests/unit/cli/settings/read.test.ts; tests/unit/cli/settings/schema/tools.test.ts; tests/unit/cli/settings/schema/parts.test.ts`. TPP-030, TPP-006, TPP-008: each test goes to the source file that does its job.
- validates environment declarations in root and scope tables (test (test), 20-33): **delete**. Restates the \[secrets\] schema lines (TPP-016 rule); unknown keys are tested once (TPP-002); scope doubling (TPP-007).
- a $name reason is refused before normalization with scoped=$scoped (test (test.each), 35-47): **delete**. Weak: restates the string type of a reason, a plain Zod line (TPP-016); key paths are tested by 'an error names the key path of $name'.
- MALFORMED_REASON_CASES.flatMap((entry) =&gt; \[ { ...entry, scoped: false }, { ...entry, scoped: true }, (test (test.each), 35-40): **delete**. Weak: table of the test above.
- policy value normalization (describe (describe), 49-67): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- policy value normalization &gt; normalizes plain limits and their separate explanations (test (test), 50-57): **move** to `tests/unit/cli/settings/normalize.test.ts` `limits are split into root and language tables`. Real behavior of settings/normalize.ts; the sample writes function_lines = { value = 80, reason = "..." } and the Python limit the same way (CFR-002).
- policy value normalization &gt; normalizes per-language naming tables and categories (test (test), 59-66): **move** to `tests/unit/cli/settings/normalize.test.ts` `naming settings are split by language and category`. Real behavior of settings/normalize.ts; the sample uses naming.banned_words, with the reason next to the value (CFR-002).
- policy setting refusals (describe (describe), 69-97): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- policy setting refusals &gt; $name (test (test.each), 70-75): **move** to `tests/unit/cli/settings/errors/keys.test.ts` `an unknown key is refused: $name`. TPP-002 keeps unknown keys tested here only.
- policy setting refusals &gt; UNKNOWN_KEY_CASES (test (test.each), 70-70): **move** to `tests/unit/cli/settings/errors/keys.test.ts` `an unknown key is refused: $name`. Table of the test above; same decision.
- policy setting refusals &gt; a scoped disabled ESLint rule names the accepted-finding command and rule (test (test), 77-88): **move** to `tests/unit/cli/settings/schema/tools.test.ts` `turning off an ESLint rule in a scope points to gspot ignore at its key path`. Real behavior; TPP-010 adds the correction check of the key-path test; the rule-option schemas live in schema/tools.ts; the scope is a \[\[scope\]\] record (CFR-003).
- policy setting refusals &gt; a verbatim table needs a reason (test (test), 90-96): **move** to `tests/unit/cli/settings/errors/reasons.test.ts` `an extra tool options table needs a reason`. Real behavior; an extra table written without the reason form is refused with the reason-form message (POL-034, CFR-002).
- authored scope and inventory policy (describe (describe), 99-115): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- authored scope and inventory policy &gt; nested and absent scopes retain authored policy (test (test), 100-108): **move** to `tests/unit/cli/settings/read.test.ts` `scopes may be nested and may name folders that do not exist yet`. Real behavior of reading scopes, written as \[\[scope\]\] records with path and dotted keys (CFR-003).
- authored scope and inventory policy &gt; a vendored declaration needs a reason when required (test (test), 110-114): **delete**. Duplicate: POL-019 gives every record the same required reason, which 'a record without a reason is refused at its reason field' checks.
- a missing gspot.toml points at init (test (test), 117-120): **delete**. TPP-010: duplicate of the missing-file test in settings/file.test.ts.
- refuses an empty correction command (test (test), 122-131): **delete**. TPP-010: the empty command is tested once, in the schema agreement cases.
- schema defaults preserve absent and explicitly authored empty policy tables (test (test), 133-156): **delete**. Duplicate: same behavior as 'parsing keeps only what was written, and the settings get the defaults'; POL-065 deletes readPolicyTable.
- native $rule disabling names its actual ignore command: $value (test (test.each), 158-167): **merge** to `tests/unit/cli/settings/schema/tools.test.ts` `$tool rule settings cannot turn rules on or off: $toml`. TPP-006: DISABLED_RULES rows join the rule table, from tests/config/settings/errors.ts (REFUSED_RULE_OPTIONS).
- DISABLED_RULES (test (test.each), 158-158): **merge** to `tests/unit/cli/settings/schema/tools.test.ts` `$tool rule settings cannot turn rules on or off: $toml`. Table of the test above; its rows come from tests/config/settings/errors.ts.
- native zero-valued Stylelint options and false Taplo formatting remain active options (test (test), 169-181): **move** to `tests/unit/cli/settings/schema/tools.test.ts` `zero and false tool options are kept as values`. Real behavior; parse strictly (POL-065); the sample writes tools.taplo.extra = { value = { reorder_keys = false }, reason = "..." } (CFR-002).
- removed structure setting %s is refused in root and scope tables (test (test.each), 183-189): **delete**. TPP-003: polices removed setting names.
- REMOVED_STRUCTURE_SETTINGS (test (test.each), 183-183): **delete**. Table of the test above; same decision.
- $configuration $level paths in $scope are refused at the policy boundary and retain scope origins (test (test.each), 191-227): **delete**. Duplicate: the one relativePath check is tested by '$where refuses the path $path' (TPP-008), and its level loop changes nothing.
- PATH_SETTINGS.flatMap((entry) =&gt; (\['recommended', 'all'\] as const).flatMap((level) =&gt; \['', 'app'\].map((scope) =&gt; (test (test.each), 191-195): **delete**. Duplicate: table of the test above.

## `tests/cli/policy/read/tools.test.ts`

- (the file) (file): **move** to `tests/unit/cli/settings/schema/tools.test.ts`. TPP-006: one rule-table test; the rule-option schemas live in settings/schema/tools.ts. commitlint and yamllint tests join it.
- $tool refuses $options with scope=$scope (test (test.each), 11-21): **delete**. TPP-004: 7 rows with 2 outcomes; basedpyright is not a tool table.
- UNSUPPORTED_PYTHON_OPTIONS.flatMap((entry) =&gt; \['', 'app'\].map((scope) =&gt; ({ ...entry, scope }))) (test (test.each), 11-11): **delete**. Table of the test above; same decision.
- keeps ShellCheck rule selection with its coverage level and ignores (test (test), 23-36): **merge** to `tests/unit/cli/settings/schema/tools.test.ts` `$tool rule settings cannot turn rules on or off: $toml`. TPP-006 row: one row (disable = "SC2086"), since enable = "all" takes the same refusal; TPP-007 one scope; options are written tools.&lt;tool&gt;.extra (CFR-002).
- refuses authored ESLint coverage choices in root and scoped native options (test (test), 38-54): **keep** to `tests/unit/cli/settings/schema/tools.test.ts` `$tool rule settings cannot turn rules on or off: $toml`. TPP-006: the one table test {configuration, table, toml, message}, one row per refusal branch: ESLint ('"error"'), Markdown (a value and a key row), commitlint, YAML (a value and an ignore row), Stylelint, ShellCheck and the two DISABLED_RULES rows, from tests/config/settings/errors.ts; no extra rows (TPP-004) and one scope (TPP-007).
- refuses authored Markdown coverage choices in root and scoped settings (test (test), 56-77): **merge** to `tests/unit/cli/settings/schema/tools.test.ts` `$tool rule settings cannot turn rules on or off: $toml`. TPP-006 rows: 'MD041 = true' (value branch) and 'default = {}' (key branch); the refusal names extra (CFR-002).
- refuses authored Stylelint warning severity in root and scoped native options (test (test), 79-87): **merge** to `tests/unit/cli/settings/schema/tools.test.ts` `$tool rule settings cannot turn rules on or off: $toml`. TPP-006 row (TPP-005 keeps the Stylelint refusal here); a scope row, if TPP-007 leaves one, is a \[\[scope\]\] record (CFR-003).
- native rule options preserve path-dependent diagnostics and nested JSON validation (test (test), 89-110): **keep** to `tests/unit/cli/settings/schema/tools.test.ts` `rule keys named like object properties are checked like any other key`. Real behavior; ROOT-004 removes \_\_proto\_\_ from the key loop; the three tools reach the same zod record, so commitlint stays with the keys ordinary, constructor, prototype and toString; TPP-007 one scope.

## `tests/cli/policy/read/yamllint.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/settings/schema/tools.test.ts`. TPP-006: one rule-table test; its data file goes too.
- keeps YAML coverage and exclusions in level and ignore policy for every scope (test (test), 6-32): **merge** to `tests/unit/cli/settings/schema/tools.test.ts` `$tool rule settings cannot turn rules on or off: $toml`. TPP-006 rows: 'truthy = true' and 'truthy = { ignore = "\*\*" }'; no extra assertion (TPP-004); the refusal names extra (CFR-002).

## `tests/cli/policy/schema.test.ts`

- (the file) (file): **move** to `tests/unit/cli/settings/schema/gspot-toml.test.ts`. Tests the root schema of gspot.toml (settings/schema/gspot-toml.ts) against the published JSON Schema; TPP-039 cuts it to fields with a refinement.
- the JSON schema of gspot.toml (describe (describe), 35-72): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- the JSON schema of gspot.toml &gt; the zod schema accepts the documented example shapes and rejects unknown keys (test (test), 36-48): **delete**. TPP-016: restates the schema.
- the JSON schema of gspot.toml &gt; the published schema accepts a check with and without its correction command (test (test), 50-71): **delete**. TPP-040 keeps only the check table, and POL-004 with POL-007 makes check names values, so property-named keys are gone (ROOT-004 removes \_\_proto\_\_); the check record stays a row of the agreement test (TPP-039).
- numeric limit $key retains its authored key with scope=$scope (test (test.each), 74-91): **delete**. TPP-040.
- OWN_RECORD_KEYS.flatMap((key) =&gt; \['', 'app'\].map((scope) =&gt; ({ key, scope }))) (test (test.each), 74-74): **delete**. Table of the test above; same decision.
- runtime and published schemas agree on $name (test (test.each), 93-123): **keep** to `tests/unit/cli/settings/schema/gspot-toml.test.ts` `runtime and published schemas agree on $name`. TPP-039: rows only for fields with a refinement or hand-written meta, without scope doubling (TPP-007); validate compiles the JSON Schema that the CLI settings schema code builds (CFR-001).
- \[ ...RUNTIME_SCHEMA_CASES, ...POLICY_FIELD_SCHEMA_CASES, ...NAMING_SCHEMA_CASES, ...EXCEPTION_SCHEMA_CAS (test (test.each), 93-116): **keep** to `tests/unit/cli/settings/schema/gspot-toml.test.ts` `runtime and published schemas agree on $name`. Table of the test above; its rows come from tests/config/settings/schema.ts (PUBLISHED_SCHEMA_CASES).
- manifest settings validate $name (test (test.each), 125-141): **delete**. TPP-003 (removed locales rows), TPP-039 (no refinement), TPP-008 (path rows), TPP-007 (scope rows).
- LOCALE_SCHEMA_CASES (test (test.each), 125-125): **delete**. Table of the test above; same decision.
- manifest settings preserve typed values and reject unknown siblings (test (test), 143-163): **delete**. TPP-002: unknown keys are tested once (errors/keys.test.ts); the accepted values restate the schema (TPP-016 rule).
- published and runtime schemas reject an escaping agent-rule project folder %j (test (test.each), 165-172): **delete**. TPP-008: repeats the boundaries test.
- UNSAFE_DIRECTORIES (test (test.each), 165-165): **delete**. Table of the test above; same decision.
- 'runtime and published tool schemas agree in ${scope || 'root'} on $name' (test (test.each), 175-190): **merge** to `tests/unit/cli/settings/schema/gspot-toml.test.ts` `runtime and published schemas agree on $name`. TPP-039: the refined tool rows join the one agreement table; TPP-007 drops the scope loop.
- TOOL_SCHEMA_CASES (test (test.each), 175-175): **merge** to `tests/unit/cli/settings/schema/gspot-toml.test.ts` `runtime and published schemas agree on $name`. Table of the test above; its rows come from tests/config/settings/schema.ts.
- 'native verbatim applicability agrees in ${scope || 'root'} for %s' (test (test.each), 193-211): **delete**. TPP-004: a snapshot of which tools take extra options.
- \[...VERBATIM_TOOL_NAMES, ...NO_VERBATIM_TOOL_NAMES\] (test (test.each), 193-193): **delete**. Table of the test above; same decision.
- native policy metadata example %j parses in every published surface (test (test.each), 213-217): **keep** to `tests/unit/cli/settings/schema/gspot-toml.test.ts` `schema example %j is a valid gspot.toml`. Real behavior; title from TTC-032.
- examples (test (test.each), 213-213): **keep** to `tests/unit/cli/settings/schema/gspot-toml.test.ts` `schema example %j is a valid gspot.toml`. Table of the test above; same decision.
- the policy reference emits canonical examples and retains native editor metadata (test (test), 219-235): **delete**. The schema examples are checked by the test above; the rest tests the docs reference page (docs/src/content/reference/), which has no suite in the owner's test layout.
- examples (const, 31-31): **move** to `tests/unit/cli/settings/schema/gspot-toml.test.ts` `examples`. Used by the schema example test; computed at load time from policySchema.meta(), so it stays in the test file.
- validate (const, 33-33): **move** to `tests/unit/cli/settings/schema/gspot-toml.test.ts` `validate`. Used by the agreement and example tests; computed at load time (an Ajv compile of buildJsonSchema, which comes from the CLI settings schema code, CFR-001), so it stays in the test file.

## `tests/cli/policy/settings/known.test.ts`

- (the file) (file): **split** to `tests/unit/cli/settings/inherit.test.ts; tests/unit/cli/settings/errors/reasons.test.ts`. Tests settingValue and declarationFor in settings/inherit.ts; the word reason tests go to errors/reasons.test.ts.
- new license policy requires an explicit choice (test (test), 13-24): **delete**. Weak: checks one configured default, licenses.allowed = \[\]; the override part repeats 'a written false overrides a configuration's true default'.
- spelling accepts the reason %s (test (test.each), 26-32): **delete**. Weak: only checks that nothing is thrown; POL-022 moves the 'Codex' row to the refused test.
- \['Codex', 'The public product name.'\] (test (test.each), 26-26): **delete**. Weak: table of the test above.
- spelling refuses the invalid reason %s (test (test.each), 34-40): **move** to `tests/unit/cli/settings/errors/reasons.test.ts` `a word with the reason %s is refused`. TPP-009; gains the 'Codex' row (POL-022); words are written allowed_words = { value = \["Codex"\], reason = ... } (TMF-007), and the refused reasons stay the same.
- \['', 'because'\] (test (test.each), 34-34): **move** to `tests/unit/cli/settings/errors/reasons.test.ts` `a word with the reason %s is refused`. Table of the test above; same decision.
- spelling refuses a word without a string reason (test (test), 42-46): **delete**. Weak: restates the string type of a word reason, a plain Zod line (TPP-016).
- conflicting configuration defaults (describe (describe), 48-104): **delete**. Wrapper only: its shared setup moves to the top of the target file and its tests stay (TPP-028).
- conflicting configuration defaults &gt; reports both configurations until an explicit root value settles their scalar (test (test), 61-77): **keep** to `tests/unit/cli/settings/inherit.test.ts` `two configurations with different defaults are an error until gspot.toml sets the value`. Real behavior; validateAgainstSurface becomes validateKnownSettings (glossary: known settings).
- conflicting configuration defaults &gt; reports an unresolved conflict at the scope that selects the configurations (test (test), 79-86): **keep** to `tests/unit/cli/settings/inherit.test.ts` `the conflict is reported at the scope that selects both configurations`. Real behavior; the scope is a \[\[scope\]\] record with path and dotted keys (CFR-003).
- conflicting configuration defaults &gt; an inherited scope value settles descendants but leaves a sibling conflict visible (test (test), 88-103): **keep** to `tests/unit/cli/settings/inherit.test.ts` `a scope value settles the scopes below it, and a sibling scope still reports the conflict`. Real behavior; the scope is a \[\[scope\]\] record with path and dotted keys (CFR-003).
- setting defaults and declarations (describe (describe), 106-159): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- setting defaults and declarations &gt; a configuration transaction default is overridden by an explicit false value (test (test), 107-120): **keep** to `tests/unit/cli/settings/inherit.test.ts` `a written false overrides a configuration's true default`. Real behavior.
- setting defaults and declarations &gt; an inherited dialect default names the configuration that declares it (test (test), 122-130): **keep** to `tests/unit/cli/settings/inherit.test.ts` `an inherited default names the configuration that declares it`. Real behavior.
- setting defaults and declarations &gt; maps a per-language key back to its base declaration (test (test), 132-139): **keep** to `tests/unit/cli/settings/inherit.test.ts` `a per-language key maps to its base setting`. Real behavior.
- setting defaults and declarations &gt; refuses SQL function line and Bash cyclomatic limits without native consumers (test (test), 141-158): **keep** to `tests/unit/cli/settings/inherit.test.ts` `limits that no check reads are refused`. Real behavior; no "native" (TTC-032).
- root and scoped settings (describe (describe), 161-186): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- root and scoped settings &gt; resolves configuration default, root table, then scope table (test (test), 162-172): **keep** to `tests/unit/cli/settings/inherit.test.ts` `a value comes from the configuration default, then the root table, then the scope table`. Real behavior; the scope is a \[\[scope\]\] record with path and dotted keys (CFR-003).
- root and scoped settings &gt; lists append and deduplicate across layers (test (test), 174-185): **keep** to `tests/unit/cli/settings/inherit.test.ts` `lists add up across tables without repeats`. Real behavior; scopes are \[\[scope\]\] records (CFR-003), and the sample uses naming.banned_words.
- merged settings (describe (describe), 188-234): **delete**. Wrapper only: its tests stay, at the top level of the target file (TPP-028).
- merged settings &gt; list defaults append across configurations before root and scope additions (test (test), 189-215): **keep** to `tests/unit/cli/settings/inherit.test.ts` `list defaults add up across configurations before root and scope additions`. Real behavior; scopes are \[\[scope\]\] records (CFR-003), and the sample uses naming.banned_words.
- merged settings &gt; scoped rules inherit unrelated rules and replace complete options for the same rule (test (test), 217-233): **keep** to `tests/unit/cli/settings/inherit.test.ts` `a scope's rules keep other rules and replace the whole options of the same rule`. Real behavior; the scope is a \[\[scope\]\] record with path and dotted keys (CFR-003).
- selected (const, 10-10): **move** to `tests/unit/cli/settings/inherit.test.ts` `selected`. Shared setup of the tests in the file; computed at load time, so it stays in the test file.
- surface (const, 11-11): **move** to `tests/unit/cli/settings/inherit.test.ts` `known`. Shared setup; glossary: known settings, variable known (NMS-018); computed at load time, so it stays in the test file.

## `tests/cli/policy/settings/view.test.ts`

- (the file) (file): **split** to `tests/unit/cli/settings/view.test.ts; tests/unit/cli/planning/checks.test.ts`. Tests the scope views (settings/view.ts); TPP-020 moves the two planning-only tests and TGN-037 drops the level loops; drop the header comment (TPP-045).
- an ignore with a rule and paths turns the rule off in its scope and the scopes below only (test (test), 29-34): **keep** to `tests/unit/cli/settings/view.test.ts` `an ignore with a rule and paths turns the rule off in its scope and the scopes below only`. Real behavior.
- the deepest scope sets a limit and a scalar setting, and a scope list adds to the lists above it (test (test), 36-51): **keep** to `tests/unit/cli/settings/view.test.ts` `the deepest scope sets a limit and a scalar setting, and a scope list adds to the lists above it`. Real behavior; the sample uses xcode.scheme and tools.swiftlint.always_keep_imports.
- a per-scope generic limit overrides a root language limit in the scope view (test (test), 53-63): **keep** to `tests/unit/cli/settings/view.test.ts` `a per-scope limit overrides a root language limit in the scope view`. Real behavior; the scope is a \[\[scope\]\] record with path and dotted keys (CFR-003).
- a complete scope ignore keeps the compiler fallback and leaves other scopes active: %j (test (test.each), 65-102): **move** to `tests/unit/cli/planning/checks.test.ts` `an ignore of a whole scope keeps the replaced check running there and nowhere else: %j`. TPP-020: tests planning (skips and replacement), not the settings view; scopes are \[\[scope\]\] records (CFR-003).
- \[ { paths: \['api/\*\*'\], ignored: true }, { paths: \['api'\], ignored: true }, { paths: \['api/\*\*', '!api/app/\*\*' (test (test.each), 65-69): **move** to `tests/unit/cli/planning/checks.test.ts` `an ignore of a whole scope keeps the replaced check running there and nowhere else: %j`. Table of the test above; same decision.
- the root view follows its path despite scope order and refuses a selection without the root (test (test), 104-111): **delete**. POL-057: callers get the root scope instead of searching for it with rootView, so its search and its no-root guard go.
- ignore expiry uses the UTC date and keeps expired authored policy saved (test (test), 113-153): **keep** to `tests/unit/cli/settings/view.test.ts` `an until date ends at the end of that day in UTC, and the expired ignore stays in gspot.toml`. Real behavior.
- 'OpenAPI detects %s before tool activation at ${level}' (test (test.each), 156-173): **delete**. gspot init writes the OpenAPI document it finds, so nothing is detected at check time (TML-010).
- OPENAPI_DOCUMENTS (test (test.each), 156-156): **delete**. Table of the deleted test above; same decision.
- 'OpenAPI $name path keeps its authored origin at ${level}' (test (test.each), 175-187): **delete**. Its rows test check-time detection (deleted), document = "" as an off value (absence replaces it) and the prefixing of a path written in a scope (deleted) (TML-010, CFR-003); root-value inheritance is tested by the inherit tests.
- OPENAPI_PATH_CASES (test (test.each), 175-175): **delete**. Table of the deleted test above; same decision.
- 'OpenAPI absent documents and unselected scopes stay inactive at ${level}' (test (test), 189-201): **keep** to `tests/unit/cli/settings/view.test.ts` `OpenAPI stays off without a document and in a scope that removes it`. Real behavior; TGN-037 drops the level loop; the root view has no document (absent, not "") and no OpenAPI check runs (TML-010); scopes are \[\[scope\]\] records (CFR-003).
- 'Postgres client schemas are chosen by Supabase or authored policy at ${level}' (test (test), 205-221): **keep** to `tests/unit/cli/settings/view.test.ts` `Postgres client schemas come from Supabase or from gspot.toml`. Real behavior of configuration defaults per scope; TGN-037 drops the level loop; scopes are \[\[scope\]\] records (CFR-003).
- 'Apple native parsers belong to selected Xcode scopes at ${level}' (test (test), 223-247): **move** to `tests/unit/cli/planning/checks.test.ts` `Xcode plutil and xmllint checks take Apple files only in Xcode scopes`. TPP-020: tests planning (which check covers which file); TGN-037 drops the level loop; scopes are \[\[scope\]\] records (CFR-003).
- readScopeViews (function, 15-27): **move** to `tests/unit/cli/settings/view.test.ts` `readScopeViews`. Helper of three tests in the file.

## `tests/cli/policy/templates/export.test.ts`

- (the file) (file): **move** to `tests/unit/cli/settings/templates.test.ts`. Tests settings/templates.ts (POL-044); sources.test.ts joins it; drop the header comment (TPP-045).
- template export %s overrides (test (test.each), 12-24): **keep** to `tests/unit/cli/settings/templates.test.ts` `template export keeps %s`. Real behavior; the two samples write their scope overrides as root \[\[tools.eslint.override\]\] and \[\[format.override\]\] records with root-relative paths, and leftOut lists the two \[\[scope\]\] records (CFR-003, CFR-004).
- \[ \['preserves ESLint rules and authored path', ESLINT_OVERRIDE_POLICY, 'project.template.toml'\], \['retains autho (test (test.each), 12-15): **keep** to `tests/unit/cli/settings/templates.test.ts` `template export keeps %s`. Table of the test above; the samples hold root override records only (CFR-004).
- template export preserves authored empty integrations and rule tables (test (test), 26-48): **delete**. Duplicate: its empty-table part is 'template export keeps empty tables as written and adds no defaults', and its check-key part tests map keys that POL-007 and ROOT-004 remove.
- template export preserves advisory reasons and expiry and path-specific rows (test (test), 50-91): **keep** to `tests/unit/cli/settings/templates.test.ts` `template export keeps advisory ignores with until dates and path rows`. Real behavior.
- template export retains authored empty tables without writing schema defaults into them (test (test), 93-106): **keep** to `tests/unit/cli/settings/templates.test.ts` `template export keeps empty tables as written and adds no defaults`. Real behavior.
- an absolute template loads from a different working directory (test (test), 108-119): **keep** to `tests/unit/cli/settings/templates.test.ts` `a template given by absolute path loads from another working folder`. Real behavior; the template sample has no template = "house" or selection = "exact" (TML-011).
- templates retain runner coverage settings and authored architecture roles (test (test), 121-146): **delete**. Its own parts test deleted keys (the test_harness role, template and selection, tools.eslint.runtimes; TML-001, TML-011); writing and reading back tool and coverage tables is covered by the 'template export keeps %s' and license tests.
- templates round-trip license allowances and exact-version exceptions (test (test), 148-159): **keep** to `tests/unit/cli/settings/templates.test.ts` `templates keep allowed licenses and allowed packages`. Real behavior; licenses.exceptions becomes \[\[licenses.allowed_package\]\] records with name, version and reason (TML-009).

## `tests/cli/policy/templates/sources.test.ts`

- (the file) (file): **merge** to `tests/unit/cli/settings/templates.test.ts`. Tests getTemplate in settings/templates.ts. Drop the header comment (TPP-045).
- %s is fetched from %s (test (test.each), 10-19): **keep** to `tests/unit/cli/settings/templates.test.ts` `%s is downloaded from %s`. Real behavior.
- \[ \['<https://example.com/house.template.toml>', '<https://example.com/house.template.toml'\>], \['github:acme/policies (test (test.each), 10-14): **keep** to `tests/unit/cli/settings/templates.test.ts` `%s is downloaded from %s`. Table of the test above; the rows are built from RAW_HOST and TEMPLATE_FILE of the CLI config, so they stay in the test file (tests/config may not import the CLI package).
- a template address that answers 404 is refused with its status (test (test), 21-25): **keep** to `tests/unit/cli/settings/templates.test.ts` `a template address that answers 404 is refused with its status`. Real behavior.
- a template address over plain http is refused before any request (test (test), 27-33): **keep** to `tests/unit/cli/settings/templates.test.ts` `a template address over plain http is refused before any request`. Real behavior; TPP-035 keeps the suppression.
- private GitHub templates receive environment credentials without sending them to other hosts (test (test), 35-49): **keep** to `tests/unit/cli/settings/templates.test.ts` `a GitHub token goes only to GitHub template addresses`. Real behavior.

## `tests/config/cli/parsers/bash.ts`

- (the file) (file): **move** to `tests/config/bash/checks.ts`. Test data lives in tests/config/&lt;topic&gt;.ts; tests/config/bash.ts would pass 300 lines, so gspot's Bash check cases go to bash/checks.ts and the ShellCheck, Bats, syntax and sample-script data to bash/tools.ts.
- COMMENT_CASES (const exported, 2-9): **move** to `tests/config/bash/checks.ts` `BASH_COMMENT_CASES`. Test data goes to tests/config/, with a plain name beside the other Bash check cases; drop its doc comment (TPP-045).
- TEMPORARY_CASES (const exported, 12-74): **move** to `tests/config/bash/checks.ts` `MKTEMP_CLEANUP_CASES`. Test data goes to tests/config/ under a name that says what the rows hold; drop its doc comment (TPP-045).

## `tests/config/cli/parsers/comments.ts`

- (the file) (file): **move** to `tests/config/comments.ts`. Test constants and sample text live in tests/config/&lt;topic&gt;.ts, and tests/config imports only tests/config.
- COMMENT_BOUNDARIES (const exported, 2-88): **move** to `tests/config/comments.ts` `COMMENT_BOUNDARIES`. Test data goes to tests/config/; drop its doc comment (TPP-045).

## `tests/config/cli/parsers/configurations.ts`

- (the file) (file): **split** to `tests/config/configurations.ts; tests/unit/cli/configurations/manifests.test.ts`. Test data goes to tests/config/&lt;topic&gt;.ts: SEMGREP_ASSETS and IGNORED_PATH_REFUSALS go to tests/config/configurations.ts, and the two one-line declarations stay in the test file.
- SECURITY_DECLARATION (const exported, 1-1): **move** to `tests/unit/cli/configurations/manifests.test.ts` `SECURITY_DECLARATION`. Used by the query pack test (kept); a single short literal used by one test file, so it stays in that file.
- TOOL_DECLARATION (const exported, 3-3): **move** to `tests/unit/cli/configurations/manifests.test.ts` `TOOL_DECLARATION`. Used by the tool tests (kept); a single short literal used by one test file, so it stays in that file.
- SUPPRESSION_DECLARATION (const exported, 5-6): **delete**. Dead: used only by the deleted suppression test.
- SYNTAX_SELECTOR_DECLARATION (const exported, 9-13): **delete**. Dead: used only by the deleted syntax selector test.
- SEMGREP_ASSETS (const exported, 16-20): **move** to `tests/config/configurations.ts` `SEMGREP_ASSETS`. Used by the Semgrep pack test (kept); test data goes to tests/config/; drop its doc comment.
- IGNORED_PATH_REFUSALS (const exported, 23-28): **move** to `tests/config/configurations.ts` `IGNORED_PATH_REFUSALS`. Used by the ignored-path test (kept); test data goes to tests/config/; drop its doc comment.

## `tests/config/cli/parsers/expo.ts`

- (the file) (file): **move** to `tests/config/expo.ts`. Its parser test goes as a duplicate; the Expo report data stays in tests/config/expo.ts, where DOCTOR_RESULTS of the Expo check test uses it.
- REPORT (const exported, 1-2): **move** to `tests/config/expo.ts` `FAILED_DOCTOR_REPORT`. Used by the Expo check test only; stays in tests/config/expo.ts beside DOCTOR_RESULTS, which uses it; REPORT does not say what it holds (THR-033 rule).
- EXPECTED_ISSUES (const exported, 4-7): **move** to `tests/config/expo.ts` `EXPECTED_ISSUES`. Used by the Expo check test only; stays in tests/config/expo.ts beside DOCTOR_RESULTS, which uses it.

## `tests/config/cli/parsers/generated-header.ts`

- (the file) (file): **move** to `tests/config/generated-files.ts`. Test constants and sample text live in tests/config/&lt;topic&gt;.ts, and tests/config imports only tests/config. The generated-files topic file exists.
- GENERATED_HEADERS (const exported, 1-10): **move** to `tests/config/generated-files.ts` `GENERATED_HEADERS`. Test data goes to tests/config/; drop its doc comment (TPP-045).
- AUTHORED_HEADERS (const exported, 12-18): **move** to `tests/config/generated-files.ts` `NOT_GENERATED`. Test data goes to tests/config/; "authored" goes (glossary, TTC-032).

## `tests/config/cli/parsers/git.ts`

- (the file) (file): **move** to `tests/config/git.ts`. Test constants and sample text live in tests/config/&lt;topic&gt;.ts, and tests/config imports only tests/config.
- INVALID_PATH_PREFIX (const, 1-1): **move** to `tests/config/git.ts` `INVALID_PATH_PREFIX`. Part of INVALID_ENTRIES, which uses it; moves with it to tests/config/.
- SHA1 (const exported, 3-3): **move** to `tests/config/git.ts` `SHA1`. The config rows use it, so it lives with them in tests/config/; drop its doc comment (TPP-045).
- SHA256 (const exported, 5-5): **move** to `tests/config/git.ts` `SHA256`. The config rows use it, so it lives with them in tests/config/; drop its doc comment (TPP-045).
- BINARY_BLOB (const exported, 7-7): **move** to `tests/config/git.ts` `BINARY_BLOB`. Test data goes to tests/config/; drop its doc comment (TPP-045).
- ENTRY_PATH (const exported, 9-9): **move** to `tests/config/git.ts` `ENTRY_PATH`. Test data goes to tests/config/; drop its doc comment (TPP-045).
- ENTRY_FAILURE (const exported, 11-12): **move** to `tests/config/git.ts` `ENTRY_FAILURE`. Used only inside the data file, so it moves to tests/config/ without an export (TTC-037).
- INVALID_ENTRIES (const exported, 14-29): **move** to `tests/config/git.ts` `INVALID_ENTRIES`. Test data goes to tests/config/; rows run against parseTreeEntries or parseIndexEntries (PAR-003).
- BLOB_FAILURE (const exported, 31-31): **move** to `tests/config/git.ts` `BLOB_FAILURE`. Used only inside the data file, so it moves to tests/config/ without an export (TTC-037).
- INVALID_BLOBS (const exported, 33-47): **move** to `tests/config/git.ts` `INVALID_BLOBS`. Test data goes to tests/config/; drop its doc comment (TPP-045).

## `tests/config/cli/parsers/json.ts`

- (the file) (file): **inline** to `tests/unit/cli/parsers/json.test.ts`. A list of short strings stays in the test file as a single short literal.
- NON_RECORD_JSON (const exported, 1-1): **move** to `tests/unit/cli/parsers/json.test.ts` `NON_RECORD_JSON`. A short literal kept in the test file, one row per branch: 'null', '\[\]' and '42'; drop its doc comment (TPP-045).
- INVALID_JSON (const exported, 3-3): **delete**. TPP-013: its test (Bun parse error text) goes.

## `tests/config/cli/parsers/jsonc.ts`

- (the file) (file): **inline** to `tests/unit/cli/parsers/json.test.ts`. jsonc.test.ts joins json.test.ts (TPP-019), and the one short case left is written in the test.
- JSONC_FAILURES (const exported, 1-5): **inline** to `tests/unit/cli/parsers/json.test.ts` `JSON with comments names the error offset`. One row per jsonc-parser error kind adds nothing, so the first row stays, written in the test as a short literal.
- JSONC_ENTRIES (const exported, 7-12): **delete**. TPP-013, TPP-019: both of its tests go; the Wrangler test writes its one null case inline.

## `tests/config/cli/parsers/lockfiles.ts`

- (the file) (file): **move** to `tests/config/npm.ts`. rootLockfileDependencies goes to tools/npm/lockfiles.ts and its test follows; the data goes to the npm topic file in tests/config/.
- ROOT_DEPENDENCIES (const exported, 2-20): **move** to `tests/config/npm.ts` `ROOT_DEPENDENCIES`. Test data goes to tests/config/npm.ts; write the pnpm YAML on several lines (TPP-029) and add a pnpm row without dev dependencies (PAR-044).

## `tests/config/cli/parsers/naming.ts`

- (the file) (file): **move** to `tests/config/sql.ts`. Its one user moves to the naming check tests (PAR-013); the data goes to the sql topic file in tests/config/.
- SQL_SOURCE (const exported, 1-15): **move** to `tests/config/sql.ts` `SQL_DECLARATIONS`. Test data goes to tests/config/ under a name that says what the SQL holds; drop its doc comment (TPP-045).

## `tests/config/cli/parsers/nextjs.ts`

- (the file) (file): **move** to `tests/config/nextjs.ts`. Its one user joins the Next.js check test (PAR-011); the data goes to the nextjs topic file in tests/config/.
- NEXT_CONFIG_CASES (const exported, 1-25): **move** to `tests/config/nextjs.ts` `NEXT_CONFIG_CASES`. Test data goes to tests/config/; drop its doc comment (TPP-045).

## `tests/config/cli/parsers/output/contract.ts`

- (the file) (file): **move** to `tests/config/output.ts`. Its one user joins formats.test.ts; the data goes to tests/config/output.ts (tool output formats) without the CheckDeclaration import, since tests/config imports only tests/config.
- OUTPUTS (const exported, 4-20): **move** to `tests/config/output.ts` `OUTPUTS`. Table of the format test; tests/config imports only tests/config, so it is written as const without the CheckDeclaration annotation, and the test that reads it checks the type.
- JSON_FORMATS (const exported, 22-22): **move** to `tests/config/output.ts` `JSON_FORMATS`. Used by the format test; test data goes to tests/config/.
- FOREIGN (const exported, 24-24): **move** to `tests/config/output.ts` `OTHER_TOOL_OUTPUT`. Used by the format test; FOREIGN does not say what it holds; test data goes to tests/config/.
- EMPTY_ERRORS (const exported, 26-26): **move** to `tests/config/output.ts` `EMPTY_ERRORS`. Used by the format test; test data goes to tests/config/.
- LINE_FINDINGS (const exported, 28-36): **move** to `tests/config/output.ts` `LINE_FINDINGS`. Used by the format test; test data goes to tests/config/.

## `tests/config/cli/parsers/output/declared-checks.ts`

- (the file) (file): **move** to `tests/config/execution.ts`. Its one test is a command check test (execution/command), so the data goes to tests/config/execution.ts.
- PENDING (const exported, 2-6): **move** to `tests/config/execution.ts` `PENDING_NOTES_SCRIPT`. Used once, inside the gspot.toml text of that test; a five-line script is not a short literal, so it goes to tests/config/.

## `tests/config/cli/parsers/output/formats.ts`

- (the file) (file): **split** to `tests/config/formatting.ts; tests/config/markdown.ts; tests/config/spelling.ts`. Each constant goes to its topic file: EDITORCONFIG_REPORT to formatting.ts, the markdownlint data to markdown.ts, the typos data to spelling.ts.
- EDITORCONFIG_REPORT (const exported, 3-4): **move** to `tests/config/formatting.ts` `EDITORCONFIG_REPORT`. One user; a four-line report is not a short literal, so it goes to tests/config/.
- MARKDOWN_REPORT (const exported, 6-16): **move** to `tests/config/markdown.ts` `MARKDOWN_REPORT`. Two test files use it: markdownlint.test.ts and the execution exit test.
- TYPO_REPORT (const exported, 18-25): **move** to `tests/config/spelling.ts` `TYPO_REPORT`. Two test files use it: typos.test.ts and the execution exit test; it builds on TYPO, the spelling sample.
- REPORT_ERRORS (const exported, 27-124): **split** to `tests/config/markdown.ts; tests/config/spelling.ts` `MARKDOWNLINT_REPORT_ERRORS; TYPOS_REPORT_ERRORS`. Markdown rows go to markdownlint.test.ts and spelling rows to typos.test.ts, as one-line rows in tests/config/; PAR-017 deletes the outside-column, outside-line and missing-source markdown rows, and the duplicates go: the markdown 'empty report' and 'non-JSON text' rows and the spelling 'unfinished JSON' row repeat the format contract test, and 'large offset' repeats 'outside offset'.

## `tests/config/cli/parsers/output/knip.ts`

- (the file) (file): **move** to `tests/config/knip.ts`. Its one user is the Knip report test; the data goes to the knip topic file in tests/config/.
- KNIP_REPORT (const exported, 2-36): **delete**. Dead: used only by the deleted Knip category test.
- KNIP_EXPECTED (const exported, 39-59): **delete**. Weak: a copy of the source message table.
- INVALID_KNIP_REPORTS (const exported, 62-71): **move** to `tests/config/knip.ts` `INVALID_KNIP_REPORTS`. Test data goes to tests/config/ without the 'not JSON' row, which duplicates the format contract test; drop its doc comment (TPP-045).

## `tests/config/cli/parsers/output/semgrep.ts`

- (the file) (file): **move** to `tests/config/semgrep.ts`. Test constants and sample text live in tests/config/&lt;topic&gt;.ts, and tests/config imports only tests/config.
- SEMGREP_MATCH (const exported, 2-7): **move** to `tests/config/semgrep.ts` `SEMGREP_MATCH`. Test data goes to tests/config/; drop its doc comment (TPP-045).
- SEMGREP_PARSE_ERROR (const exported, 9-15): **move** to `tests/config/semgrep.ts` `SEMGREP_PARSE_ERROR`. Test data goes to tests/config/; drop its doc comment (TPP-045).

## `tests/config/cli/parsers/pg.ts`

- (the file) (file): **delete**. TPP-013: its test goes with pg.test.ts.
- SQL_DECLARATION (const exported, 1-1): **delete**. TPP-013: used only by a deleted test.

## `tests/config/cli/parsers/settings.ts`

- (the file) (file): **delete**. The test of the setting-schema compiler goes (POL-001).
- RECORD_SETTING_DECLARATION (const exported, 2-7): **delete**. The test of the setting-schema compiler goes (POL-001).
- NUMBER_SETTING_DECLARATION (const exported, 10-16): **delete**. The test of the setting-schema compiler goes (POL-001).
- NATIVE_ITEM_DECLARATIONS (const exported, 18-37): **delete**. The test of the setting-schema compiler goes (POL-001).
- NATIVE_ITEM_DECLARATION (const exported, 39-44): **delete**. The test of the setting-schema compiler goes (POL-001).
- INVALID_NATIVE_ITEM_OWNERS (const exported, 46-46): **delete**. The test of the setting-schema compiler goes (POL-001).

## `tests/config/cli/parsers/statements.ts`

- (the file) (file): **move** to `tests/config/structure.ts`. Its test follows the trivial-functions check (S08-002), so the data goes to the structure topic file in tests/config/.
- TRIVIAL_FILES (const exported, 1-38): **move** to `tests/config/structure.ts` `TRIVIAL_FILES`. Test data goes to tests/config/; drop its doc comment (TPP-045).

## `tests/config/cli/parsers/swift.ts`

- (the file) (file): **move** to `tests/config/swift.ts`. Its one user joins the swift-tests check test (PAR-016, CKO-005); the data goes to the swift topic file in tests/config/.
- SWIFT_PACKAGE_COVERAGE_TARGETS (const exported, 1-18): **move** to `tests/config/swift.ts` `SWIFT_PACKAGE_COVERAGE_TARGETS`. Test data goes to tests/config/; drop its doc comment (TPP-045).
- SWIFT_PACKAGE_COVERAGE_FILES (const exported, 20-25): **move** to `tests/config/swift.ts` `SWIFT_PACKAGE_COVERAGE_FILES`. Test data goes to tests/config/; drop its doc comment (TPP-045).

## `tests/config/cli/parsers/tool.ts`

- (the file) (file): **move** to `tests/config/tools.ts`. Its one user is the version test (PAR-011); the data goes to tests/config/tools.ts (tool runs and versions) without the SpawnResult import, since tests/config imports only tests/config.
- VERSION_RESPONSE (const exported, 3-9): **move** to `tests/config/tools.ts` `VERSION_RESPONSE`. Test data goes to tests/config/; tests/config imports only tests/config, so it is written as const without the SpawnResult annotation, and the test that reads it checks the type.
- MISSING_TOOL_VERSION (const exported, 12-13): **move** to `tests/config/tools.ts` `MISSING_TOOL_VERSION`. Test data goes to tests/config/; drop its doc comment (TPP-045).

## `tests/config/cli/parsers/tree-sitter.ts`

- (the file) (file): **inline** to `tests/unit/cli/parsers/tree-sitter.test.ts`. Only TYPED_DECLARATION is left after TPP-041 and PAR-001, a single short literal used by one test file, so it stays there.
- TYPED_DECLARATION (const exported, 3-3): **move** to `tests/unit/cli/parsers/tree-sitter.test.ts` `TYPED_DECLARATION`. Used by the parse cache test (kept); a single short literal used by one test file, so it stays there.
- PYTHON_SOURCES (const exported, 6-11): **delete**. TTC-037 (unused export), TPP-041: its tests go.
- SWIFT_SOURCES (const exported, 14-19): **delete**. TTC-037, PAR-001: the Swift reader is dead.
- PARSER_OBSERVATIONS (const exported, 22-43): **delete**. Its two-language tests go (TPP-041, PAR-001).

## `tests/config/cli/policy/boundaries.ts`

- (the file) (file): **move** to `tests/config/settings/schema.ts`. One user is left after TPP-008; the settings data goes to the tests/config/settings/ folder, split by topic (about 600 lines).
- UNSAFE_DIRECTORIES (const exported, 2-11): **move** to `tests/config/settings/schema.ts` `UNSAFE_DIRECTORIES`. Used by the boundaries test (kept); test data goes to tests/config/; drop its doc comment.

## `tests/config/cli/policy/expiry.ts`

- (the file) (file): **split** to `tests/config/settings/schema.ts; tests/config/settings/file.ts`. The date cases go with the until date test to tests/config/settings/schema.ts, and the comment text, which the layout test uses, to tests/config/settings/file.ts.
- POLICY_EXPIRY_CASES (const exported, 4-33): **move** to `tests/config/settings/schema.ts` `UNTIL_DATE_CASES`. TPP-013 keeps one valid date and the not-a-date rows except 'offset timezone' (padding); "policy" goes (glossary); tests/config imports only tests/config, so it is written as const without the PolicyExpiryCase annotation, and the test checks the type.
- UNREPRESENTABLE_POLICY_COMMENT (const exported, 36-37): **move** to `tests/config/settings/file.ts` `INLINE_FIELD_COMMENT`. Used by the unwritable comment test; "policy" goes (glossary); its sample writes tools.&lt;tool&gt;.extra as { value = {...}, reason = "..." } (CFR-002); the data for writing gspot.toml lives in one file, tests/config/settings/file.ts.

## `tests/config/cli/policy/file.ts`

- (the file) (file): **move** to `tests/config/settings/file.ts`. Its test file splits by behavior, but all the data for writing gspot.toml goes to one file, tests/config/settings/file.ts, so the split becomes a move.
- POLICY_FILE_CASES (const exported, 4-172): **split** to `tests/config/settings/file.ts; tests/config/settings/file.ts; tests/config/settings/file.ts` `DEFAULT_CASES; COMMENT_CASES; LAYOUT_CASES`. Rows split by job into DEFAULT_CASES, COMMENT_CASES (provenance, prose before a deleted key, column gap, merged ignores, free prose, nested arrays, mixed array, inline field, same-date rows) and LAYOUT_CASES in tests/config/settings/file.ts, as multi-line TOML with an optional target and plain case names (TPP-029), written as const without the PolicyFileCase annotation; the sample text uses the final shape: no "omitted-default-removes-its-reason" or \[\[generated\]\] row, kept keys in place of exclude, push_files and runner, the schema line #:schema <<https://unpkg.com/@gspothq/cli@><version>/gspot.schema.json>, \[\[scope\]\], \[\[command_check\]\], allowed_words, extra and \[\[architecture.module\]\] with name, paths and may_import only (CFR-001, CFR-002, CFR-005, TMF-003, TML-002, INX-003).
- EMPTY_PROJECT_POLICY (const exported, 175-175): **delete**. Dead: used only by the deleted empty xcode.project test (TML-010).
- NATIVE_EDIT_POLICY (const exported, 178-179): **move** to `tests/config/settings/file.ts` `DATED_IGNORE`. Used by the two until-date edit tests; "native" and "policy" go (TTC-032); the data for writing gspot.toml lives in tests/config/settings/file.ts.

## `tests/config/cli/policy/key-paths.ts`

- (the file) (file): **move** to `tests/config/settings/errors.ts`. Test constants and sample text live in tests/config/&lt;topic&gt;.ts, and tests/config imports only tests/config.
- SEMANTIC_KEY_PATH_CASES (const exported, 2-10): **delete**. TPP-010: its one row joins the scoped ESLint off test.
- SCHEMA_KEY_PATH_CASES (const exported, 12-48): **move** to `tests/config/settings/errors.ts` `KEY_PATH_CASES`. Used by the key path test; one row stays, the multi-line array index (the nested-array row goes, since record lists are refused in a scope, CFR-004); drop its doc comment.

## `tests/config/cli/policy/public-shape.ts`

- (the file) (file): **delete**. Every item of the file is deleted (TPP-002, POL-024, CFR-003, TML-010).
- POLICY_PUBLIC_REFUSALS (const exported, 2-10): **delete**. TPP-002, TPP-003.
- PATH_SCOPE_CASES (const exported, 13-18): **delete**. Dead: used only by the deleted scope path test (CFR-003, TML-010).
- PATH_ORIGINS_POLICY (const exported, 20-39): **delete**. Dead: used only by the deleted scope path test (CFR-003, CFR-004, TML-001).
- NATIVE_PATH_POLICY (const exported, 41-55): **delete**. Dead: used only by the deleted scope path test (CFR-003, TML-010).
- EFFECTIVE_ARCHITECTURE_POLICY (const exported, 57-75): **delete**. POL-024: its test goes.

## `tests/config/cli/policy/read/commitlint.ts`

- (the file) (file): **merge** to `tests/config/settings/errors.ts`. Its one user joins the rule table test (TPP-006), so its rows join REFUSED_RULE_OPTIONS in tests/config/settings/errors.ts.
- COMMITLINT_REJECTED_SELECTIONS (const exported, 2-2): **merge** to `tests/config/settings/errors.ts` `REFUSED_RULE_OPTIONS`. TPP-006: rows of the one rule table; one row stays ('0'), since the other values fail the same tuple.

## `tests/config/cli/policy/read/recovery.ts`

- (the file) (file): **inline** to `tests/unit/cli/settings/errors/reasons.test.ts`. One user is left after POL-065, and its one case is a short literal written in the test.
- GOOD_IGNORE (const exported, 1-2): **delete**. TTC-037 (unused export); its case goes with POL-065.
- MISSING_REASON_CASES (const exported, 5-20): **inline** to `tests/unit/cli/settings/errors/reasons.test.ts` `a record without a reason is refused at its reason field`. POL-065: one case is left, a short literal written in the test.

## `tests/config/cli/policy/read/settings.ts`

- (the file) (file): **move** to `tests/config/settings/errors.ts`. DISABLED_RULES and UNKNOWN_KEY_CASES are its only surviving rows, and both go to tests/config/settings/errors.ts.
- DISABLED_RULES (const exported, 2-17): **merge** to `tests/config/settings/errors.ts` `REFUSED_RULE_OPTIONS`. TPP-006: rows of the one rule table, in tests/config/settings/errors.ts.
- INVALID_ENVIRONMENT_SETTINGS (const exported, 19-27): **delete**. Its test goes (restates the \[secrets\] schema).
- MALFORMED_REASON_CASES (const exported, 30-35): **delete**. Dead: used only by the deleted reason type test.
- REMOVED_STRUCTURE_SETTINGS (const exported, 38-38): **delete**. TPP-003.
- PATH_SETTINGS (const exported, 41-47): **delete**. Dead: used only by the deleted path settings test (TPP-008).
- UNKNOWN_KEY_CASES (const exported, 50-63): **move** to `tests/config/settings/errors.ts` `UNKNOWN_KEY_CASES`. TPP-002 keeps it, in tests/config/settings/errors.ts; the first case uses enabled = true as the valid sibling (push_files is deleted, TML-002), and scopes are \[\[scope\]\] records (CFR-003).

## `tests/config/cli/policy/read/tools.ts`

- (the file) (file): **merge** to `tests/config/settings/errors.ts`. One user (TPP-006); its rows join REFUSED_RULE_OPTIONS in tests/config/settings/errors.ts.
- ESLINT_REJECTED_SELECTIONS (const exported, 2-11): **merge** to `tests/config/settings/errors.ts` `REFUSED_RULE_OPTIONS`. TPP-006: rows of the one rule table; one row stays ('"error"'), since every severity fails the same eslintOptions union.
- MARKDOWNLINT_REJECTED_SELECTIONS (const exported, 14-22): **merge** to `tests/config/settings/errors.ts` `REFUSED_RULE_OPTIONS`. TPP-006 rows (TPP-005 deletes the copies in the schema cases); 'MD041 = true' (value branch) and 'default = {}' (key branch) stay.
- UNSUPPORTED_PYTHON_OPTIONS (const exported, 25-61): **delete**. TPP-004.

## `tests/config/cli/policy/read/yamllint.ts`

- (the file) (file): **merge** to `tests/config/settings/errors.ts`. One user (TPP-006); its rows join REFUSED_RULE_OPTIONS in tests/config/settings/errors.ts.
- REJECTED_YAML_OPTIONS (const exported, 2-11): **merge** to `tests/config/settings/errors.ts` `REFUSED_RULE_OPTIONS`. TPP-006: rows of the one rule table; 'truthy = true' and 'truthy = { ignore = "\*\*" }' stay.

## `tests/config/cli/policy/schema/cases.ts`

- (the file) (file): **move** to `tests/config/settings/schema.ts`. One user is left once fields.ts goes (TPP-039); the data goes to tests/config/settings/schema.ts without the RuntimeSchemaCase import, since tests/config imports only tests/config.
- SCHEMA_CHECK (const exported, 4-4): **move** to `tests/config/settings/schema.ts` `COMMAND_CHECK`. Used by the command rows of the agreement cases; glossary: command check; POL-007 adds name.
- RUNTIME_SCHEMA_CASES (const exported, 7-213): **move** to `tests/config/settings/schema.ts` `PUBLISHED_SCHEMA_CASES`. TPP-039 keeps rows for refined fields only (empty command, program and argument; format override without a setting; license exception with a range; SQLFluff dialect with a newline), and TPP-002, TPP-005, TPP-007, TPP-009 and TPP-016 delete the rest; the kept rows use \[\[command_check\]\] with name, \[\[format.override\]\] and \[\[licenses.allowed_package\]\] name and version (TML-009), the reasons rows go (CFR-002), and the value is written as const without the RuntimeSchemaCase annotation.
- LOCALE_SCHEMA_CASES (const exported, 216-273): **delete**. TPP-003, TPP-039, TPP-008, TPP-007: its test goes.
- OWN_RECORD_KEYS (const exported, 276-276): **delete**. TPP-040, ROOT-004.

## `tests/config/cli/policy/schema/exceptions.ts`

- (the file) (file): **merge** to `tests/config/settings/schema.ts`. TPP-002: only its two registry-host rows stay, and they join PUBLISHED_SCHEMA_CASES.
- EXCEPTION_SCHEMA_CASES (const exported, 4-132): **merge** to `tests/config/settings/schema.ts` `PUBLISHED_SCHEMA_CASES`. TPP-002 keeps only the two registry-host rows (TPP-009 deletes the word rows); they use dependencies.allowed_registries = { value = \[...\], reason = "..." } (CFR-002) and are written as const without the RuntimeSchemaCase annotation.

## `tests/config/cli/policy/schema/fields.ts`

- (the file) (file): **delete**. TPP-039.
- POLICY_FIELD_SCHEMA_CASES (const exported, 5-55): **delete**. TPP-039, TPP-003.

## `tests/config/cli/policy/schema/naming.ts`

- (the file) (file): **delete**. Every item of the file is deleted: TPP-039 keeps only its reserved-name rows, and naming.reserved goes (TML-005).
- NAMING_SCHEMA_CASES (const exported, 4-75): **delete**. The reserved naming rows were the only ones left, and naming.reserved goes (TML-005), and the names row goes with it.

## `tests/config/cli/policy/schema/tools.ts`

- (the file) (file): **merge** to `tests/config/settings/schema.ts`. TPP-039 keeps a few rows, which join PUBLISHED_SCHEMA_CASES.
- TOOL_SCHEMA_CASES (const exported, 4-137): **merge** to `tests/config/settings/schema.ts` `PUBLISHED_SCHEMA_CASES`. TPP-004 keeps one prettier accept row, written extra = { value = {...}, reason = "..." }, and one yamllint row that refuses extra, and deletes the lychee row; the knip workspace rows go, since ignore_dependencies is a plain list in the reason form and a scope replaces workspace (TMF-007); the value is written as const without the RuntimeSchemaCase annotation.
- TOOL_SCHEMA_SCOPES (const exported, 140-140): **delete**. TPP-007.
- VERBATIM_TOOL_NAMES (const exported, 143-151): **delete**. TPP-004: copies the source list.
- NO_VERBATIM_TOOL_NAMES (const exported, 154-164): **delete**. TPP-004: copies the source list.

## `tests/config/cli/policy/settings.ts`

- (the file) (file): **move** to `tests/config/settings/scopes.ts`. Test data goes to the tests/config/settings/ topic files; OPENAPI_DOCUMENTS goes as padding.
- POLICY (const exported, 1-33): **move** to `tests/config/settings/scopes.ts` `NESTED_SCOPE_SETTINGS`. Used by the scope view tests; POLICY says nothing and "policy" goes (glossary); the sample uses \[rules\] (TML-003), xcode.scheme, tools.swiftlint.always_keep_imports, limits.bash.file_lines in its one-language form (TML-007), and \[\[scope\]\] records with path and dotted keys (CFR-003).
- OPENAPI_DOCUMENTS (const exported, 35-35): **delete**. Dead: its OpenAPI detection test goes (TML-010), and it copies the source list of OpenAPI file names.
- OPENAPI_PATH_CASES (const exported, 37-53): **delete**. Dead: used only by the deleted OpenAPI path test (TML-010, CFR-003).

## `tests/config/cli/policy/templates-sources.ts`

- (the file) (file): **inline** to `tests/unit/cli/settings/templates.test.ts`. A single short literal used by one test file, so it stays there.
- TEMPLATE (const exported, 1-1): **move** to `tests/unit/cli/settings/templates.test.ts` `TEMPLATE`. One line, used by the source tests, so it stays in that file; the template text has no template = "house" or selection = "exact" (TML-011).

## `tests/types/cli/parsers.ts`

- (the file) (file): **delete**. Its types lose their users: the nginx test compares with toStrictEqual, and the observation tests go (PAR-001).
- DirectiveCase (type exported, 5-5): **delete**. Dead: the nginx test compares with toStrictEqual, so the type has no user.
- ParsedObservation (type exported, 8-8): **delete**. Dead: its two-language observation tests go (PAR-001).
- ObservationReader (type exported, 11-11): **delete**. Dead: its two-language observation tests go (PAR-001).
- ObservationCase (type exported, 14-20): **delete**. Dead: its two-language observation tests go (PAR-001).

## `tests/types/cli/policy/expiry.ts`

- (the file) (file): **delete**. TypeScript infers the row type of the as-const data, so the type has no user (TPP-022).
- PolicyExpiryCase (type exported, 2-5): **delete**. TypeScript infers the row type of the as-const data, so the type has no user (TPP-022).

## `tests/types/cli/policy/file.ts`

- (the file) (file): **delete**. The row type is inferred from the as-const data, and target becomes optional (TPP-022, TPP-029).
- PolicyFileCase (type exported, 2-2): **delete**. The row type is inferred from the as-const data (TPP-022, TPP-029).

## `tests/types/cli/policy/schema.ts`

- (the file) (file): **delete**. The row type is inferred from the as-const data, so the type has no user (TPP-022).
- RuntimeSchemaCase (type exported, 2-5): **delete**. The row type is inferred from the as-const data (TPP-022).
