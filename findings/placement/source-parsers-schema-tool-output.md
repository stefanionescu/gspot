# Source: parsers/schema, parsers/tool, parsers/output

222 rows. move 173, delete 33, inline 6, merge 6, rename 3, split 1.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `packages/cli/src/config/parsers/tool/format.ts`

- FORMAT_PROGRAMS (const exported, 2-5): **delete**. Delete (DEC-009): the Prettier child program and its protocol go, because init reads the JSON and INI files itself; the build entry, the knip entry and this path table go with it.
- FORMAT_RESULT (const exported, 8-8): **delete**. Delete (DEC-009): the Prettier child program and its protocol go, so there is no child output to frame.

## `packages/cli/src/config/parsers/tool/tool-file.ts`

- TOOL_FILE_FORMATS (const exported, 2-6): **inline** to `packages/cli/src/repository/tooling.ts` `parseSharedFile`. Inline into parseSharedFile (PAR-011): one user; the three extensions become the case labels of its one switch, so no table remains.

## `packages/cli/src/config/parsers/tool/version.ts`

- NO_VERSION (const exported, 2-2): **move** to `packages/cli/src/config/tools/run.ts` `NO_VERSION`. Moves to config/tools/run.ts with the tool run values (VERSION_FLAG): a static text value; tools/versions.ts imports it; PAR-069 moves the shim comment beside its test.
- VERSION_FLOOR (const exported, 5-5): **move** to `packages/cli/src/config/configurations.ts` `VERSION_FLOOR`. Moves to config/configurations.ts: a static regular expression; versionFloorSchema in configurations/schema/parts.ts imports it.

## `packages/cli/src/parsers/output/contracts.ts`

- markdownlintFinding (function, 19-41): **move** to `packages/cli/src/parsers/output/markdownlint.ts` `markdownlintFinding`. Moves to parsers/output/markdownlint.ts (PAR-014: one file per output format); PAR-017: drop the lines parameter and the range check.
- sourceLines (function, 44-63): **move** to `packages/cli/src/parsers/output/typos.ts` `sourceLines`. Moves to parsers/output/typos.ts (PAR-014; PAR-017): only typos still reads the source to turn byte offsets into columns.
- typoPosition (function, 66-82): **move** to `packages/cli/src/parsers/output/typos.ts` `typoPosition`. Moves to parsers/output/typos.ts (PAR-014; PAR-053): count code points with the shared codePointLength helper (one suppression).
- typoFinding (function, 85-104): **move** to `packages/cli/src/parsers/output/typos.ts` `typoFinding`. Moves to parsers/output/typos.ts (PAR-014): one file per output format.
- markdownlintFindings (function exported, 115-133): **move** to `packages/cli/src/parsers/output/markdownlint.ts` `markdownlintFindings`. Moves to parsers/output/markdownlint.ts (PAR-014): one file per output format; formats.ts imports it.
- typosFindings (function exported, 145-160): **move** to `packages/cli/src/parsers/output/typos.ts` `typosFindings`. Moves to parsers/output/typos.ts (PAR-014): one file per output format; formats.ts imports it.
- trufflehogFindings (function exported, 169-190): **move** to `packages/cli/src/parsers/output/trufflehog.ts` `trufflehogFindings`. Moves to parsers/output/trufflehog.ts (PAR-014): one file per output format; formats.ts imports it.
- parseAlerts (function exported, 197-207): **move** to `packages/cli/src/checks/general/prose.ts` `valeAlerts`. Moves to checks/general/prose.ts as valeAlerts (PAR-015): not an output format; one production caller, the Vale check (CKG-027 prose.ts); stop exporting; the integration tests read Vale findings through gspot check.

## `packages/cli/src/parsers/output/public.ts`

- compiled (function, 30-32): **delete**. Delete: a one-line forwarder to new RegExp; its three calls write new RegExp(output.pattern ?? DEFAULT_PATTERN, 'u') (and the file and grouped defaults) directly.
- positioned (function, 34-42): **move** to `packages/cli/src/parsers/output/text.ts` `positioned`. Moves to parsers/output/text.ts (PAR-014): text.ts holds the regex, grouped, and lines readers.
- splitTrailingRule (function, 44-52): **move** to `packages/cli/src/parsers/output/text.ts` `splitTrailingRule`. Moves to parsers/output/text.ts (PAR-014): text.ts holds the regex, grouped, and lines readers.
- isFixable (function, 54-58): **inline** to `packages/cli/src/parsers/output/text.ts` `regexFinding`. Inline into regexFinding: a two-line helper with one caller; regexFinding writes fixable: fixable?.test(line) ?? output.message !== undefined, with a comment above it that a fixed message means a fixable finding (PAR-077).
- regexFinding (function, 60-79): **move** to `packages/cli/src/parsers/output/text.ts` `regexFinding`. Moves to parsers/output/text.ts (PAR-014): text.ts holds the regex, grouped, and lines readers.
- parseRegex (function, 81-94): **move** to `packages/cli/src/parsers/output/text.ts` `parseRegex`. Moves to parsers/output/text.ts (PAR-014; PAR-061): the default pattern is filled once with the declaration; formats.ts imports it.
- parseGrouped (function, 96-114): **move** to `packages/cli/src/parsers/output/text.ts` `parseGrouped`. Moves to parsers/output/text.ts (PAR-014): text.ts holds the regex, grouped, and lines readers; formats.ts imports it.
- jsonFindings (function, 117-123): **merge** to `packages/cli/src/parsers/output/json.ts` `jsonFindings`. Merges into the JSON reader jsonFindings (PAR-014: one reader per format file): this GspotError wrapper joins it, as knipFindings and semgrepFindings already wrap their own errors.
- relativeTo (function, 125-138): **rename** to `packages/cli/src/parsers/output/formats.ts` `relativeTo`. Stays in public.ts, which is renamed formats.ts in place (PAR-007, PAR-014). Values to config: MISSING_PATH_CODES = \['ENOENT', 'ENOTDIR'\] -&gt; packages/cli/src/config/parsers/output.ts
- outputFormats (const exported, 141-223): **rename** to `packages/cli/src/parsers/output/formats.ts` `outputFormats`. Stays in public.ts, which is renamed formats.ts in place (PAR-007, PAR-014); PAR-060: one shared namesFiles function for regex and grouped, which reads FILE_GROUP; EXG-033: keep the TruffleHog flag, named redactsOutput. Values to config: FILE_GROUP = '(?&lt;file&gt;' -&gt; packages/cli/src/config/parsers/output.ts
- parseOutput (function exported, 233-244): **rename** to `packages/cli/src/parsers/output/formats.ts` `parseOutput`. Stays as parseOutput; its file becomes parsers/output/formats.ts (PAR-007; PAR-014): public.ts is renamed formats.ts in place; PAR-061: no default-format fallback here; EXG-031: CRLF converted once in runTool.

## `packages/cli/src/parsers/output/structured/contracts.ts`

- locationSchema (const, 3-7): **move** to `packages/cli/src/parsers/output/sarif.ts` `locationSchema`. Moves to parsers/output/sarif.ts (PAR-014): each format file holds its own schema.
- resultSchema (const, 9-29): **move** to `packages/cli/src/parsers/output/sarif.ts` `sarifResultSchema`. Moves to parsers/output/sarif.ts as sarifResultSchema (PAR-014; PAR-068): resultSchema names two things.
- runSchema (const, 31-50): **move** to `packages/cli/src/parsers/output/sarif.ts` `runSchema`. Moves to parsers/output/sarif.ts (PAR-014): each format file holds its own schema.
- positionSchema (const, 52-52): **move** to `packages/cli/src/parsers/output/semgrep.ts` `positionSchema`. Moves to parsers/output/semgrep.ts (PAR-014): each format file holds its own schema.
- sarifLogSchema (const exported, 55-55): **move** to `packages/cli/src/parsers/output/sarif.ts` `sarifLogSchema`. Moves to parsers/output/sarif.ts (PAR-014); it is written satisfies z.ZodType&lt;SarifLog&gt;, and SarifLog, SarifRun, SarifArtifactLocation and SarifPhysicalLocation are written by hand in types/parsers/output.ts; stop exporting.
- semgrepReportSchema (const exported, 57-75): **move** to `packages/cli/src/parsers/output/semgrep.ts` `semgrepReportSchema`. Moves to parsers/output/semgrep.ts (PAR-014); it is written satisfies z.ZodType&lt;SemgrepReport&gt;, and SemgrepReport is written by hand in types/parsers/output.ts; stop exporting.

## `packages/cli/src/parsers/output/structured/public.ts`

- indexedArtifact (function, 12-17): **move** to `packages/cli/src/parsers/output/sarif.ts` `indexedArtifact`. Moves to parsers/output/sarif.ts (PAR-014): SARIF reading in one file.
- sourceFile (function, 20-38): **move** to `packages/cli/src/parsers/output/sarif.ts` `sourceFile`. Moves to parsers/output/sarif.ts (PAR-014): SARIF reading in one file. Values to config: SARIF_SOURCE_ROOT = '%SRCROOT%' -&gt; packages/cli/src/config/parsers/output.ts
- placeOf (function, 47-56): **move** to `packages/cli/src/parsers/output/sarif.ts` `placeOf`. Moves to parsers/output/sarif.ts (PAR-014): SARIF reading in one file.
- listAt (function, 60-64): **move** to `packages/cli/src/parsers/output/json.ts` `listAt`. Moves to parsers/output/json.ts (PAR-014): JSON report reading in one file.
- chainsUnder (function, 67-71): **move** to `packages/cli/src/parsers/output/json.ts` `chainsUnder`. Moves to parsers/output/json.ts (PAR-014): JSON report reading in one file.
- setPosition (function, 74-77): **move** to `packages/cli/src/parsers/output/json.ts` `setPosition`. Moves to parsers/output/json.ts (PAR-014): JSON report reading in one file.
- jsonFinding (function, 79-118): **move** to `packages/cli/src/parsers/output/json.ts` `jsonFinding`. Moves to parsers/output/json.ts (PAR-014): JSON report reading in one file.
- sarifFindings (function exported, 128-161): **move** to `packages/cli/src/parsers/output/sarif.ts` `sarifFindings`. Moves to parsers/output/sarif.ts (PAR-014): one file per format; used by formats.ts and the CodeQL check (checks/general/security.ts).
- knipFindings (function exported, 170-203): **move** to `packages/cli/src/parsers/output/knip.ts` `knipFindings`. Moves to parsers/output/knip.ts (PAR-014): one file per format; formats.ts imports it.
- semgrepFindings (function exported, 212-246): **move** to `packages/cli/src/parsers/output/semgrep.ts` `semgrepFindings`. Moves to parsers/output/semgrep.ts (PAR-014: one file per format); formats.ts imports it. Values to config: SEMGREP_PARSE_ERRORS = \['ParseError', 'PartialParsing'\] -&gt; packages/cli/src/config/parsers/output.ts; SEMGREP_PARSE_RULE = 'parse-error' -&gt; packages/cli/src/config/parsers/output.ts
- parseJson (function exported, 257-266): **move** to `packages/cli/src/parsers/output/json.ts` `jsonFindings`. Moves to parsers/output/json.ts as jsonFindings (PAR-014), named like the other format readers; plain JSON reading is readJson in parsers/json.ts (PAR-040). Values to config: JSON_START = /\[\[{\]/u -&gt; packages/cli/src/config/parsers/output.ts

## `packages/cli/src/parsers/schema/ast-grep.ts`

- positionSchema (const, 3-3): **delete**. Delete (CKO-001): bash/function-size counts from the tree-sitter parse; ast-grep and its report schema go.
- matchSchema (const exported, 5-9): **delete**. Delete (CKO-001): ast-grep goes with AstGrepMatch.
- astGrepReportSchema (const exported, 11-11): **delete**. Delete (CKO-001): ast-grep goes; its only reader runAstGrep is deleted.

## `packages/cli/src/parsers/schema/codeql.ts`

- codeqlLanguagesSchema (const exported, 4-7): **move** to `packages/cli/src/checks/general/security.ts` `codeqlLanguagesSchema`. Moves to checks/general/security.ts (PAR-008): a report read by one check goes to that check; stop exporting.

## `packages/cli/src/parsers/schema/command.ts`

- checkStageSchema (const exported, 5-5): **move** to `packages/cli/src/configurations/schema/parts.ts` `checkStageSchema`. Moves to configurations/schema/parts.ts (PAR-009): the manifest schema, the settings schema and explain use it; the schema is z.enum(STAGES), and types/ derives the stage type from the list, because types/ may not import the schema. Values to config: STAGES = \['commit', 'push', 'manual', 'message'\] -&gt; packages/cli/src/config/configurations.ts
- findingExitCodesSchema (const exported, 7-7): **move** to `packages/cli/src/configurations/schema/parts.ts` `findingExitCodesSchema`. Moves to configurations/schema/parts.ts (PAR-009; PAR-028): shared by manifest checks and gspot.toml command checks.
- commandSchema (const exported, 10-14): **move** to `packages/cli/src/configurations/schema/parts.ts` `commandSchema`. Moves to configurations/schema/parts.ts (PAR-009): used by \[\[check\]\], the \[\[tool\]\] version_command, gspot.toml command checks and ci.setup_command (POL-054).

## `packages/cli/src/parsers/schema/configurations.ts`

- stringList (const, 25-25): **move** to `packages/cli/src/configurations/schema/manifest.ts` `optionalStringList`. Moves to configurations/schema/manifest.ts as optionalStringList (PAR-009; PAR-067): one local name meant two schemas (stringListOrEmpty holds a banned conjunction).
- filesSchema (const, 27-47): **move** to `packages/cli/src/configurations/schema/manifest.ts` `filesSchema`. Moves to configurations/schema/manifest.ts (PAR-009): the manifest schema leaves parsers/.
- selectorSchema (const, 50-58): **move** to `packages/cli/src/configurations/schema/manifest.ts` `selectorSchema`. Moves to configurations/schema/manifest.ts (PAR-009; CFL-006): one top-level eslint_selectors list uses it.
- pointerSchema (const, 60-75): **move** to `packages/cli/src/configurations/schema/manifest.ts` `pointerSchema`. Moves to configurations/schema/manifest.ts (PAR-009): the manifest schema leaves parsers/.
- consumerNamesSchema (const, 78-81): **move** to `packages/cli/src/configurations/schema/manifest.ts` `consumerNamesSchema`. Moves to configurations/schema/manifest.ts (PAR-009): the manifest schema leaves parsers/.
- toolFileSchema (const, 83-114): **move** to `packages/cli/src/configurations/schema/manifest.ts` `toolFileSchema`. Moves to configurations/schema/manifest.ts (PAR-009): the manifest schema leaves parsers/.
- sentence (const, 116-116): **move** to `packages/cli/src/configurations/schema/manifest.ts` `sentence`. Moves to configurations/schema/manifest.ts (PAR-009): the manifest schema leaves parsers/.
- stringListTable (const, 118-118): **delete**. Delete: required_eslint_rules leaves the manifests, and it was the only user.
- checkFields (const, 120-180): **split** to `packages/cli/src/configurations/schema/manifest.ts; packages/cli/src/configurations/schema/parts.ts` `checkFields; commandCheckFields`. Splits into checkFields and commandCheckFields (PAR-028, TML-004): the fields shared with gspot.toml command checks (command, stage, fix, exit_codes, output, summary and help) are declared once in parts.ts; finding_count_pattern leaves the shared fields (no shipped manifest sets it); crash_pattern, needs, ignore_file and the shipped check field operating_systems (glossary; the same word as ci.operating_systems) stay for shipped checks and are refused in gspot.toml command checks; PAR-026: crash_pattern uses regexSchema; PAR-071 decides the one-configuration fields. Values to config: NAME_PATTERN = /^\[a-z0-9-\]+$/u -&gt; packages/cli/src/config/configurations.ts; CHECK_NEEDS = \['build', 'docker', 'network'\] -&gt; packages/cli/src/config/configurations.ts
- checkSchema (const, 184-192): **move** to `packages/cli/src/configurations/schema/manifest.ts` `checkSchema`. Moves to configurations/schema/manifest.ts (PAR-009; PAR-029): tool is a string or a list, the table form and its four branches go; PAR-030: replaces becomes instead_of.
- manifestNamingOverride (const, 195-195): **move** to `packages/cli/src/configurations/schema/manifest.ts` `manifestNamingOverride`. Moves to configurations/schema/manifest.ts (PAR-009): the manifest schema leaves parsers/.
- settingSchema (const, 197-215): **merge** to `packages/cli/src/types/settings/tables.ts` `SettingDeclaration`. Merges into the SettingDeclaration type in types/settings/tables.ts (A9, POL-001): the \[\[setting\]\] tables leave the manifests, each setting is declared once in TypeScript in settings/schema/tables.ts, and a plain type lives in types/; its fields are name, type, path_role, default, default_all, reason_needed (raising, lowering or adding; a setting without it never needs a reason, POL-027), summary, languages, categories and off_values; rule-option tables never take a reason, and their entry-by-entry merge is the setting type rule-options; the unions are as const lists in config/settings/values.ts (SETTING_TYPES, PATH_ROLES, REASON_NEEDED).
- isIgnoredPath (function, 218-225): **delete**. Delete (GEN-008): the manifest ignored field and its only validator go.
- detectionSchema (const, 227-239): **move** to `packages/cli/src/configurations/schema/manifest.ts` `detectionSchema`. Moves to configurations/schema/manifest.ts (PAR-009; PAR-026): content values use regexSchema.
- manifestSchema (const exported, 242-331): **move** to `packages/cli/src/configurations/schema/manifest.ts` `manifestSchema`. Moves to configurations/schema/manifest.ts (PAR-009): only configurations reads it, and the 300-line limit splits configurations/schema into manifest, tool, naming and parts; A9: the setting field goes; set_all goes; the group field is z.enum(GROUPS) with GROUPS as const in config/configurations.ts, the group type in types/ is (typeof GROUPS)\[number\], and GROUP_LABELS is keyed by GROUPS (z.enum over table keys gives string); the manifest key products becomes allowed_words in the schema and in every manifest that sets it (one name with the gspot.toml key). Values to config: GROUP_LABELS = the group-to-label table (database, framework, general, infrastructure, language, library, platform, testing; glossary group names and labels, NMU-009), keyed by GROUPS -&gt; packages/cli/src/config/configurations.ts; NAME_PATTERN (shared with checkFields) -&gt; packages/cli/src/config/configurations.ts; RULE_FILE_PATTERN = /^\[A-Z0-9-\]+\\.md$/u (the keys of the rules table) -&gt; packages/cli/src/config/rules.ts

## `packages/cli/src/parsers/schema/contracts.ts`

- outputSchema (const exported, 9-57): **move** to `packages/cli/src/parsers/output/formats.ts` `outputSchema`. Moves to parsers/output/formats.ts (PAR-008; PAR-009): the output readers need its type and parsers may not import configurations; configurations and settings import it.
- findingSchema (const exported, 59-68): **delete**. Delete (PAR-006): only z.infer uses it; Finding becomes a plain type.
- resultSchema (const exported, 70-84): **delete**. Delete (PAR-006): only z.infer uses it; CheckResult and CheckStatus become plain types.
- markdownlintReportSchema (const exported, 86-98): **move** to `packages/cli/src/parsers/output/markdownlint.ts` `markdownlintReportSchema`. Moves to parsers/output/markdownlint.ts (PAR-014): each format file holds its own schema; stop exporting.
- trufflehogResultSchema (const exported, 100-104): **move** to `packages/cli/src/parsers/output/trufflehog.ts` `trufflehogResultSchema`. Moves to parsers/output/trufflehog.ts (PAR-014): each format file holds its own schema; stop exporting.
- historyMetadataSchema (const exported, 106-109): **move** to `packages/cli/src/parsers/output/trufflehog.ts` `historyMetadataSchema`. Moves to parsers/output/trufflehog.ts (PAR-014): each format file holds its own schema; stop exporting.
- typosEntrySchema (const exported, 111-118): **move** to `packages/cli/src/parsers/output/typos.ts` `typosEntrySchema`. Moves to parsers/output/typos.ts (PAR-014): each format file holds its own schema; stop exporting.
- knipSymbolSchema (const exported, 120-128): **move** to `packages/cli/src/parsers/output/knip.ts` `knipSymbolSchema`. Moves to parsers/output/knip.ts (PAR-014; PAR-048): stop exporting.
- knipReportSchema (const exported, 130-154): **move** to `packages/cli/src/parsers/output/knip.ts` `knipReportSchema`. Moves to parsers/output/knip.ts: the schema is a written object shape checked with satisfies SchemaShape&lt;KnipReport&gt;, and KNIP_ISSUE_MESSAGES is keyed by the same as const list (PAR-025); it is no longer exported (PAR-014).
- alertsSchema (const exported, 156-166): **move** to `packages/cli/src/checks/general/prose.ts` `valeReportSchema`. Moves to checks/general/prose.ts as valeReportSchema (PAR-015): goes with the Vale reader into the Vale check; stop exporting.
- levelSchema (const exported, 169-169): **move** to `packages/cli/src/configurations/schema/parts.ts` `levelSchema`. Moves to configurations/schema/parts.ts (PAR-010): the manifest, conditions and settings use it; the schema is z.enum(LEVELS), and types/ derives Level from the list, because types/ may not import the schema. Values to config: LEVELS = \['recommended', 'all'\] -&gt; packages/cli/src/config/configurations.ts
- operatingSystemSchema (const exported, 172-172): **move** to `packages/cli/src/configurations/schema/parts.ts` `operatingSystemSchema`. Moves to configurations/schema/parts.ts (PAR-010): manifest checks and settings use it; TML-004, TML-014: its gspot.toml user is ci.operating_systems only, because command checks have no operating system field.
- runnerSchema (const exported, 175-175): **delete**. Delete (INX-003): no runner setting is left to validate; the word list stays as RUNNER_NAMES in config/repository/tooling.ts, read by isLintCommand, the docs check and the RUNNERS keys; types/ writes (typeof RUNNER_NAMES)\[number\] where a type is needed. Values to config: RUNNER_NAMES = \[...NPM_CLIENTS, 'mise'\] as const -&gt; packages/cli/src/config/repository/tooling.ts
- settingValidationSchema (const exported, 178-198): **delete**. Delete (POL-001): validation leaves manifest \[\[setting\]\]; its regular expression check becomes regexSchema (PAR-026).
- settingPrimitiveSchema (const exported, 201-201): **delete**. Delete (POL-001): the setting type mini-language and its compiler go.
- settingTypeSchema (const exported, 204-204): **delete**. Delete (POL-001): a setting type comes from its zod schema; declarationOf narrows the JSON Schema type with a plain switch.
- settingFieldOptionsSchema (const exported, 207-210): **delete**. Delete (POL-001): the setting type mini-language goes.
- settingFieldSchema (const exported, 213-219): **delete**. Delete (POL-001): the setting type mini-language goes.
- settingFieldsSchema (const exported, 222-225): **delete**. Delete (POL-001): the setting type mini-language goes.
- settingItemsSchema (const exported, 228-228): **delete**. Delete (POL-001): declarationOf builds items from the zod schema; a plain type replaces the parse.
- settingValueDeclarationSchema (const exported, 231-238): **merge** to `packages/cli/src/types/settings/tables.ts` `SettingDeclaration`. Merges into the SettingDeclaration type in types/settings/tables.ts (A9, POL-001): declarations are TypeScript in settings/schema/tables.ts, a plain type lives in types/, and default and default_all are fields of the type, which declarationOf fills from the zod schema; no items field, because set writes no record lists.
- ruleSettingsSchema (const exported, 241-241): **move** to `packages/cli/src/ownership/log-schema.ts` `capturedLintRulesSchema`. Moves to ownership/log-schema.ts as capturedLintRulesSchema (PAR-008): ownership is the lowest folder that uses it (the log field lintRules), and collectLintRules in generation imports it; glossary: "rules" means only the Markdown files, so these lint rule values are named for lint rules (type CapturedLintRules, compareLintRules; LIF-010).
- conditionSchema (const exported, 246-257): **move** to `packages/cli/src/configurations/schema/parts.ts` `conditionSchema`. Moves to configurations/schema/parts.ts (PAR-009): used by the manifest and \[\[tool\]\] schemas.

## `packages/cli/src/parsers/schema/docker.ts`

- imageReportSchema (const exported, 4-23): **move** to `packages/cli/src/checks/infrastructure/docker.ts` `imageReportSchema`. Moves to checks/infrastructure/docker.ts (PAR-008): a report read by one check; CKO-005 and glossary group infrastructure; stop exporting.
- composeSchema (const exported, 25-43): **move** to `packages/cli/src/checks/infrastructure/docker.ts` `composeSchema`. Moves to checks/infrastructure/docker.ts (PAR-008): read by one check; ComposeService is written by hand in types/checks/infrastructure.ts, and this schema is checked with satisfies; stop exporting.

## `packages/cli/src/parsers/schema/duplication.ts`

- clonePlaceSchema (const, 4-8): **move** to `packages/cli/src/checks/general/duplication.ts` `clonePlaceSchema`. Moves to checks/general/duplication.ts (PAR-008; CKG-027): the jscpd check file.
- cloneReportSchema (const exported, 10-15): **move** to `packages/cli/src/checks/general/duplication.ts` `cloneReportSchema`. Moves to checks/general/duplication.ts (PAR-008; CKG-027; PAR-027): the percentage schema is written inline; stop exporting.

## `packages/cli/src/parsers/schema/format.ts`

- formatConfigurationSchema (const exported, 5-12): **move** to `packages/cli/src/commands/init/format.ts` `formatOptionsSchema`. Moves to commands/init/format.ts as formatOptionsSchema (Prettier calls these options; glossary: configuration means a selectable unit): DEC-009 keeps it as the schema of the JSON Prettier files (.prettierrc, .prettierrc.json, the prettier key of package.json) that readFormatOptions reads; drop .nullable(), which only served the child program.

## `packages/cli/src/parsers/schema/git.ts`

- gitEntrySchema (const exported, 4-8): **move** to `packages/cli/src/parsers/git.ts` `gitEntrySchema`. Moves to parsers/git.ts, the file that reads it (PAR-008); GitEntry is written by hand in types/parsers/git.ts, and this schema is checked with satisfies; GIT_ENTRY_MODES is built from GITLINK_MODE, SYMLINK_MODE and the FILE_MODES keys of config/repository/revisions.ts, which repeat the same strings, and types/execution/copy.ts derives the mode type from it; stop exporting. Values to config: GIT_ENTRY_MODES = \['100644', '100755', '120000', '160000'\] -&gt; packages/cli/src/config/repository/revisions.ts

## `packages/cli/src/parsers/schema/inventory.ts`

- fileKindSchema (const exported, 4-4): **move** to `packages/cli/src/configurations/schema/parts.ts` `fileKindSchema`. Moves to configurations/schema/parts.ts (PAR-010): manifest files.kinds and repository use it; lowest folder is configurations.
- generatedSchema (const exported, 7-11): **delete**. Delete (CFR-005): \[\[generated\]\] leaves gspot.toml; the configuration declarations are built in code with no schema.
- vendoredSchema (const exported, 13-16): **delete**. Delete (CFR-005): \[\[vendored\]\] leaves gspot.toml.

## `packages/cli/src/parsers/schema/licenses.ts`

- licenseSchema (const, 3-3): **move** to `packages/cli/src/checks/general/licenses.ts` `licenseSchema`. Moves to checks/general/licenses.ts (PAR-008): a report read by one check.
- reportSchema (const exported, 5-5): **move** to `packages/cli/src/checks/general/licenses.ts` `javascriptReportSchema`. Moves to checks/general/licenses.ts as javascriptReportSchema (PAR-008): a report read by one check; the name pairs with pythonReportSchema and javascriptLicenses; stop exporting.
- pythonReportSchema (const exported, 7-9): **move** to `packages/cli/src/checks/general/licenses.ts` `pythonReportSchema`. Moves to checks/general/licenses.ts (PAR-008): a report read by one check; stop exporting.
- packageIdentitySchema (const exported, 12-14): **delete**. Delete (TML-009): an allowed package is a record with name and version fields, so no name@version string is split.
- licenseExceptionSchema (const exported, 17-20): **move** to `packages/cli/src/settings/schema/tables.ts` `allowedPackageSchema`. Moves to settings/schema/tables.ts as allowedPackageSchema (glossary: allowed package); TML-009, TMF: the record \[\[licenses.allowed_package\]\] has name, version and reason (no license or packages field); stop exporting (PAR-048).
- allowlistSchema (const exported, 22-25): **move** to `packages/cli/src/settings/schema/tables.ts` `licensesSchema`. Moves to settings/schema/tables.ts as licensesSchema (POL-001: the \[licenses\] table schema written out by hand); TML-009, CFR-004: fields allowed and the root-only record list allowed_package.

## `packages/cli/src/parsers/schema/lockfiles.ts`

- devDependenciesSchema (const, 4-4): **move** to `packages/cli/src/tools/npm/lockfiles.ts` `devDependenciesSchema`. Moves to tools/npm/lockfiles.ts beside rootLockfileDependencies, its one reader, which moves there (PAR-085: lockfile schemas beside the lockfile reader).
- npmLockfileSchema (const exported, 6-6): **move** to `packages/cli/src/tools/npm/lockfiles.ts` `npmLockfileSchema`. Moves to tools/npm/lockfiles.ts beside rootLockfileDependencies, its one reader, which moves there (PAR-085); stop exporting.
- bunLockfileSchema (const exported, 7-7): **move** to `packages/cli/src/tools/npm/lockfiles.ts` `bunLockfileSchema`. Moves to tools/npm/lockfiles.ts beside rootLockfileDependencies, its one reader, which moves there (PAR-085); stop exporting.
- pnpmLockfileSchema (const exported, 8-10): **move** to `packages/cli/src/tools/npm/lockfiles.ts` `pnpmLockfileSchema`. Moves to tools/npm/lockfiles.ts beside rootLockfileDependencies, its one reader, which moves there (PAR-085); PAR-044: one schema with optional devDependencies specifiers; stop exporting.
- pnpmSpecifiersSchema (const exported, 11-11): **merge** to `packages/cli/src/tools/npm/lockfiles.ts` `pnpmLockfileSchema`. Moves to tools/npm/lockfiles.ts beside rootLockfileDependencies, its one reader, which moves there; PAR-044: the second parse step throws without dev dependencies.
- yarnLockfileSchema (const exported, 12-15): **move** to `packages/cli/src/tools/npm/lockfiles.ts` `yarnLockfileSchema`. Moves to tools/npm/lockfiles.ts (PAR-008): the schema goes to the file that reads it (registry URL removal); stop exporting.
- bunPackagesSchema (const exported, 16-16): **move** to `packages/cli/src/tools/npm/lockfiles.ts` `bunPackagesSchema`. Moves to tools/npm/lockfiles.ts (PAR-008): the schema goes to the file that reads it; stop exporting.
- bunPackageSchema (const exported, 17-17): **move** to `packages/cli/src/tools/npm/lockfiles.ts` `bunPackageSchema`. Moves to tools/npm/lockfiles.ts, the file that reads it (PAR-008); BunPackage is written by hand in types/tools/project.ts, and this schema is checked with satisfies; stop exporting.

## `packages/cli/src/parsers/schema/mise.ts`

- miseToolsSchema (const exported, 3-3): **delete**. Delete (INX-007): its one reader parseMiseToolKeys goes with the duplicate-pin detection.
- miseTasksSchema (const exported, 5-5): **move** to `packages/cli/src/parsers/mise.ts` `miseTasksSchema`. Moves to parsers/mise.ts (PAR-008): the schema goes to the file that reads it; stop exporting.
- miseTaskAliasSchema (const exported, 6-6): **move** to `packages/cli/src/parsers/mise.ts` `miseTaskAliasSchema`. Moves to parsers/mise.ts (PAR-008): the schema goes to the file that reads it; stop exporting.

## `packages/cli/src/parsers/schema/naming.ts`

- identifierCategory (const, 4-4): **move** to `packages/cli/src/configurations/schema/naming.ts` `identifierCategory`. Moves to configurations/schema/naming.ts (PAR-009); it is z.enum(NAMING_CATEGORIES), an as const list of the category keys in config/checks/general/naming.ts that CATEGORY_LABELS (in the same config file) is keyed by, because z.enum over table keys gives string.
- reservedCategories (const, 6-9): **move** to `packages/cli/src/configurations/schema/naming.ts` `reservedCategories`. Moves to configurations/schema/naming.ts (PAR-009), exported for namingLists in settings/schema/tables.ts; TML-005: the gspot.toml naming.reserved map is deleted, and the shipped naming defaults keep their reserved table, its user.
- namingGroupSchema (const, 11-11): **move** to `packages/cli/src/configurations/schema/naming.ts` `namingGroupSchema`. Moves to configurations/schema/naming.ts (PAR-009): part of the naming defaults schema.
- namingOverrideSchema (const exported, 14-25): **move** to `packages/cli/src/configurations/schema/naming.ts` `namingOverrideSchema`. Moves to configurations/schema/naming.ts (PAR-009): the manifest, the naming defaults and gspot.toml naming use it; TML-005, TMF-005, TMF: names is deleted, allowed is allowed_names, case is cases, and paths is optional; the gspot.toml record extends it with a required reason; the manifests and the naming defaults use the same keys.
- pathContainerSchema (const exported, 28-32): **move** to `packages/cli/src/configurations/schema/parts.ts` `pathContainerSchema`. Moves to configurations/schema/parts.ts (PAR-009: the manifest naming field); PathContainer is written by hand in types/checks/general.ts, and its category field uses the naming category list.
- namingLists (const exported, 35-40): **move** to `packages/cli/src/settings/schema/tables.ts` `namingLists`. Moves to settings/schema/tables.ts (POL-001: the gspot.toml \[naming\] lists are a settings table); TML-005, TMF: banned is banned_words, allowed and reserved are deleted, and overrides is the root-only record list naming.override.
- shippedNamingSchema (const exported, 43-59): **move** to `packages/cli/src/configurations/schema/naming.ts` `namingDefaultsSchema`. Moves to configurations/schema/naming.ts as namingDefaultsSchema (PAR-009; CFG-035): naming/defaults.json; CFG-011: drop version and matching.

## `packages/cli/src/parsers/schema/primitives.ts`

- percentageSchema (const exported, 5-5): **inline** to `packages/cli/src/checks/general/duplication.ts` `cloneReportSchema`. Inline into cloneReportSchema in checks/general/duplication.ts (PAR-027): one user and a false comment; primitives.ts goes.

## `packages/cli/src/parsers/schema/public.ts`

- installerDefinition (const, 13-13): **move** to `packages/cli/src/configurations/schema/tool.ts` `installerDefinition`. Moves to configurations/schema/tool.ts (PAR-009): the \[\[tool\]\] schema leaves parsers/.
- installerSchema (const, 15-15): **move** to `packages/cli/src/configurations/schema/tool.ts` `installerSchema`. Moves to configurations/schema/tool.ts (PAR-009): the \[\[tool\]\] schema leaves parsers/.
- installerOptionsSchema (const, 17-17): **move** to `packages/cli/src/configurations/schema/tool.ts` `installerOptionsSchema`. Moves to configurations/schema/tool.ts (PAR-009): the \[\[tool\]\] schema leaves parsers/.
- installerConstraintsSchema (const, 19-19): **move** to `packages/cli/src/configurations/schema/tool.ts` `installerConstraintsSchema`. Moves to configurations/schema/tool.ts (PAR-009): the \[\[tool\]\] schema leaves parsers/. Values to config: PYPI_CONSTRAINT = /^\[a-z0-9.\_-\]+(?:\[&lt;&gt;!~=\]=|\[&lt;&gt;\])\[a-z0-9.\*+!\_-\]+$/iu -&gt; packages/cli/src/config/configurations.ts
- miseInstallerSchema (const, 22-25): **move** to `packages/cli/src/configurations/schema/tool.ts` `miseInstallerSchema`. Moves to configurations/schema/tool.ts (PAR-009): the \[\[tool\]\] schema leaves parsers/.
- pypiInstallerSchema (const, 29-34): **move** to `packages/cli/src/configurations/schema/tool.ts` `pypiInstallerSchema`. Moves to configurations/schema/tool.ts (PAR-009): the \[\[tool\]\] schema leaves parsers/.
- installerFields (const, 36-46): **move** to `packages/cli/src/configurations/schema/tool.ts` `installerFields`. Moves to configurations/schema/tool.ts (PAR-009): the \[\[tool\]\] schema leaves parsers/.
- toolConditionSchema (const, 48-48): **move** to `packages/cli/src/configurations/schema/tool.ts` `toolConditionSchema`. Moves to configurations/schema/tool.ts (PAR-009): the \[\[tool\]\] schema leaves parsers/.
- suppressionPattern (const, 50-60): **move** to `packages/cli/src/configurations/schema/parts.ts` `regexSchema`. Moves to configurations/schema/parts.ts as regexSchema (PAR-026): one regular-expression schema with one message for suppression, crash_pattern (tool and check), diagnostic_header_pattern, and detect.content.
- requirementSchema (const, 62-62): **move** to `packages/cli/src/tools/python/project.ts` `requirementSchema`. Moves to tools/python/project.ts (PAR-042): goes with the uv.lock schema.
- replacementSchema (const, 64-69): **move** to `packages/cli/src/configurations/schema/tool.ts` `replacementSchema`. Moves to configurations/schema/tool.ts (PAR-009; PAR-030): replace is the one key for replaced files.
- installerPinSchema (const exported, 72-75): **delete**. Delete (PAR-006): only z.infer uses it; InstallerPin becomes a plain type.
- versionFloorSchema (const exported, 78-88): **move** to `packages/cli/src/configurations/schema/parts.ts` `versionFloorSchema`. Moves to configurations/schema/parts.ts (PAR-009): used by \[\[tool\]\] min_version and \[\[check\]\] min_versions.
- toolSchema (const exported, 90-205): **move** to `packages/cli/src/configurations/schema/tool.ts` `toolSchema`. Moves to configurations/schema/tool.ts (PAR-009); PAR-030: replaces goes; NMS-026: kind binary becomes program; the glossary renames the \[\[tool\]\] key platforms to builds (the OS and CPU builds a tool ships); ToolDeclaration is written by hand in types/configurations.ts, and toolSchema is checked with satisfies; TOOL_BUILDS is derived only from config; EXTENSION_PATTERN serves prettier.extensions and eslint.extensions. Values to config: TOOL_BUILDS = OPERATING_SYSTEMS.flatMap((system) =&gt; \[system.name, system.name + '-x64', system.name + '-arm64'\]) -&gt; packages/cli/src/config/configurations.ts; EXTENSION_PATTERN = /^\\.\[a-z0-9\]+$/u -&gt; packages/cli/src/config/configurations.ts
- toolDeclarationSchema (const exported, 208-211): **move** to `packages/cli/src/configurations/schema/tool.ts` `toolDeclarationSchema`. Moves to configurations/schema/tool.ts (PAR-009): the manifest schema imports it.
- typeScriptConfigSchema (const exported, 213-213): **move** to `packages/cli/src/parsers/tsconfig.ts` `typeScriptConfigSchema`. Moves to parsers/tsconfig.ts (PAR-022): TypeScript project reading in one file; stop exporting.
- pythonToolProjectSchema (const exported, 215-225): **delete**. Delete (SLF-030): gspot parses the pyproject.toml it generated without a schema; parse returns the parsed project, and its shape becomes a plain type.
- lockfileSchema (const exported, 227-241): **move** to `packages/cli/src/tools/python/project.ts` `uvLockSchema`. Moves to tools/python/project.ts as uvLockSchema (PAR-042): the shape is uv.lock; its only reader is the uv.lock match check; stop exporting.
- uvProjectSettingsSchema (const exported, 243-245): **move** to `packages/cli/src/tools/python/settings.ts` `uvProjectSettingsSchema`. Moves to tools/python/settings.ts (PAR-008): the schema goes to the file that reads it (uv index settings); stop exporting.
- uvFindLinksSchema (const exported, 247-247): **inline** to `packages/cli/src/tools/python/settings.ts` `parsePythonSettings`. Inline into parsePythonSettings in tools/python/settings.ts; z.array(z.string()) used once (as PAR-073).
- uvIndexSchema (const exported, 249-249): **move** to `packages/cli/src/tools/python/settings.ts` `uvIndexSchema`. Moves to tools/python/settings.ts (PAR-008): the schema goes to the file that reads it; stop exporting.
- uvIndexesSchema (const exported, 251-251): **inline** to `packages/cli/src/tools/python/settings.ts` `parsePythonSettings`. Inline into parsePythonSettings in tools/python/settings.ts; z.array(uvIndexSchema) used once (as PAR-073).
- eslintAllRulesSchema (const exported, 254-254): **move** to `packages/cli/src/configurations/schema/manifest.ts` `eslintAllRulesSchema`. Moves to configurations/schema/manifest.ts; PAR-009; PAR-031 keeps it in the CLI; only the manifest schema uses it; stop exporting.
- eslintRuleNamesSchema (const exported, 257-262): **move** to `packages/cli/src/generation/tool-file-sources/stylelint.ts` `ruleNamesFileSchema`. Moves to generation/tool-file-sources/stylelint.ts as ruleNamesFileSchema: the Stylelint builder is its one reader once the ESLint rule-name reader goes (PLG-049); one schema for the rule-name file shape (PAR-024).
- eslintRuleModuleSchema (const exported, 265-265): **move** to `scripts/update-rule-lists.ts` `eslintRuleModuleSchema`. Moves to scripts/update-rule-lists.ts (PAR-031, ROOT-019): only the rule-list script uses it.
- eslintPresetBlockSchema (const exported, 268-274): **move** to `packages/cli/src/configurations/schema/manifest.ts` `eslintPresetBlockSchema`. Moves to configurations/schema/manifest.ts (PAR-048): stop exporting; goes with eslintPresetSchema.
- eslintPresetSchema (const exported, 277-282): **move** to `packages/cli/src/configurations/schema/manifest.ts` `eslintPresetSchema`. Moves to configurations/schema/manifest.ts (PAR-009; PAR-031): lowest folder of the manifest eslint_presets field, generation, and the rule-list script.
- eslintPresetsSchema (const exported, 284-284): **move** to `packages/cli/src/generation/eslint/presets.ts` `eslintPresetsSchema`. Moves to generation/eslint/presets.ts (PAR-031): one production reader, readPresets; EslintPresets is written by hand in types/generation/eslint.ts, and this schema is checked with satisfies; stop exporting.
- eslintModuleSchema (const exported, 286-286): **move** to `scripts/update-rule-lists.ts` `eslintModuleSchema`. Moves to scripts/update-rule-lists.ts (PAR-031; ROOT-019): only the rule-list script uses it.
- eslintGlobalsSchema (const exported, 289-289): **move** to `scripts/update-rule-lists.ts` `eslintGlobalsSchema`. Moves to scripts/update-rule-lists.ts (PAR-031; ROOT-019): only the rule-list script uses it; stop exporting.
- captureEslintPreset (function exported, 299-326): **move** to `scripts/update-rule-lists.ts` `captureEslintPreset`. Moves into scripts/update-rule-lists.ts, its one user (PAR-031, ROOT-019); stop exporting, and the tests of scripts/ go. Values to config: PRESET_BLOCK_KEYS = \['files', 'ignores', 'basePath', 'rules'\] -&gt; scripts/config/rule-lists.ts

## `packages/cli/src/parsers/schema/python/dependencies.ts`

- deptrySchema (const exported, 3-9): **move** to `packages/cli/src/checks/language/python/deptry.ts` `deptrySchema`. Moves to checks/language/python/deptry.ts (PAR-072): the schema goes into its check; schema/python/ goes; stop exporting.

## `packages/cli/src/parsers/schema/python/docstrings.ts`

- docstringStyleSchema (const exported, 3-21): **move** to `packages/cli/src/checks/language/python/pydoclint.ts` `docstringStyleSchema`. Moves to checks/language/python/pydoclint.ts (PAR-072; CKO-004): the pydoclint code leaves language/public.ts; stop exporting.

## `packages/cli/src/parsers/schema/python/imports.ts`

- importLinterSchema (const exported, 3-5): **move** to `packages/cli/src/checks/language/python/import-linter.ts` `importLinterSchema`. Moves to checks/language/python/import-linter.ts (PAR-072; CKO-018): python/imports.ts becomes import-linter.ts; stop exporting.

## `packages/cli/src/parsers/schema/repository.ts`

- workspacePatternsSchema (const exported, 4-6): **delete**. Delete (S07-002): dead: workspacePackages parses with it and throws the result away, then @manypkg/tools reads pnpm-workspace.yaml and lerna.json itself; the last reader of the parsed patterns is gone, and the code checks the real package paths instead.
- rushProjectsSchema (const exported, 8-10): **delete**. Delete (S07-002): dead: the same discarded parse as workspacePatternsSchema; @manypkg/tools RushTool reads rush.json projects itself.

## `packages/cli/src/parsers/schema/site.ts`

- linkinatorRequestSchema (const exported, 4-9): **move** to `packages/cli/src/checks/framework/site/linkinator-program.ts` `linkinatorRequestSchema`. Moves to checks/framework/site/linkinator-program.ts; PAR-008 (child program messages go into the child); CKG-029; CKG-008 keeps the program; stop exporting.
- linkinatorReportSchema (const exported, 12-21): **move** to `packages/cli/src/checks/framework/site/built-pages.ts` `linkinatorReportSchema`. Moves to checks/framework/site/built-pages.ts (PAR-008; CKG-029): the linkinator check is in built-pages.ts; stop exporting.
- htmlValidationReportSchema (const exported, 24-29): **move** to `packages/cli/src/checks/framework/site/built-pages.ts` `htmlValidationReportSchema`. Moves to checks/framework/site/built-pages.ts (PAR-008; CKG-029): the htmlValidate check is in built-pages.ts; stop exporting.
- purgecssReportSchema (const exported, 32-32): **move** to `packages/cli/src/checks/framework/site/built-pages.ts` `purgecssReportSchema`. Moves to checks/framework/site/built-pages.ts (PAR-008; CKG-029): the purgecss check is in built-pages.ts; stop exporting.
- webManifestSchema (const exported, 35-38): **move** to `packages/cli/src/checks/framework/site/source-files.ts` `webManifestSchema`. Moves to checks/framework/site/source-files.ts (PAR-008; CKG-029): the webManifest check is in source-files.ts; stop exporting.
- purgecssRequestSchema (const exported, 41-44): **move** to `packages/cli/src/checks/framework/site/purgecss-program.ts` `purgecssRequestSchema`. Moves to checks/framework/site/purgecss-program.ts; PAR-008 (child program messages go into the child); CKG-029; stop exporting.

## `packages/cli/src/parsers/schema/stylelint.ts`

- stylelintRuleNamesSchema (const exported, 6-11): **merge** to `packages/cli/src/generation/tool-file-sources/stylelint.ts` `ruleNamesFileSchema`. Merges into ruleNamesFileSchema in generation/tool-file-sources/stylelint.ts: the same rule-name file shape (PAR-024).
- stylelintModuleSchema (const exported, 14-21): **move** to `scripts/update-rule-lists.ts` `stylelintModuleSchema`. Moves to scripts/update-rule-lists.ts (PAR-031; ROOT-019): only the rule-list script uses it.
- stylelintConfigSchema (const exported, 24-24): **move** to `scripts/update-rule-lists.ts` `stylelintConfigSchema`. Moves to scripts/update-rule-lists.ts (PAR-031; ROOT-019): only the rule-list script uses it.

## `packages/cli/src/parsers/schema/supabase.ts`

- supabaseProjectSchema (const exported, 4-7): **move** to `packages/cli/src/checks/platform/supabase.ts` `supabaseProjectSchema`. Moves to checks/platform/supabase.ts (PAR-008): read by one check; CKO-004 (platform/public.ts becomes supabase.ts); stop exporting.
- denoLintReportSchema (const exported, 9-19): **move** to `packages/cli/src/checks/platform/supabase.ts` `denoLintReportSchema`. Moves to checks/platform/supabase.ts (PAR-008): a report read by one check; CKO-004; stop exporting.

## `packages/cli/src/parsers/schema/svelte.ts`

- svelteFailureSchema (const exported, 3-3): **inline** to `packages/cli/src/checks/framework/svelte.ts` `svelteFindings`. Inline into svelteFindings in checks/framework/svelte.ts (PAR-073): a named z.string() adds nothing.
- diagnosticSchema (const exported, 5-11): **move** to `packages/cli/src/checks/framework/svelte.ts` `diagnosticSchema`. Moves to checks/framework/svelte.ts; PAR-073; CKO-004 (framework/contracts.ts becomes svelte.ts); svelte-check calls these diagnostics; stop exporting.

## `packages/cli/src/parsers/schema/swift-coverage.ts`

- swiftPackageCoverageSchema (const exported, 4-14): **move** to `packages/cli/src/checks/testing/swift-tests.ts` `swiftPackageCoverageSchema`. Moves to checks/testing/swift-tests.ts (PAR-016): Swift coverage in one file; CKO-005: the coverage code joins the swift-tests check (glossary group testing).
- swiftCoverageSchema (const exported, 17-33): **move** to `packages/cli/src/checks/testing/swift-tests.ts` `swiftCoverageSchema`. Moves to checks/testing/swift-tests.ts (PAR-016; CKO-005).

## `packages/cli/src/parsers/schema/xcode.ts`

- itemSchema (const, 3-26): **move** to `packages/cli/src/parsers/xcode.ts` `itemSchema`. Moves to parsers/xcode.ts (PAR-011): the Xcode project reader stays in the parser layer as parsers/xcode.ts.
- pbxprojSchema (const exported, 28-28): **move** to `packages/cli/src/parsers/xcode.ts` `pbxprojSchema`. Moves to parsers/xcode.ts (PAR-008; PAR-011): beside the project reader; stop exporting.
- testPlanSchema (const exported, 31-40): **move** to `packages/cli/src/checks/infrastructure/xcode/project.ts` `testPlanSchema`. Moves to checks/infrastructure/xcode/project.ts (PAR-008): read by one check; CKO-005; stop exporting.
- stringsFileSchema (const exported, 43-54): **move** to `packages/cli/src/checks/infrastructure/xcode/resources.ts` `stringsFileSchema`. Moves to checks/infrastructure/xcode/resources.ts (PAR-008): read by one check; CKO-005; stop exporting.
- assetContentsSchema (const exported, 57-59): **move** to `packages/cli/src/checks/infrastructure/xcode/resources.ts` `assetContentsSchema`. Moves to checks/infrastructure/xcode/resources.ts (PAR-008): read by one check; CKO-005; stop exporting.

## `packages/cli/src/parsers/schema/xctest.ts`

- xccovSchema (const exported, 3-5): **move** to `packages/cli/src/checks/testing/swift-tests.ts` `xccovSchema`. Moves to checks/testing/swift-tests.ts (PAR-016; CKO-005): the coverage code joins the swift-tests check.

## `packages/cli/src/parsers/schema/yarn.ts`

- yarnConnectionSettingsSchema (const exported, 4-4): **move** to `packages/cli/src/tools/npm/yarn.ts` `yarnConnectionSettingsSchema`. Moves to tools/npm/yarn.ts beside yarnSettings, its one reader (PAR-008), so parsers/schema/ keeps no Yarn file; S05-012 keeps yarnSettings, which writes only ${GSPOT\_...} references and reads the Yarn settings with this schema; PAR-073.
- yarnConfigEntrySchema (const exported, 6-6): **move** to `packages/cli/src/tools/npm/yarn.ts` `yarnConfigEntrySchema`. Moves to tools/npm/yarn.ts beside yarnSettings, its one reader (PAR-008); S05-012 keeps it with yarnSettings.
- yarnSettingSchema (const exported, 8-8): **move** to `packages/cli/src/tools/npm/yarn.ts` `yarnSettingSchema`. Moves to tools/npm/yarn.ts beside yarnSettings, its one reader (PAR-008); S05-012 keeps it with yarnSettings; PAR-073.

## `packages/cli/src/parsers/tool/contracts.ts`

- quotedEnd (function, 22-28): **merge** to `packages/cli/src/parsers/comments.ts` `quotedEnd`. Merges into quotedEnd in parsers/comments.ts (PAR-039): keep one quotedEnd; nginx scanning uses the comment scanner one (it returns the index past the quote, so scanAt drops its +1; an unclosed quote then ends at the text end, which nginx -t rejects anyway).
- protectedUnitEnd (function, 31-37): **move** to `packages/cli/src/checks/infrastructure/nginx.ts` `protectedUnitEnd`. Moves to checks/infrastructure/nginx.ts (PAR-011; PAR-083): the nginx tokenizer goes to its one check (checks/tool/public.ts becomes infrastructure/nginx.ts, CKO-004).
- unitEnd (function, 40-44): **move** to `packages/cli/src/checks/infrastructure/nginx.ts` `unitEnd`. Moves to checks/infrastructure/nginx.ts (PAR-011; PAR-083).
- wordEnd (function, 47-56): **move** to `packages/cli/src/checks/infrastructure/nginx.ts` `wordEnd`. Moves to checks/infrastructure/nginx.ts (PAR-011; PAR-083).
- commentAt (function, 59-63): **move** to `packages/cli/src/checks/infrastructure/nginx.ts` `nginxComment`. Moves to checks/infrastructure/nginx.ts as nginxComment (PAR-011; PAR-039): commentAt means another thing in parsers/comments.ts.
- scanAt (function, 66-73): **move** to `packages/cli/src/checks/infrastructure/nginx.ts` `scanAt`. Moves to checks/infrastructure/nginx.ts (PAR-011; PAR-083).
- tokenize (function, 76-85): **move** to `packages/cli/src/checks/infrastructure/nginx.ts` `tokenize`. Moves to checks/infrastructure/nginx.ts (PAR-011; PAR-083).
- parseToolFile (function, 87-107): **move** to `packages/cli/src/repository/tooling.ts` `parseSharedFile`. Moves to repository/tooling.ts as parseSharedFile (PAR-011): tool-file sections go to the tooling survey; glossary: a tool file is a file gspot writes, this reads the user shared file; PAR-040: its JSON branch uses readJson.
- hasKeyPath (function, 109-116): **delete**. Delete (PAR-019): valueAt(parsed, parts) !== undefined gives the same answer.
- parseHeader (function, 118-125): **delete**. Delete (PAR-018; PAR-064): hasIniSection tests each line with one regular expression.
- parsedVersion (function, 127-131): **move** to `packages/cli/src/tools/versions.ts` `parsedVersion`. Moves to tools/versions.ts (PAR-011): version-output parsing goes to tools/ (ARC tree tools/versions.ts).
- versionFailure (function, 133-147): **move** to `packages/cli/src/tools/versions.ts` `versionFailure`. Moves to tools/versions.ts (PAR-011; PAR-069): the shim comment moves here.
- parseDirectives (function exported, 154-181): **move** to `packages/cli/src/checks/infrastructure/nginx.ts` `parseDirectives`. Moves to checks/infrastructure/nginx.ts (PAR-011, PAR-083): one caller, the nginx check; stop exporting; ESCAPED_CHARACTER sits beside NGINX_ESCAPES. Values to config: QUOTED_ARGUMENT = /^(\["'\])(\[\\s\\S\]\*)\\1$/u -&gt; packages/cli/src/config/checks/infrastructure/nginx.ts; ESCAPED_CHARACTER = /\\\\(\[trn"'\\\\\])/gu -&gt; packages/cli/src/config/checks/infrastructure/nginx.ts
- hasToolSection (function exported, 190-200): **move** to `packages/cli/src/repository/tooling.ts` `hasToolSection`. Moves to repository/tooling.ts (PAR-011): one caller, the tooling survey; stop exporting. Values to config: INI_EXTENSIONS = \['.ini', '.cfg'\] -&gt; packages/cli/src/config/repository/tooling.ts
- getIniSection (function exported, 208-221): **move** to `packages/cli/src/repository/tooling.ts` `hasIniSection`. Moves to repository/tooling.ts as hasIniSection (PAR-018): both callers only test for the section, so it returns a boolean, and the pattern is built with RegExp.escape(section), so a dot or bracket in a section name matches only itself; repository is the lowest folder of the tooling survey and the import-linter check.
- parseVersionOutput (function exported, 230-240): **move** to `packages/cli/src/tools/versions.ts` `parseVersionOutput`. Moves to tools/versions.ts (PAR-011): only tools/ calls it.

## `packages/cli/src/parsers/tool/format.ts`

- file (const, 7-7): **delete**. Delete (DEC-009): the Prettier child program and its protocol go, because init reads the JSON and INI files itself.
- configuration (const, 9-9): **delete**. Delete (DEC-009): the Prettier child program and its protocol go, because init reads the JSON and INI files itself.
- usesPrettier (const, 10-10): **delete**. Delete (DEC-009): the Prettier child program and its protocol go; readFormatOptions keeps the rule that a Prettier file or a prettier dependency means the project uses Prettier.
- options (const, 11-11): **delete**. Delete (DEC-009): the Prettier child program and its protocol go, because init reads the JSON and INI files itself.
- defaults (const, 13-13): **delete**. Delete (DEC-009): the Prettier child program and its protocol go; Prettier's three defaults become PRETTIER_DEFAULTS in config/commands/init.ts.

## `packages/cli/src/parsers/tool/public.ts`

- projectItem (function, 33-37): **move** to `packages/cli/src/parsers/xcode.ts` `projectItem`. Moves to parsers/xcode.ts (PAR-011; PAR-059): testTargets uses it too.
- parentGroups (function, 40-49): **move** to `packages/cli/src/parsers/xcode.ts` `parentGroups`. Moves to parsers/xcode.ts (PAR-011): Xcode project reading in parsers/xcode.ts.
- groupBase (function, 52-57): **move** to `packages/cli/src/parsers/xcode.ts` `groupBase`. Moves to parsers/xcode.ts (PAR-011): Xcode project reading in parsers/xcode.ts.
- treeBase (function, 60-65): **move** to `packages/cli/src/parsers/xcode.ts` `treeBase`. Moves to parsers/xcode.ts (PAR-011): Xcode project reading in parsers/xcode.ts.
- projectPath (function, 68-77): **move** to `packages/cli/src/parsers/xcode.ts` `projectPath`. Moves to parsers/xcode.ts (PAR-011): Xcode project reading in parsers/xcode.ts.
- targetSources (function, 80-91): **move** to `packages/cli/src/parsers/xcode.ts` `targetSources`. Moves to parsers/xcode.ts (PAR-011): Xcode project reading in parsers/xcode.ts.
- targetFolders (function, 94-104): **move** to `packages/cli/src/parsers/xcode.ts` `targetFolders`. Moves to parsers/xcode.ts (PAR-011): Xcode project reading in parsers/xcode.ts.
- readProject (function, 107-112): **move** to `packages/cli/src/parsers/xcode.ts` `readProject`. Moves to parsers/xcode.ts (PAR-011; PAR-059): parsePbxproj and testTargets call it.
- contentLines (function, 114-119): **move** to `packages/cli/src/checks/platform/cloudflare.ts` `contentLines`. Moves to checks/platform/cloudflare.ts (PAR-011): its two callers move into the Cloudflare check; PAR-037: NumberedLine {number, text}.
- isBlockEnd (function, 122-126): **move** to `packages/cli/src/checks/framework/expo.ts` `isBlockEnd`. Moves to checks/framework/expo.ts with parseExpoDoctor (PAR-011). Values to config: BLOCK_END_PREFIXES = \['Advice:', '✔ ', '✖ '\] -&gt; packages/cli/src/config/checks/framework/expo.ts
- propertyName (function, 129-133): **move** to `packages/cli/src/checks/framework/nextjs.ts` `propertyName`. Moves to checks/framework/nextjs.ts (PAR-011; PAR-012): goes with nextSettingsFindings.
- literalValue (function, 136-146): **move** to `packages/cli/src/checks/framework/nextjs.ts` `literalValue`. Moves to checks/framework/nextjs.ts (PAR-011; PAR-012): goes with nextSettingsFindings.
- readPbxproj (function exported, 154-175): **move** to `packages/cli/src/parsers/xcode.ts` `parsePbxproj`. Moves to parsers/xcode.ts as parsePbxproj (PAR-059): it reads no file and calls readProject; PAR-011.
- testTargets (function exported, 182-192): **move** to `packages/cli/src/parsers/xcode.ts` `testTargets`. Moves to parsers/xcode.ts (PAR-011): Xcode project reading stays together; PAR-059: it uses projectItem. Values to config: TEST_PRODUCT_TYPE = /^com\\.apple\\.product-type\\.bundle\\.(?:unit-test|ui-testing)$/u -&gt; packages/cli/src/config/parsers/xcode.ts
- projectBuildSettings (function exported, 199-206): **move** to `packages/cli/src/parsers/xcode.ts` `projectBuildSettings`. Moves to parsers/xcode.ts (PAR-011): init and generation (readSwiftVersion) also call it, and generation may not import checks.
- parseWrangler (function exported, 214-224): **move** to `packages/cli/src/checks/platform/cloudflare.ts` `parseWrangler`. Moves to checks/platform/cloudflare.ts (PAR-011): one caller; PAR-036: returns Parsed&lt;T&gt;; stop exporting.
- parseHeaders (function exported, 231-259): **move** to `packages/cli/src/checks/platform/cloudflare.ts` `parseHeadersFile`. Moves to checks/platform/cloudflare.ts as parseHeadersFile (PAR-011, PAR-012; PAR-064: parseHeader and parseHeaders are unrelated); stop exporting; SOURCE_PREFIXES is shared with redirectFindings. Values to config: SOURCE_PREFIXES = \['/', 'https://'\] -&gt; packages/cli/src/config/checks/platform/cloudflare.ts (shared with redirectFindings); DETACH_PREFIX = '! ' -&gt; packages/cli/src/config/checks/platform/cloudflare.ts
- redirectFindings (function exported, 266-281): **move** to `packages/cli/src/checks/platform/cloudflare.ts` `redirectFindings`. Moves to checks/platform/cloudflare.ts (PAR-011, PAR-012): check logic goes into the check; stop exporting; it shares SOURCE_PREFIXES with parseHeadersFile.
- parseExpoDoctor (function exported, 288-300): **move** to `packages/cli/src/checks/framework/expo.ts` `parseExpoDoctor`. Moves to checks/framework/expo.ts (PAR-011): one caller; stop exporting.
- nextSettingsFindings (function exported, 308-339): **move** to `packages/cli/src/checks/framework/nextjs.ts` `nextSettingsFindings`. Moves to checks/framework/nextjs.ts (PAR-011; PAR-012; PAR-021): one caller, the Next.js check (framework/public.ts becomes nextjs.ts, CKO-004); stop exporting.
- readFormatConfiguration (function exported, 347-362): **move** to `packages/cli/src/commands/init/format.ts` `readFormatOptions`. Moves to commands/init/format.ts as readFormatOptions (Prettier calls these options; glossary: configuration means a selectable unit); DEC-009: no child process and no prettier runtime dependency: it reads .editorconfig with a small INI parse and the JSON Prettier files with formatOptionsSchema, and a JavaScript Prettier config keeps Prettier's own defaults. Values to config: PRETTIER_FILES = \['.prettierrc', '.prettierrc.json'\] -&gt; packages/cli/src/config/commands/init.ts; EDITORCONFIG_FILE = '.editorconfig' -&gt; packages/cli/src/config/commands/init.ts; PRETTIER_DEFAULTS = { tabWidth: 2, printWidth: 80, singleQuote: false } -&gt; packages/cli/src/config/commands/init.ts
