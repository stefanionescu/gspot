# Source: the other parsers

504 rows. move 299, keep 97, rename 49, delete 46, merge 9, inline 4.

Decisions: keep, rename, move, merge (joins the target name), inline (into its one caller), delete, split.
Each item reads: name (kind, lines): decision, target file and name, reason.

## `packages/cli/src/config/parsers/attributes.ts`

- ATTRIBUTE_FIELDS (const exported, 1-1): **move** to `packages/cli/src/config/parsers/git.ts` `ATTRIBUTE_FIELDS`. Moves to config/parsers/git.ts, which holds every Git value, the .gitattributes readers included (they join parsers/git.ts); the one-line config/parsers/attributes.ts goes; one user, gitAttributes.

## `packages/cli/src/config/parsers/bash.ts`

- DECLARATION_WORDS (const exported, 2-2): **move** to `packages/cli/src/config/checks/language/bash.ts` `DECLARATION_WORDS`. Moves to config/checks/language/bash.ts with the Bash check values: withoutDeclaration moves to its one caller, the Bash script-layout check (S08-003).
- ALL_POSITIONAL_PARAMETERS (const exported, 5-5): **keep** to `packages/cli/src/config/parsers/bash.ts` `ALL_POSITIONAL_PARAMETERS`. Stays in config/parsers/bash.ts; one user, highestRead.
- LOCAL_DECLARATION_WORDS (const exported, 8-8): **keep** to `packages/cli/src/config/parsers/bash.ts` `LOCAL_DECLARATION_WORDS`. Stays in config/parsers/bash.ts; one user, localNames.

## `packages/cli/src/config/parsers/cloudflare.ts`

- HTTP_HEADER_LINE (const exported, 1-1): **move** to `packages/cli/src/config/checks/platform/cloudflare.ts` `HTTP_HEADER_LINE`. Moves to config/checks/platform/cloudflare.ts with the Cloudflare check values: the \_headers reader moves into the Cloudflare check (PAR-011).
- STATUS_CODES (const exported, 3-3): **move** to `packages/cli/src/config/checks/platform/cloudflare.ts` `REDIRECT_STATUS_CODES`. Moves to config/checks/platform/cloudflare.ts as REDIRECT_STATUS_CODES, named for which status codes, beside REQUIRED_HEADERS and WRANGLER_FIELDS (S08-005): the \_redirects reader moves into the Cloudflare check (PAR-011).
- REDIRECT_PARTS (const exported, 5-5): **move** to `packages/cli/src/config/checks/platform/cloudflare.ts` `REDIRECT_PARTS`. Moves to config/checks/platform/cloudflare.ts with the Cloudflare check values: the \_redirects reader moves into the Cloudflare check (PAR-011).

## `packages/cli/src/config/parsers/comments.ts`

- SCSS_COMMENT_OPENERS (const exported, 4-4): **keep** to `packages/cli/src/config/parsers/comments.ts` `SCSS_COMMENT_OPENERS`. Stays in config/parsers/comments.ts with the other comment-reader values (PAR-007); one user, scssComments.
- TOML_TOKENS (const exported, 7-7): **delete**. Delete (PAR-051): TOML comments come from the TOML parser gspot already uses, not a regex.

## `packages/cli/src/config/parsers/docker.ts`

- TRIVY_SCHEMA_VERSION (const exported, 2-2): **move** to `packages/cli/src/config/checks/infrastructure/docker.ts` `TRIVY_SCHEMA_VERSION`. Moves to config/checks/infrastructure/docker.ts with the Docker check values: the Trivy report schema goes into its one check (PAR-008), and the Docker check is in the infrastructure group (CKO-005, NMU-009).
- DOCKERFILE_NAME (const exported, 4-4): **move** to `packages/cli/src/config/repository/inventory.ts` `DOCKERFILE_NAME`. Moves to config/repository/inventory.ts: one value, one place, so the Dockerfile name sits with the other file names and tags (PAR-074).

## `packages/cli/src/config/parsers/expo.ts`

- FAILED_CHECK (const exported, 2-2): **move** to `packages/cli/src/config/checks/framework/expo.ts` `FAILED_CHECK`. Moves to the new config/checks/framework/expo.ts with the Expo check values: the Expo Doctor reader moves into the Expo check (PAR-011).
- PASSED_CHECKS (const exported, 5-5): **move** to `packages/cli/src/config/checks/framework/expo.ts` `PASSED_CHECKS`. Moves to the new config/checks/framework/expo.ts with the Expo check values: the Expo Doctor reader moves into the Expo check (PAR-011).

## `packages/cli/src/config/parsers/generated-header.ts`

- JSON_HEADER (const exported, 1-1): **delete**. Delete (GEN-017): generated JSON files lose the \_gspot key, so its detection goes; EXG-048; EXG-048.
- GENERATED_HEADER_LINE (const exported, 3-3): **move** to `packages/cli/src/config/generation/headers.ts` `GENERATED_HEADER_LINE`. Moves to config/generation/headers.ts: the generated header is one topic, the writer's comment styles and the reader's match (EXG-048); GEN-017: match the new header text without a version.
- HEADER_LINES_CHECKED (const exported, 5-5): **move** to `packages/cli/src/config/generation/headers.ts` `HEADER_LINES_CHECKED`. Moves to config/generation/headers.ts: the generated header is one topic, the writer's comment styles and the reader's match (EXG-048).
- GENERATED_JSON_KEY (const exported, 7-7): **delete**. Delete (GEN-017): the \_gspot JSON key is no longer written; EXG-048.

## `packages/cli/src/config/parsers/git.ts`

- CONFLICT_MARKER_SOURCE (const, 2-2): **inline** to `packages/cli/src/config/apply.ts` `CONFLICT_MARKERS`. Inline into CONFLICT_MARKERS in config/apply.ts: LIF-034 deletes CONFLICT_MARKER_PREFIX, so the shared source string has one user left.
- UNSUPPORTED_ENTRY (const exported, 4-5): **keep** to `packages/cli/src/config/parsers/git.ts` `UNSUPPORTED_ENTRY`. Stays in config/parsers/git.ts (PAR-007); one user, the Git listing parser.
- HASH_SOURCE (const exported, 8-8): **keep** to `packages/cli/src/config/parsers/git.ts` `HASH_SOURCE`. Stays in config/parsers/git.ts; users are the Git regexes and the secrets check (CHANGE_LINE).
- HASH_PATTERN (const exported, 10-10): **keep** to `packages/cli/src/config/parsers/git.ts` `HASH_PATTERN`. Stays in config/parsers/git.ts; users are repository/revisions and the TruffleHog history schema.
- BLOB_HEADER (const exported, 12-12): **keep** to `packages/cli/src/config/parsers/git.ts` `BLOB_HEADER`. Stays in config/parsers/git.ts; one user, blobSize.
- INDEX_ENTRY (const exported, 14-17): **keep** to `packages/cli/src/config/parsers/git.ts` `INDEX_ENTRY`. Stays in config/parsers/git.ts; one user, parseIndexEntries.
- TREE_ENTRY (const exported, 19-22): **keep** to `packages/cli/src/config/parsers/git.ts` `TREE_ENTRY`. Stays in config/parsers/git.ts; one user, parseTreeEntries.
- CONFLICT_MARKER_PREFIX (const exported, 24-24): **delete**. Delete (LIF-034): a lockfile with conflict markers already fails to parse and counts as no match.
- CONFLICT_MARKERS (const exported, 26-26): **move** to `packages/cli/src/config/apply.ts` `CONFLICT_MARKERS`. Moves to config/apply.ts with the apply values (PAR-074): its users are conflictedOutputs in apply/write.ts and the stale whole-file check in apply/stale.ts.

## `packages/cli/src/config/parsers/inventory.ts`

- FILE_KINDS (const exported, 2-2): **move** to `packages/cli/src/config/repository/inventory.ts` `FILE_KINDS`. Moves to config/repository/inventory.ts: file kinds are repository inventory values; FileKind is (typeof FILE_KINDS)\[number\] in types/repository/inventory.ts, and fileKindSchema = z.enum(FILE_KINDS) stays a schema in configurations/schema/parts.ts (PAR-010); config/parsers/inventory.ts is deleted.

## `packages/cli/src/config/parsers/lockfiles.ts`

- LOCKFILES (const exported, 2-60): **keep** to `packages/cli/src/config/parsers/lockfiles.ts` `LOCKFILES`. Stays in config/parsers/lockfiles.ts (PAR-085): seven importers; rewrite the first comment; CKG-014 adds the stale pattern; rename the field snapshot (banned term) to copied; drop the field parsed with parseLockfile (PAR-085); keep client (NMS-009: manager is banned); INX-003: the runner field of each entry goes with detectRunner, its only reader.

## `packages/cli/src/config/parsers/markdown.ts`

- TRAILING_PUNCTUATION (const exported, 3-3): **move** to `packages/cli/src/config/checks/general/docs.ts` `TRAILING_PUNCTUATION`. Moves to config/checks/general/docs.ts with the docs check values: pathTokens moves to the docs check, its only user (PAR-012).
- PATH_CHARS (const exported, 5-5): **move** to `packages/cli/src/config/checks/general/docs.ts` `PATH_CHARS`. Moves to config/checks/general/docs.ts with the docs check values: pathTokens moves to the docs check, its only user (PAR-012).
- TOKEN_SEPARATORS (const exported, 7-7): **move** to `packages/cli/src/config/checks/general/docs.ts` `TOKEN_SEPARATORS`. Moves to config/checks/general/docs.ts with the docs check values: pathTokens moves to the docs check, its only user (PAR-012).
- COMMAND_FENCES (const exported, 9-9): **move** to `packages/cli/src/config/checks/general/docs.ts` `COMMAND_FENCES`. Moves to config/checks/general/docs.ts with the docs check values: proseLines moves to the docs check, its only user (PAR-012).
- PATH_TOKEN_SKIPS (const exported, 11-11): **move** to `packages/cli/src/config/checks/general/docs.ts` `PATH_TOKEN_SKIPS`. Moves to config/checks/general/docs.ts with the docs check values: pathTokens moves to the docs check, its only user (PAR-012).
- ELLIPSIS_LINE (const exported, 13-13): **move** to `packages/cli/src/config/checks/language/markdown.ts` `ELLIPSIS_LINE`. Moves to the new config/checks/language/markdown.ts with the Markdown fence check values: the fence syntax reader moves to its one caller, the Markdown check.
- ELLIPSIS_ARGUMENTS (const exported, 15-15): **move** to `packages/cli/src/config/checks/language/markdown.ts` `ELLIPSIS_ARGUMENTS`. Moves to the new config/checks/language/markdown.ts with the Markdown fence check values: the fence syntax reader moves to its one caller, the Markdown check.
- ANGLE_PLACEHOLDER (const exported, 17-17): **move** to `packages/cli/src/config/checks/language/markdown.ts` `ANGLE_PLACEHOLDER`. Moves to the new config/checks/language/markdown.ts with the Markdown fence check values: the fence syntax reader moves to its one caller, the Markdown check.
- FENCE_PARSERS (const exported, 19-38): **move** to `packages/cli/src/config/checks/language/markdown.ts` `FENCE_PARSERS`. Moves to the new config/checks/language/markdown.ts with the Markdown fence check values; the table is written as const without the FenceParser annotation, and FenceParser is derived from it in types/checks/language.ts, because config/ may not import types/.
- BASH_ERROR_LINE (const exported, 41-41): **delete**. Delete (PAR-046): Bash fences use tree-sitter like the other languages, so no bash -n output is read.

## `packages/cli/src/config/parsers/naming.ts`

- CATEGORY_LABELS (const exported, 1-25): **move** to `packages/cli/src/config/checks/general/naming.ts` `CATEGORY_LABELS`. Moves to config/checks/general/naming.ts beside CATEGORY_PARENTS (PAR-013) and CASE_NAMES (POL-021); it is keyed by NAME_CATEGORIES, the as const list of the 23 categories in the same file, with which the naming schemas check categories (POL-021); the naming schema imports both from config/, which every layer may import; it is written as const without the Record&lt;string, string&gt; annotation. Values to config: NAME_CATEGORIES = the 23 category names (schemas, tables, ... path_parameters) as const -&gt; packages/cli/src/config/checks/general/naming.ts.
- PYTHON_PARAMETER_NODES (const exported, 27-32): **move** to `packages/cli/src/config/checks/general/naming.ts` `PYTHON_PARAMETER_NODES`. Moves to config/checks/general/naming.ts with the naming check values: the Python name extractor moves flat into checks/general/naming/ (PAR-013).
- SPLAT_NODES (const exported, 34-34): **move** to `packages/cli/src/config/checks/general/naming.ts` `PYTHON_SPLAT_NODES`. Moves to config/checks/general/naming.ts as PYTHON_SPLAT_NODES: the language prefix keeps the name clear in a file that holds all four languages (S08-005); the Python name extractor moves flat into checks/general/naming/ (PAR-013).
- IMPLICIT_PARAMETERS (const exported, 36-36): **move** to `packages/cli/src/config/checks/general/naming.ts` `PYTHON_IMPLICIT_PARAMETERS`. Moves to config/checks/general/naming.ts as PYTHON_IMPLICIT_PARAMETERS: the language prefix keeps the name clear in a file that holds all four languages (S08-005); the Python name extractor moves flat into checks/general/naming/ (PAR-013).
- PYTHON_CONSTANT (const exported, 38-38): **move** to `packages/cli/src/config/checks/general/naming.ts` `PYTHON_CONSTANT`. Moves to config/checks/general/naming.ts with the naming check values: the Python name extractor moves flat into checks/general/naming/ (PAR-013).
- EXCEPTION_BASE (const exported, 40-40): **move** to `packages/cli/src/config/checks/general/naming.ts` `PYTHON_EXCEPTION_BASE`. Moves to config/checks/general/naming.ts as PYTHON_EXCEPTION_BASE: the language prefix keeps the name clear in a file that holds all four languages (S08-005); the Python name extractor moves flat into checks/general/naming/ (PAR-013).
- SWIFT_TYPE_NODES (const exported, 42-42): **move** to `packages/cli/src/config/checks/general/naming.ts` `SWIFT_TYPE_NODES`. Moves to config/checks/general/naming.ts with the naming check values: the Swift name extractor moves flat into checks/general/naming/ (PAR-013).
- SWIFT_FUNCTION_NODES (const exported, 44-44): **move** to `packages/cli/src/config/checks/general/naming.ts` `SWIFT_FUNCTION_NODES`. Moves to config/checks/general/naming.ts with the naming check values: the Swift name extractor moves flat into checks/general/naming/ (PAR-013).
- MEMBER_PARENTS (const exported, 46-46): **move** to `packages/cli/src/config/checks/general/naming.ts` `SWIFT_MEMBER_PARENTS`. Moves to config/checks/general/naming.ts as SWIFT_MEMBER_PARENTS: the language prefix keeps the name clear in a file that holds all four languages (S08-005); the Swift name extractor moves flat into checks/general/naming/ (PAR-013).
- TYPESCRIPT_PARAMETER_NODES (const exported, 48-48): **move** to `packages/cli/src/config/checks/general/naming.ts` `TYPESCRIPT_PARAMETER_NODES`. Moves to config/checks/general/naming.ts with the naming check values: the TypeScript name extractor moves flat into checks/general/naming/ (PAR-013).
- TYPESCRIPT_FUNCTION_NODES (const exported, 50-54): **move** to `packages/cli/src/config/checks/general/naming.ts` `TYPESCRIPT_FUNCTION_NODES`. Moves to config/checks/general/naming.ts with the naming check values: the TypeScript name extractor moves flat into checks/general/naming/ (PAR-013).
- TYPESCRIPT_METHOD_NODES (const exported, 56-56): **move** to `packages/cli/src/config/checks/general/naming.ts` `TYPESCRIPT_METHOD_NODES`. Moves to config/checks/general/naming.ts with the naming check values: the TypeScript name extractor moves flat into checks/general/naming/ (PAR-013).
- NAMED_DECLARATIONS (const exported, 58-65): **move** to `packages/cli/src/config/checks/general/naming.ts` `TYPESCRIPT_DECLARATIONS`. Moves to config/checks/general/naming.ts as TYPESCRIPT_DECLARATIONS: the language prefix keeps the name clear in a file that holds all four languages (S08-005); the TypeScript name extractor moves flat into checks/general/naming/ (PAR-013).
- NAME_NODES (const exported, 67-73): **move** to `packages/cli/src/config/checks/general/naming.ts` `TYPESCRIPT_NAME_NODES`. Moves to config/checks/general/naming.ts as TYPESCRIPT_NAME_NODES: the language prefix keeps the name clear in a file that holds all four languages (S08-005); the TypeScript name extractor moves flat into checks/general/naming/ (PAR-013).
- PATTERN_FIELDS (const exported, 75-79): **move** to `packages/cli/src/config/checks/general/naming.ts` `TYPESCRIPT_PATTERN_FIELDS`. Moves to config/checks/general/naming.ts as TYPESCRIPT_PATTERN_FIELDS: the language prefix keeps the name clear in a file that holds all four languages (S08-005); the TypeScript name extractor moves flat into checks/general/naming/ (PAR-013).
- PATTERN_LISTS (const exported, 81-81): **move** to `packages/cli/src/config/checks/general/naming.ts` `TYPESCRIPT_PATTERN_LISTS`. Moves to config/checks/general/naming.ts as TYPESCRIPT_PATTERN_LISTS: the language prefix keeps the name clear in a file that holds all four languages (S08-005); the TypeScript name extractor moves flat into checks/general/naming/ (PAR-013).

## `packages/cli/src/config/parsers/nextjs.ts`

- DISABLED_CHECKS (const exported, 1-1): **move** to `packages/cli/src/config/checks/framework/nextjs.ts` `DISABLED_CHECKS`. Moves to config/checks/framework/nextjs.ts with the Next.js check values: the Next.js settings reader moves into the Next.js check (PAR-011, CKO-004).
- SECRET_NAME (const exported, 3-3): **move** to `packages/cli/src/config/checks/framework/nextjs.ts` `SECRET_NAME`. Moves to config/checks/framework/nextjs.ts with the Next.js check values: the Next.js settings reader moves into the Next.js check (PAR-011, CKO-004).

## `packages/cli/src/config/parsers/nginx.ts`

- NGINX_ESCAPES (const exported, 1-1): **move** to `packages/cli/src/config/checks/infrastructure/nginx.ts` `NGINX_ESCAPES`. Moves to config/checks/infrastructure/nginx.ts with the nginx check values: the nginx tokenizer moves into the nginx check (PAR-011, PAR-083), which is in the infrastructure group (CKO-005).
- WORD_START_STOPS (const exported, 3-3): **move** to `packages/cli/src/config/checks/infrastructure/nginx.ts` `WORD_START_STOPS`. Moves to config/checks/infrastructure/nginx.ts with the nginx check values: the nginx tokenizer moves into the nginx check (PAR-011, PAR-083), which is in the infrastructure group (CKO-005).
- WORD_STOPS (const exported, 5-5): **move** to `packages/cli/src/config/checks/infrastructure/nginx.ts` `WORD_STOPS`. Moves to config/checks/infrastructure/nginx.ts with the nginx check values: the nginx tokenizer moves into the nginx check (PAR-011, PAR-083), which is in the infrastructure group (CKO-005).
- NGINX_PUNCTUATION (const exported, 7-7): **move** to `packages/cli/src/config/checks/infrastructure/nginx.ts` `NGINX_PUNCTUATION`. Moves to config/checks/infrastructure/nginx.ts with the nginx check values: the nginx tokenizer moves into the nginx check (PAR-011, PAR-083), which is in the infrastructure group (CKO-005).
- ESCAPE_LENGTH (const exported, 10-10): **move** to `packages/cli/src/config/checks/infrastructure/nginx.ts` `ESCAPE_LENGTH`. Moves to config/checks/infrastructure/nginx.ts with the nginx check values: the nginx tokenizer moves into the nginx check (PAR-011, PAR-083), which is in the infrastructure group (CKO-005).

## `packages/cli/src/config/parsers/output.ts`

- DEFAULT_PATTERN (const exported, 3-3): **keep** to `packages/cli/src/config/parsers/output.ts` `DEFAULT_PATTERN`. Stays in config/parsers/output.ts; its user, the regex and grouped readers, goes to output/text.ts (PAR-014).
- DEFAULT_FILE_PATTERN (const exported, 5-5): **keep** to `packages/cli/src/config/parsers/output.ts` `DEFAULT_FILE_PATTERN`. Stays in config/parsers/output.ts; its user, the regex and grouped readers, goes to output/text.ts (PAR-014).
- DEFAULT_GROUPED_PATTERN (const exported, 7-7): **keep** to `packages/cli/src/config/parsers/output.ts` `DEFAULT_GROUPED_PATTERN`. Stays in config/parsers/output.ts; its user, the regex and grouped readers, goes to output/text.ts (PAR-014).
- TRAILING_BRACKET_RULE (const exported, 9-9): **keep** to `packages/cli/src/config/parsers/output.ts` `TRAILING_BRACKET_RULE`. Stays in config/parsers/output.ts; its user, the regex and grouped readers, goes to output/text.ts (PAR-014).
- LEADING_DOT_SLASH (const exported, 11-11): **keep** to `packages/cli/src/config/parsers/output.ts` `LEADING_DOT_SLASH`. Stays in config/parsers/output.ts; its user, the regex and grouped readers, goes to output/text.ts (PAR-014).
- TRAILING_PAREN_RULE (const exported, 13-13): **keep** to `packages/cli/src/config/parsers/output.ts` `TRAILING_PAREN_RULE`. Stays in config/parsers/output.ts; its user, the regex and grouped readers, goes to output/text.ts (PAR-014).
- DEFAULT_OUTPUT_FORMAT (const exported, 15-15): **keep** to `packages/cli/src/config/parsers/output.ts` `DEFAULT_OUTPUT_FORMAT`. Stays in config/parsers/output.ts (PAR-061): applied once as the default of the output field, beside outputSchema, and the five ?? fallbacks go; written as { format: 'regex', pattern: DEFAULT_PATTERN } as const without the OutputSpec annotation, because config/ may not import types/.
- SEMGREP_PARSE_EXIT (const exported, 18-18): **keep** to `packages/cli/src/config/parsers/output.ts` `SEMGREP_PARSE_EXIT`. Stays in config/parsers/output.ts (PAR-014: one file per format).
- KNIP_ISSUE_MESSAGES (const exported, 21-39): **keep** to `packages/cli/src/config/parsers/output.ts` `KNIP_ISSUE_MESSAGES`. Stays in config/parsers/output.ts (PAR-025): the only list of Knip categories, beside the Knip reader and schema.

## `packages/cli/src/config/parsers/packages.ts`

- REQUIREMENT_NAME_END (const exported, 3-3): **rename** to `packages/cli/src/config/parsers/dependency-files.ts` `REQUIREMENT_NAME_END`. Stays in config/parsers/packages.ts, which is renamed in place to dependency-files.ts (glossary: dependency file is the one name), the one topic file for dependency files, npm clients and tool projects (PAR-063); one user, requirementName.
- SWIFT_PACKAGE_URL (const exported, 5-5): **rename** to `packages/cli/src/config/parsers/dependency-files.ts` `SWIFT_PACKAGE_URL`. Stays in config/parsers/packages.ts, which is renamed in place to dependency-files.ts (glossary: dependency file is the one name), the one topic file for dependency files, npm clients and tool projects (PAR-063); PAR-082: read url arguments only outside // comments.
- NPM_TOOL_PROJECT (const exported, 8-8): **rename** to `packages/cli/src/config/parsers/dependency-files.ts` `NPM_TOOL_PROJECT`. Stays in config/parsers/packages.ts, which is renamed in place to dependency-files.ts (glossary: dependency file is the one name) (PAR-023): the .gspot package.json identity, used by the tool-project schema and generation; INX-010, GEN-021: the generated .gspot/package.json is { private: true }, with no name and no type field.
- PYTHON_MIN_VERSION (const exported, 11-11): **rename** to `packages/cli/src/config/parsers/dependency-files.ts` `PYTHON_MIN_VERSION`. Stays in config/parsers/packages.ts, which is renamed in place to dependency-files.ts (glossary: dependency file is the one name) (PAR-023): part of the Python tool project identity; users tools/python and PYTHON_TOOL_PROJECT.
- PYTHON_TOOL_PROJECT (const exported, 12-16): **rename** to `packages/cli/src/config/parsers/dependency-files.ts` `PYTHON_TOOL_PROJECT`. Stays in config/parsers/packages.ts, which is renamed in place to dependency-files.ts (glossary: dependency file is the one name) (PAR-023): users are generation/python.ts and the Python tool project schema in tools/python; INX-010: the Python tool project is named tools (PEP 621 needs a name; uv never builds it).
- YARN_BERRY_MAJOR (const exported, 18-18): **rename** to `packages/cli/src/config/parsers/dependency-files.ts` `YARN_BERRY_MAJOR`. Stays in config/parsers/packages.ts, which is renamed in place to dependency-files.ts (glossary: dependency file is the one name), the one topic file for dependency files, npm clients and tool projects (PAR-023; NMS-009: manager is a banned term).
- JAVASCRIPT_RUNTIMES (const exported, 19-19): **rename** to `packages/cli/src/config/parsers/dependency-files.ts` `JAVASCRIPT_RUNTIMES`. Stays in config/parsers/packages.ts, which is renamed in place to dependency-files.ts (glossary: dependency file is the one name); users are the dependency-file reader, the configuration schema and repository.
- RUNTIME_COMMAND (const exported, 21-21): **rename** to `packages/cli/src/config/parsers/dependency-files.ts` `RUNTIME_COMMAND`. Stays in config/parsers/packages.ts, which is renamed in place to dependency-files.ts (glossary: dependency file is the one name); PAR-063: one user, packageRuntimes, and it is built from JAVASCRIPT_RUNTIMES.
- NEXT_ESLINT_PLUGIN (const exported, 23-23): **rename** to `packages/cli/src/config/parsers/dependency-files.ts` `NEXT_ESLINT_PLUGIN`. Stays in config/parsers/packages.ts, which is renamed in place to dependency-files.ts (glossary: dependency file is the one name) (PAR-023); users are the tool-project schema and generation.
- NEXT_ESLINT_PLUGIN_MAJOR (const exported, 24-24): **rename** to `packages/cli/src/config/parsers/dependency-files.ts` `NEXT_ESLINT_PLUGIN_MAJOR`. Stays in config/parsers/packages.ts, which is renamed in place to dependency-files.ts (glossary: dependency file is the one name) (PAR-023); one user, the tool-project schema.

## `packages/cli/src/config/parsers/source.ts`

- LINE_FEED (const exported, 2-2): **move** to `packages/cli/src/config/text.ts` `LINE_FEED`. Moves to config/text.ts with the generic text values: the byte value of a line break, used by parsers/git.ts and parsers/output/typos.ts.
- ENV_EXECUTABLE_SUFFIX (const exported, 5-5): **move** to `packages/cli/src/config/parsers/shebang.ts` `ENV_EXECUTABLE_SUFFIX`. Moves to the new config/parsers/shebang.ts with SHEBANG_PREFIX and ENV_SPLIT_FLAG: config/parsers/source.ts held two unrelated values; one user, parseShebang.

## `packages/cli/src/config/parsers/sql.ts`

- FROZEN_NONE (const exported, 1-1): **keep** to `packages/cli/src/config/parsers/sql.ts` `FROZEN_NONE`. Stays in config/parsers/sql.ts; users are frozenMigrationPaths and the Postgres history check.
- FROZEN_ALL (const exported, 3-3): **keep** to `packages/cli/src/config/parsers/sql.ts` `FROZEN_ALL`. Stays in config/parsers/sql.ts; one user, frozenMigrationPaths.
- MIGRATION_VERSION (const exported, 6-6): **keep** to `packages/cli/src/config/parsers/sql.ts` `MIGRATION_VERSION`. Stays in config/parsers/sql.ts; users are frozenMigrationPaths and the Postgres migrations check.

## `packages/cli/src/config/parsers/statements.ts`

- COUNTED_FUNCTION_NODES (const exported, 3-15): **move** to `packages/cli/src/config/checks/general/structure.ts` `COUNTED_FUNCTION_NODES`. Moves to config/checks/general/structure.ts: statement counting moves into the trivial-functions check (S08-002), so its values join the structure check values.
- TYPE_ALIASES (const exported, 17-17): **move** to `packages/cli/src/config/checks/general/structure.ts` `TYPE_ALIAS_NODES`. Moves to config/checks/general/structure.ts as TYPE_ALIAS_NODES, a name that says it is a set of node types beside other structure values (S08-005): statement counting moves into the trivial-functions check (S08-002).
- CONTAINER_NODES (const exported, 19-29): **move** to `packages/cli/src/config/checks/general/structure.ts` `CONTAINER_NODES`. Moves to config/checks/general/structure.ts: statement counting moves into the trivial-functions check (S08-002), so its values join the structure check values.
- CONTAINER_NOISE (const exported, 31-37): **move** to `packages/cli/src/config/checks/general/structure.ts` `CONTAINER_NOISE`. Moves to config/checks/general/structure.ts: statement counting moves into the trivial-functions check (S08-002), so its values join the structure check values.
- NAMES (const exported, 39-39): **move** to `packages/cli/src/config/checks/general/structure.ts` `BARE_NAME_NODES`. Moves to config/checks/general/structure.ts as BARE_NAME_NODES, because NAMES says nothing: statement counting moves into the trivial-functions check (S08-002).
- TYPE_REFERENCES (const exported, 41-41): **move** to `packages/cli/src/config/checks/general/structure.ts` `TYPE_REFERENCE_NODES`. Moves to config/checks/general/structure.ts as TYPE_REFERENCE_NODES, a name that says it is a set of node types beside other structure values (S08-005): statement counting moves into the trivial-functions check (S08-002).

## `packages/cli/src/config/parsers/stylelint.ts`

- STYLELINT_RULE_NAMES_FILE (const exported, 2-2): **move** to `packages/cli/src/config/generation/tool-file-sources.ts` `STYLELINT_RULE_NAMES_FILE`. Moves to config/generation/tool-file-sources.ts: one value, one place, because the CLI Stylelint builder reads the same file; scripts/update-rule-lists.ts imports it from #cli/config/generation/tool-file-sources.ts.
- STYLELINT_RULE_NAMES_MODULE (const exported, 3-3): **move** to `scripts/config/rule-lists.ts` `STYLELINT_RULE_NAMES_MODULE`. Moves to scripts/config/rule-lists.ts, the values of scripts/update-rule-lists.ts: the merged ruleNamesFileSchema no longer pins the package, so only the script uses it (PAR-024, PAR-031).

## `packages/cli/src/config/parsers/swift.ts`

- SWIFT_BODY_NODES (const exported, 2-12): **delete**. Delete (PAR-001): only the dead Swift function reader used it.
- FUNCTION_NAMES (const exported, 15-24): **move** to `packages/cli/src/config/checks/general/structure.ts` `SWIFT_FUNCTION_LABELS`. Moves to config/checks/general/structure.ts as SWIFT_FUNCTION_LABELS, with the trivial-functions values: swiftFunctionName moves to its one caller, and the name says it labels Swift function bodies.
- ACCESSOR_NODES (const exported, 27-33): **move** to `packages/cli/src/config/checks/general/structure.ts` `SWIFT_ACCESSOR_NODES`. Moves to config/checks/general/structure.ts as SWIFT_ACCESSOR_NODES, with the trivial-functions values: the language prefix keeps the name clear beside other structure values (S08-005).
- SWIFT_TOOLS_VERSION (const exported, 36-36): **move** to `packages/cli/src/config/generation/tool-file-sources.ts` `SWIFT_TOOLS_VERSION`. Moves to config/generation/tool-file-sources.ts, the static values of the typed tool file builders: readSwiftVersion moves to its one caller, the tool file values (PAR-011).

## `packages/cli/src/config/parsers/toml.ts`

- TOML_STRINGS (const exported, 3-3): **delete**. Delete (PAR-051): TOML comments come from the TOML parser, not a regex.
- BARE_KEY (const exported, 5-5): **delete**. Delete (EXG-062): the mise file is written with the TOML library, which quotes keys itself; PAR-074.
- NODE_KINDS (const exported, 8-25): **delete**. Delete (PAR-050): compare String(node.type) directly; the hand-copied kind list goes.
- NODE_KIND_SET (const exported, 27-27): **delete**. Delete (PAR-050): compare String(node.type) directly.
- VALUE_KINDS (const exported, 29-29): **keep** to `packages/cli/src/config/parsers/toml.ts` `VALUE_KINDS`. Stays in config/parsers/toml.ts (PAR-007); PAR-050: isValue tests node.type against it directly.
- PATCH_FORMAT (const exported, 32-32): **keep** to `packages/cli/src/config/parsers/toml.ts` `PATCH_FORMAT`. Stays in config/parsers/toml.ts (PAR-007); one user, patchToml.
- TOOL_EMIT_FORMAT (const exported, 35-38): **move** to `packages/cli/src/config/generation/tool-file-sources.ts` `TOOL_EMIT_FORMAT`. Moves to config/generation/tool-file-sources.ts, the static values of the typed tool file builders (PAR-074); users are the tool file value helpers, generation/python.ts (EXG-014) and generation/mise.ts (EXG-062).

## `packages/cli/src/config/parsers/tsconfig.ts`

- TS_EMPTY_FILES_CODE (const exported, 1-1): **keep** to `packages/cli/src/config/parsers/tsconfig.ts` `TS_EMPTY_FILES_CODE`. Stays in config/parsers/tsconfig.ts (PAR-022: TypeScript project reading gets its own file).
- TS_NO_INPUTS_CODE (const exported, 3-3): **keep** to `packages/cli/src/config/parsers/tsconfig.ts` `TS_NO_INPUTS_CODE`. Stays in config/parsers/tsconfig.ts (PAR-022: TypeScript project reading gets its own file).

## `packages/cli/src/config/parsers/xcode.ts`

- SETTING_REFERENCE (const exported, 1-1): **keep** to `packages/cli/src/config/parsers/xcode.ts` `SETTING_REFERENCE`. Stays in config/parsers/xcode.ts (PAR-011: the Xcode project reader becomes parsers/xcode.ts).

## `packages/cli/src/parsers/attributes.ts`

- attributeRules (function exported, 11-29): **move** to `packages/cli/src/parsers/git.ts` `attributeRules`. Moves to parsers/git.ts, which holds the .gitattributes readers; PAR-070: split(...).filter(Boolean), so no empty attribute; TMF-001: a new user, the reader of linguist-generated and linguist-vendored patterns for the tool ignore files; '\*\*/' has one name, ANY_FOLDER_PREFIX in config/system/paths.ts. Values to config: ATTRIBUTE_LINE = /^("(?:\[^"\\\\\]|\\\\.)\*"|\\S+)(?:\\s+|$)/u -&gt; packages/cli/src/config/parsers/git.ts; LEADING_SLASH = /^\\//u -&gt; packages/cli/src/config/parsers/git.ts; ANY_FOLDER_PREFIX = '\*\*/' -&gt; packages/cli/src/config/system/paths.ts
- attributesFor (function exported, 37-47): **move** to `packages/cli/src/parsers/git.ts` `attributesFor`. Moves to parsers/git.ts, which holds the .gitattributes readers. Values to config: BINARY_ATTRIBUTES = { diff: 'unset', merge: 'unset', text: 'unset' } -&gt; packages/cli/src/config/parsers/git.ts; BINARY_MACRO = 'binary' -&gt; packages/cli/src/config/parsers/git.ts
- gitAttributes (function exported, 54-65): **move** to `packages/cli/src/parsers/git.ts` `gitAttributes`. Moves to parsers/git.ts; git.ts holds the .gitattributes readers.

## `packages/cli/src/parsers/bash/contracts.ts`

- commandSteps (function, 5-24): **move** to `packages/cli/src/checks/framework/nextjs.ts` `commandSteps`. Moves to checks/framework/nextjs.ts (PAR-021; PAR-011): the Next.js build-flag reader moves into the Next.js check.
- scriptCommands (function, 27-31): **move** to `packages/cli/src/checks/framework/nextjs.ts` `scriptCommands`. Moves to checks/framework/nextjs.ts (PAR-021; PAR-011): the Next.js build-flag reader moves into the Next.js check.
- nextArguments (function, 33-52): **move** to `packages/cli/src/checks/framework/nextjs.ts` `nextArguments`. Moves to checks/framework/nextjs.ts (PAR-021); PAR-078: it uses the one NPM_CLIENTS list, from which npmClientIdentitySchema builds z.enum(NPM_CLIENTS). Values to config: NEXT_PACKAGE_RUNNERS = \['npx', 'bunx'\] -&gt; packages/cli/src/config/checks/framework/nextjs.ts; NPM_CLIENTS = \['npm', 'bun', 'pnpm', 'yarn'\] -&gt; packages/cli/src/config/parsers/dependency-files.ts; NEXT_RUN_WORDS = \['exec', 'dlx', 'next'\] -&gt; packages/cli/src/config/checks/framework/nextjs.ts; NEXT_COMMAND = 'next' -&gt; packages/cli/src/config/checks/framework/nextjs.ts
- parseNextBuildFlags (function exported, 59-71): **move** to `packages/cli/src/checks/framework/nextjs.ts` `parseNextBuildFlags`. Moves to checks/framework/nextjs.ts (PAR-011, PAR-021): one production caller; its unit test moves with it. Values to config: NEXT_BUILD_ACTION = 'build' -&gt; packages/cli/src/config/checks/framework/nextjs.ts

## `packages/cli/src/parsers/bash/public.ts`

- functionOwner (function, 16-23): **rename** to `packages/cli/src/parsers/bash.ts` `enclosingFunction`. Renamed enclosingFunction in parsers/bash.ts; PAR-007 (bash/public.ts becomes bash.ts); owner outside the ownership log is filler (glossary).
- highestRead (function, 25-44): **rename** to `packages/cli/src/parsers/bash.ts` `highestRead`. Stays in bash/public.ts, which becomes parsers/bash.ts (PAR-007). Values to config: EXPANSION_NODES = \['simple_expansion', 'expansion'\] -&gt; packages/cli/src/config/parsers/bash.ts; POSITIONAL_PARAMETER = /^\[1-9\]\\d\*$/u -&gt; packages/cli/src/config/parsers/bash.ts; SHIFT_COMMAND = 'shift' -&gt; packages/cli/src/config/parsers/bash.ts
- maskComments (function, 47-61): **rename** to `packages/cli/src/parsers/bash.ts` `maskComments`. Stays in bash/public.ts, which becomes parsers/bash.ts (PAR-007); PAR-039: it uses the shared blankOut helper in src/text.ts, whose one value is NOT_LINE_BREAK. Values to config: NOT_LINE_BREAK = /\[^\\r\\n\]/gu -&gt; packages/cli/src/config/text.ts
- isTemporaryValue (function, 64-73): **rename** to `packages/cli/src/parsers/bash.ts` `isTemporaryValue`. Stays in bash/public.ts, which becomes parsers/bash.ts (PAR-007). Values to config: TEMPORARY_VALUE_NODES = \['string', 'command_substitution'\] -&gt; packages/cli/src/config/parsers/bash.ts; TEMPORARY_FILE_COMMAND = 'mktemp' -&gt; packages/cli/src/config/parsers/bash.ts
- localNames (function, 76-96): **rename** to `packages/cli/src/parsers/bash.ts` `localNames`. Stays as localNames; its file becomes parsers/bash.ts (PAR-007): bash/public.ts becomes bash.ts.
- temporaryTargets (function, 99-122): **rename** to `packages/cli/src/parsers/bash.ts` `temporaryTargets`. Stays as temporaryTargets; its file becomes parsers/bash.ts (PAR-007): bash/public.ts becomes bash.ts.
- temporaryTarget (function, 125-140): **rename** to `packages/cli/src/parsers/bash.ts` `temporaryTarget`. Stays in bash/public.ts, which becomes parsers/bash.ts (PAR-007); it reads the same EXPANSION_NODES list as highestRead. Values to config: EXPANSION_NODES = \['simple_expansion', 'expansion'\] -&gt; packages/cli/src/config/parsers/bash.ts
- recordRemovals (function, 143-151): **rename** to `packages/cli/src/parsers/bash.ts` `recordRemovals`. Stays as recordRemovals; its file becomes parsers/bash.ts (PAR-007): bash/public.ts becomes bash.ts.
- removalTargets (function, 154-166): **rename** to `packages/cli/src/parsers/bash.ts` `removalTargets`. Stays in bash/public.ts, which becomes parsers/bash.ts (PAR-007). Values to config: END_OF_OPTIONS = '--' -&gt; packages/cli/src/config/parsers/bash.ts
- temporaryCleanups (function, 169-209): **rename** to `packages/cli/src/parsers/bash.ts` `temporaryCleanups`. Stays in bash/public.ts, which becomes parsers/bash.ts (PAR-007); it shares END_OF_OPTIONS with removalTargets. Values to config: REMOVE_COMMAND = 'rm' -&gt; packages/cli/src/config/parsers/bash.ts; TRAP_COMMAND = 'trap' -&gt; packages/cli/src/config/parsers/bash.ts; END_OF_OPTIONS = '--' -&gt; packages/cli/src/config/parsers/bash.ts
- parseBashScript (function exported, 217-276): **rename** to `packages/cli/src/parsers/bash.ts` `parseBashScript`. Stays as parseBashScript; its file becomes parsers/bash.ts (PAR-007; PAR-002): drop quotedArguments, isTrivialFile, statements and minimumStatements, signature (text, cache?); CKO-001 adds the branch, nesting and assignment counts.
- codeLines (function exported, 283-288): **rename** to `packages/cli/src/parsers/bash.ts` `codeLines`. Stays as codeLines; its file becomes parsers/bash.ts (PAR-007; PAR-037): returns NumberedLine.
- withoutDeclaration (function exported, 295-301): **move** to `packages/cli/src/checks/language/bash/script-layout.ts` `withoutDeclaration`. Moves to the Bash script-layout check (S08-003): one caller, libraryLineFindings; it strips words from a code line and parses nothing, so it leaves the parser.

## `packages/cli/src/parsers/contracts.ts`

- entryLines (function, 24-27): **move** to `packages/cli/src/parsers/git.ts` `entryLines`. Moves to parsers/git.ts (PAR-007; PAR-085): parsers/contracts.ts splits into git.ts and lockfiles.ts.
- parseEntry (function, 29-33): **move** to `packages/cli/src/parsers/git.ts` `parseEntry`. Moves to parsers/git.ts (PAR-007; PAR-085): parsers/contracts.ts splits into git.ts and lockfiles.ts.
- nextChunk (function, 36-44): **move** to `packages/cli/src/parsers/git.ts` `nextChunk`. Moves to parsers/git.ts (PAR-007; PAR-085): parsers/contracts.ts splits into git.ts and lockfiles.ts.
- readHeader (function, 46-55): **move** to `packages/cli/src/parsers/git.ts` `readBlobLine`. Moves to parsers/git.ts as readBlobLine (PAR-064): header has four meanings; readObjectLine has the banned term object.
- readBytes (function, 57-69): **move** to `packages/cli/src/parsers/git.ts` `readBytes`. Moves to parsers/git.ts (PAR-007; PAR-085): parsers/contracts.ts splits into git.ts and lockfiles.ts.
- blobSize (function, 71-77): **move** to `packages/cli/src/parsers/git.ts` `blobSize`. Moves to parsers/git.ts (PAR-007; PAR-085): parsers/contracts.ts splits into git.ts and lockfiles.ts.
- parseIndexEntries (function exported, 84-90): **move** to `packages/cli/src/parsers/git.ts` `parseIndexEntries`. Moves to parsers/git.ts (PAR-007; PAR-085).
- parseGitEntries (function exported, 98-103): **move** to `packages/cli/src/parsers/git.ts` `parseTreeEntries`. Moves to parsers/git.ts as parseTreeEntries (PAR-003): the index mode is dead; keep only the commit path and drop the kind parameter.
- parseIndexRevision (function exported, 110-113): **move** to `packages/cli/src/parsers/git.ts` `parseIndexRevision`. Moves to parsers/git.ts (PAR-007; PAR-085).
- parseGitBlobs (function exported, 121-138): **move** to `packages/cli/src/parsers/git.ts` `parseGitBlobs`. Moves to parsers/git.ts; PAR-007; PAR-085; CKO-013 asks callers to receive buffers in request order.
- parseLockfile (function exported, 146-152): **delete**. Delete (PAR-085): a switch on a file name that every caller passes as a literal; each caller calls the format parser directly (parseSyml, parseJsonc, JSON.parse, parseYaml), and the TOML branch and the field parsed go.
- rootLockfileDependencies (function exported, 160-175): **move** to `packages/cli/src/tools/npm/lockfiles.ts` `rootLockfileDependencies`. Moves to tools/npm/lockfiles.ts (PAR-085): one production caller; PAR-044: one pnpm schema, {} when devDependencies is missing; it calls JSON.parse, parseJsonc and parseYaml directly; its unit test keeps calling it. Values to config: PNPM_ROOT_IMPORTER = '.' -&gt; packages/cli/src/config/tools/npm.ts
- lockfileEntry (function exported, 182-184): **move** to `packages/cli/src/parsers/lockfiles.ts` `lockfileEntry`. Moves to parsers/lockfiles.ts (PAR-085; PAR-085): six callers in four folders, beside LOCKFILES.

## `packages/cli/src/parsers/css.ts`

- moduleBinding (function, 9-15): **delete**. Delete: CKO-029 (owner rule): css/module-classes is deleted, the only user of parsers/css.ts.
- sourceImporters (function, 18-38): **delete**. Delete: CKO-029 (owner rule): css/module-classes is deleted, the only user of parsers/css.ts.
- classRead (function, 41-45): **delete**. Delete: CKO-029 (owner rule): css/module-classes is deleted, the only user of parsers/css.ts.
- propertyReads (function, 47-60): **delete**. Delete: CKO-029 (owner rule): css/module-classes is deleted, the only user of parsers/css.ts.
- destructuredReads (function, 62-79): **delete**. Delete: CKO-029 (owner rule): css/module-classes is deleted, the only user of parsers/css.ts.
- bindingReads (function, 82-92): **delete**. Delete: CKO-029 (owner rule): css/module-classes is deleted, the only user of parsers/css.ts.
- precedingMode (function, 95-103): **delete**. Delete: CKO-029 (owner rule): css/module-classes is deleted, the only user of parsers/css.ts.
- isGlobalClass (function, 106-116): **delete**. Delete: CKO-029 (owner rule): css/module-classes is deleted, the only user of parsers/css.ts.
- moduleImporters (function exported, 124-138): **delete**. Delete: CKO-029 (owner rule): css/module-classes is deleted; moduleImporters had no other caller.
- definedClasses (function exported, 146-160): **delete**. Delete: CKO-029 (owner rule): css/module-classes is deleted; definedClasses had no other caller.

## `packages/cli/src/parsers/html.ts`

- getAttributes (function exported, 9-20): **rename** to `packages/cli/src/parsers/html.ts` `elementAttributes`. Renamed elementAttributes: a pure lookup takes a noun, not get (NMS-016, S08-004); it stays in parsers/html.ts for its two callers in two check folders (site, html); exportedNames uses the same SURROUNDING_QUOTES regex. Values to config: SURROUNDING_QUOTES = /^\["'\]|\["'\]$/gu -&gt; packages/cli/src/config/text.ts (exportedNames uses the same regex)

## `packages/cli/src/parsers/mise.ts`

- parseMiseToolKeys (function exported, 10-13): **delete**. Delete (INX-007): its one caller duplicateMisePins is deleted.
- parseMiseTasks (function exported, 20-26): **keep** to `packages/cli/src/parsers/mise.ts` `parseMiseTasks`. Stays in parsers/mise.ts; the mise schemas move in (PAR-008).

## `packages/cli/src/parsers/naming/bash.ts`

- addFunctions (function, 5-10): **move** to `packages/cli/src/checks/general/naming/bash.ts` `addFunctions`. Moves to checks/general/naming/bash.ts (PAR-013): the Bash name extractor moves flat into checks/general/naming/.
- addAssignments (function, 12-17): **move** to `packages/cli/src/checks/general/naming/bash.ts` `addAssignments`. Moves to checks/general/naming/bash.ts (PAR-013): the Bash name extractor moves flat into checks/general/naming/.
- addDeclarations (function, 19-23): **move** to `packages/cli/src/checks/general/naming/bash.ts` `addDeclarations`. Moves to checks/general/naming/bash.ts (PAR-013): the Bash name extractor moves flat into checks/general/naming/.
- bashIdentifiers (function exported, 31-37): **move** to `packages/cli/src/checks/general/naming/bash.ts` `bashIdentifiers`. Moves to checks/general/naming/bash.ts (PAR-013): one caller, the naming check, and the Bash name extractor moves flat into checks/general/naming/.

## `packages/cli/src/parsers/naming/contracts.ts`

- createIdentifier (function exported, 11-17): **move** to `packages/cli/src/checks/general/naming/declarations.ts` `createIdentifier`. Moves to checks/general/naming/declarations.ts (PAR-013): its own file avoids an import loop with the naming reader; PAR-080: label field; drop the ?? category fallback.
- addIdentifier (function exported, 26-36): **move** to `packages/cli/src/checks/general/naming/declarations.ts` `addIdentifier`. Moves to checks/general/naming/declarations.ts (PAR-013): shared by the four tree-sitter extractors.

## `packages/cli/src/parsers/naming/public.ts`

- addedColumns (function, 8-17): **move** to `packages/cli/src/checks/general/naming/sql.ts` `addedColumns`. Moves to checks/general/naming/sql.ts (PAR-013), a file that says SQL.
- READERS (const, 19-40): **move** to `packages/cli/src/checks/general/naming/sql.ts` `NAME_READERS`. Moves to checks/general/naming/sql.ts as NAME_READERS (PAR-013): READERS also names the SQL lexer table, so it is named by what it reads; a table of functions stays module-level, because config/ may not import code.
- identifiers (function, 42-62): **move** to `packages/cli/src/checks/general/naming/sql.ts` `statementIdentifiers`. Moves to checks/general/naming/sql.ts as statementIdentifiers (PAR-013; PAR-045): take positions from libpg-query location fields and fall back to a search after the keyword.
- sqlIdentifiers (function exported, 71-78): **move** to `packages/cli/src/checks/general/naming/sql.ts` `sqlIdentifiers`. Moves to checks/general/naming/sql.ts (PAR-013); one production caller, the naming check.

## `packages/cli/src/parsers/naming/python.ts`

- holderOf (function, 15-18): **move** to `packages/cli/src/checks/general/naming/python.ts` `holderOf`. Moves to checks/general/naming/python.ts (PAR-013): the Python name extractor moves flat into checks/general/naming/.
- addClasses (function, 20-26): **move** to `packages/cli/src/checks/general/naming/python.ts` `addClasses`. Moves to checks/general/naming/python.ts (PAR-013): the Python name extractor moves flat into checks/general/naming/.
- unwrapped (function, 29-32): **move** to `packages/cli/src/checks/general/naming/python.ts` `unwrapped`. Moves to checks/general/naming/python.ts (PAR-013): the Python name extractor moves flat into checks/general/naming/.
- parameterName (function, 34-38): **move** to `packages/cli/src/checks/general/naming/python.ts` `parameterName`. Moves to checks/general/naming/python.ts (PAR-013): the Python name extractor moves flat into checks/general/naming/.
- addParameters (function, 40-47): **move** to `packages/cli/src/checks/general/naming/python.ts` `addParameters`. Moves to checks/general/naming/python.ts (PAR-013): the Python name extractor moves flat into checks/general/naming/.
- addFunctions (function, 49-55): **move** to `packages/cli/src/checks/general/naming/python.ts` `addFunctions`. Moves to checks/general/naming/python.ts (PAR-013): the Python name extractor moves flat into checks/general/naming/.
- bindingCategory (function, 57-61): **move** to `packages/cli/src/checks/general/naming/python.ts` `bindingCategory`. Moves to checks/general/naming/python.ts (PAR-013): the Python name extractor moves flat into checks/general/naming/.
- addAssignments (function, 63-73): **move** to `packages/cli/src/checks/general/naming/python.ts` `addAssignments`. Moves to checks/general/naming/python.ts (PAR-013): the Python name extractor moves flat into checks/general/naming/.
- pythonIdentifiers (function exported, 81-87): **move** to `packages/cli/src/checks/general/naming/python.ts` `pythonIdentifiers`. Moves to checks/general/naming/python.ts (PAR-013): one caller, the naming check, and the Python name extractor moves flat into checks/general/naming/.

## `packages/cli/src/parsers/naming/swift.ts`

- addTypes (function, 6-11): **move** to `packages/cli/src/checks/general/naming/swift.ts` `addTypes`. Moves to checks/general/naming/swift.ts (PAR-013): the Swift name extractor moves flat into checks/general/naming/; the five Swift adders strip SWIFT_NAME_QUOTE, written five times today. Values to config: SWIFT_NAME_QUOTE = ''' -&gt; packages/cli/src/config/checks/general/naming.ts
- addParameters (function, 14-20): **move** to `packages/cli/src/checks/general/naming/swift.ts` `addParameters`. Moves to checks/general/naming/swift.ts (PAR-013): the Swift name extractor moves flat into checks/general/naming/. Values to config: SWIFT_NAME_QUOTE = ''' -&gt; packages/cli/src/config/checks/general/naming.ts
- addFunctions (function, 22-35): **move** to `packages/cli/src/checks/general/naming/swift.ts` `addFunctions`. Moves to checks/general/naming/swift.ts (PAR-013): the Swift name extractor moves flat into checks/general/naming/. Values to config: SWIFT_CALLABLE_NODES = \[...SWIFT_FUNCTION_NODES, 'init_declaration'\] -&gt; packages/cli/src/config/checks/general/naming.ts; SWIFT_NAME_QUOTE = ''' -&gt; packages/cli/src/config/checks/general/naming.ts
- bindingCategory (function, 37-44): **move** to `packages/cli/src/checks/general/naming/swift.ts` `bindingCategory`. Moves to checks/general/naming/swift.ts (PAR-013): the Swift name extractor moves flat into checks/general/naming/.
- addNames (function, 46-54): **move** to `packages/cli/src/checks/general/naming/swift.ts` `addNames`. Moves to checks/general/naming/swift.ts (PAR-013): the Swift name extractor moves flat into checks/general/naming/. Values to config: SWIFT_NAME_QUOTE = ''' -&gt; packages/cli/src/config/checks/general/naming.ts
- addCases (function, 56-61): **move** to `packages/cli/src/checks/general/naming/swift.ts` `addCases`. Moves to checks/general/naming/swift.ts (PAR-013): the Swift name extractor moves flat into checks/general/naming/. Values to config: SWIFT_NAME_QUOTE = ''' -&gt; packages/cli/src/config/checks/general/naming.ts
- swiftIdentifiers (function exported, 69-76): **move** to `packages/cli/src/checks/general/naming/swift.ts` `swiftIdentifiers`. Moves to checks/general/naming/swift.ts (PAR-013): one caller, the naming check, and the Swift name extractor moves flat into checks/general/naming/.

## `packages/cli/src/parsers/naming/typescript.ts`

- addPattern (function, 15-27): **move** to `packages/cli/src/checks/general/naming/typescript.ts` `addPattern`. Moves to checks/general/naming/typescript.ts (PAR-013): the TypeScript name extractor moves flat into checks/general/naming/.
- addParameter (function, 29-34): **move** to `packages/cli/src/checks/general/naming/typescript.ts` `addParameter`. Moves to checks/general/naming/typescript.ts (PAR-013): the TypeScript name extractor moves flat into checks/general/naming/.
- addParameters (function, 36-43): **move** to `packages/cli/src/checks/general/naming/typescript.ts` `addParameters`. Moves to checks/general/naming/typescript.ts (PAR-013): the TypeScript name extractor moves flat into checks/general/naming/.
- isImportBinding (function, 47-54): **move** to `packages/cli/src/checks/general/naming/typescript.ts` `isImportBinding`. Moves to checks/general/naming/typescript.ts (PAR-013): the TypeScript name extractor moves flat into checks/general/naming/.
- addNamed (function, 56-69): **move** to `packages/cli/src/checks/general/naming/typescript.ts` `addNamed`. Moves to checks/general/naming/typescript.ts (PAR-013): the TypeScript name extractor moves flat into checks/general/naming/.
- addEnumCases (function, 71-76): **move** to `packages/cli/src/checks/general/naming/typescript.ts` `addEnumCases`. Moves to checks/general/naming/typescript.ts (PAR-013): the TypeScript name extractor moves flat into checks/general/naming/.
- typescriptIdentifiers (function exported, 85-98): **move** to `packages/cli/src/checks/general/naming/typescript.ts` `typescriptIdentifiers`. Moves to checks/general/naming/typescript.ts (PAR-013): one caller, the naming check, and the TypeScript name extractor moves flat into checks/general/naming/. Values to config: TYPESCRIPT_CALLABLE_NODES = \[...TYPESCRIPT_FUNCTION_NODES, ...TYPESCRIPT_METHOD_NODES, 'arrow_function'\] -&gt; packages/cli/src/config/checks/general/naming.ts

## `packages/cli/src/parsers/packages/contracts.ts`

- stringList (const, 30-30): **move** to `packages/cli/src/parsers/dependency-files.ts` `stringList`. Moves to parsers/dependency-files.ts (PAR-063): the dependency-file schemas get their own file, and a zod schema stays in its parser module; PAR-067: this one has no default and keeps the name.
- stringMap (const, 32-32): **move** to `packages/cli/src/parsers/dependency-files.ts` `stringMap`. Moves to parsers/dependency-files.ts (PAR-063): the dependency-file schemas get their own file, and a zod schema stays in its parser module.
- dependencyGroups (const, 34-34): **move** to `packages/cli/src/parsers/dependency-files.ts` `dependencyGroups`. Moves to parsers/dependency-files.ts (PAR-063): the dependency-file schemas get their own file, and a zod schema stays in its parser module.
- groupInclude (const, 36-36): **move** to `packages/cli/src/parsers/dependency-files.ts` `groupInclude`. Moves to parsers/dependency-files.ts (PAR-063): the dependency-file schemas get their own file, and a zod schema stays in its parser module.
- dependencyGroup (const, 38-38): **move** to `packages/cli/src/parsers/dependency-files.ts` `dependencyGroup`. Moves to parsers/dependency-files.ts (PAR-063): the dependency-file schemas get their own file, and a zod schema stays in its parser module.
- pythonProject (const, 40-45): **move** to `packages/cli/src/parsers/dependency-files.ts` `projectTable`. Moves to parsers/dependency-files.ts as projectTable (PAR-063): the \[project\] table of pyproject.toml, and pythonProject already names a generation function; a zod schema stays in its parser module.
- pythonDependencyDetail (const, 47-47): **move** to `packages/cli/src/parsers/dependency-files.ts` `pythonDependencyDetail`. Moves to parsers/dependency-files.ts (PAR-063): the dependency-file schemas get their own file, and a zod schema stays in its parser module.
- pythonDependencyMap (const, 49-52): **move** to `packages/cli/src/parsers/dependency-files.ts` `pythonDependencyMap`. Moves to parsers/dependency-files.ts (PAR-063): the dependency-file schemas get their own file, and a zod schema stays in its parser module.
- poetryGroup (const, 54-54): **move** to `packages/cli/src/parsers/dependency-files.ts` `poetryGroup`. Moves to parsers/dependency-files.ts (PAR-063): the dependency-file schemas get their own file, and a zod schema stays in its parser module.
- workspacePackages (const, 56-56): **move** to `packages/cli/src/parsers/dependency-files.ts` `workspacePackages`. Moves to parsers/dependency-files.ts (PAR-063): the dependency-file schemas get their own file, and a zod schema stays in its parser module.
- devEngineInstaller (const, 58-58): **move** to `packages/cli/src/parsers/dependency-files.ts` `devEngineEntry`. Moves to parsers/dependency-files.ts as devEngineEntry (PAR-063); NMS-009: installer only for tool install sources; a zod schema stays in its parser module.
- devEngines (const, 60-62): **move** to `packages/cli/src/parsers/dependency-files.ts` `devEngines`. Moves to parsers/dependency-files.ts (PAR-063): part of the package.json schema; a zod schema stays in its parser module.
- installerVersion (const, 64-70): **move** to `packages/cli/src/parsers/npm-client.ts` `npmClientVersion`. Moves to parsers/npm-client.ts as npmClientVersion (PAR-023, NMS-009; NMS-009: NpmClient in code); GEN-021: drop the N.x branch; a zod schema stays in its parser module.
- toolDependencyVersion (const, 72-72): **move** to `packages/cli/src/parsers/tool-project.ts` `toolDependencyVersion`. Moves to parsers/tool-project.ts (PAR-023): one user, the tool-project schema; a zod schema stays in its parser module.
- packageInstallerDeclaration (function, 74-79): **move** to `packages/cli/src/parsers/npm-client.ts` `parseNpmClientField`. Moves to parsers/npm-client.ts as parseNpmClientField (PAR-023, NMS-009): it splits the packageManager field into name and version; the value name avoids "manager", a shipped banned term (glossary: NpmClient in code). Values to config: NPM_CLIENT_HASH_SUFFIX = '+sha' -&gt; packages/cli/src/config/parsers/dependency-files.ts
- poetryToolSchema (const exported, 81-84): **move** to `packages/cli/src/parsers/dependency-files.ts` `poetryToolSchema`. Moves to parsers/dependency-files.ts (PAR-063): only the pyproject schema and the PoetrySettings type use it; a zod schema stays in its module; stop exporting.
- packageInstallerIdentitySchema (const exported, 86-89): **move** to `packages/cli/src/parsers/npm-client.ts` `npmClientIdentitySchema`. Moves to parsers/npm-client.ts as npmClientIdentitySchema (PAR-023, NMS-009); PAR-078: the enum is z.enum(NPM_CLIENTS) from config/parsers/dependency-files.ts; a zod schema stays in its module.
- packageInstallerSchema (const exported, 91-91): **move** to `packages/cli/src/parsers/npm-client.ts` `npmClientSchema`. Moves to parsers/npm-client.ts as npmClientSchema (PAR-023, NMS-009); a zod schema stays in its module.
- packageInstallerDeclarationSchema (const exported, 94-96): **move** to `packages/cli/src/parsers/npm-client.ts` `npmClientDeclarationSchema`. Moves to parsers/npm-client.ts as npmClientDeclarationSchema (PAR-023, NMS-009); a zod schema stays in its module.
- toolProjectSchema (const exported, 98-108): **move** to `packages/cli/src/parsers/tool-project.ts` `toolProjectSchema`. Moves to parsers/tool-project.ts (PAR-023): only tests use it outside parseToolProject, so stop exporting and tests call parseToolProject; INX-010: the name literal check goes, because gspot checked its own output.
- pipfileSchema (const exported, 110-113): **move** to `packages/cli/src/parsers/dependency-files.ts` `pipfileSchema`. Moves to parsers/dependency-files.ts (PAR-063); one user, parsePipfile; a zod schema stays in its module; stop exporting.
- pythonManifestSchema (const exported, 115-119): **move** to `packages/cli/src/parsers/dependency-files.ts` `pyprojectSchema`. Moves to parsers/dependency-files.ts as pyprojectSchema (PAR-063: manifest means only manifest.toml); one user, parsePyproject; stop exporting.
- packageManifestSchema (const exported, 121-136): **move** to `packages/cli/src/parsers/dependency-files.ts` `packageJsonSchema`. Moves to parsers/dependency-files.ts as packageJsonSchema (PAR-063: manifest means only manifest.toml); a zod schema stays in its module.
- bunInstallSchema (const exported, 139-139): **move** to `packages/cli/src/checks/general/dependencies/bun-release-age.ts` `bunInstallSchema`. Moves to the bun-release-age check, its one user, where parseBunInstallSettings is inlined; a zod schema stays in its module.
- isYarnBerry (function exported, 146-149): **move** to `packages/cli/src/parsers/npm-client.ts` `isYarnBerry`. Moves to parsers/npm-client.ts (PAR-023): package manager helpers get their own file (npm-client.ts, NMS-009).
- getPackageInstallerMajor (function exported, 156-158): **move** to `packages/cli/src/parsers/npm-client.ts` `npmClientMajor`. Moves to parsers/npm-client.ts as npmClientMajor; PAR-023; NMS-009 table B; GEN-021: no .x replace.
- parsePackageInstaller (function exported, 165-167): **move** to `packages/cli/src/parsers/npm-client.ts` `parseNpmClient`. Moves to parsers/npm-client.ts as parseNpmClient (PAR-023; NMS-009; NMS-009).
- declaredPackageInstaller (function exported, 174-179): **move** to `packages/cli/src/parsers/npm-client.ts` `declaredNpmClient`. Moves to parsers/npm-client.ts as declaredNpmClient (PAR-023; NMS-009; NMS-009).
- parseToolProject (function exported, 186-191): **move** to `packages/cli/src/parsers/tool-project.ts` `parseToolProject`. Moves to parsers/tool-project.ts (PAR-023): the .gspot package.json and its lockfile.
- packageLockfile (function exported, 198-201): **move** to `packages/cli/src/parsers/tool-project.ts` `toolProjectLockfile`. Moves to parsers/tool-project.ts as toolProjectLockfile (PAR-023; PAR-050): a typed lookup with no throw, named for what it returns.
- parseTsconfig (function exported, 210-237): **move** to `packages/cli/src/parsers/tsconfig.ts` `parseTsconfig`. Moves to parsers/tsconfig.ts; PAR-022; one caller (readTsconfig) in the same file; stop exporting.
- compilerHost (function exported, 247-284): **move** to `packages/cli/src/parsers/tsconfig.ts` `compilerHost`. Moves to parsers/tsconfig.ts (PAR-022); one caller, projectSources, in the same file; stop exporting; the 'node_modules' segment is the one NODE_MODULES value. Values to config: NODE_MODULES = 'node_modules' -&gt; packages/cli/src/config/repository/tracked.ts
- configurationText (function exported, 293-310): **move** to `packages/cli/src/parsers/tsconfig.ts` `readCompilerFile`. Moves to parsers/tsconfig.ts as readCompilerFile (PAR-022; PAR-055: it reads any compiler input, not only configuration); stop exporting; it reads the one NODE_MODULES value in config/repository/tracked.ts. Values to config: NODE_MODULES = 'node_modules' -&gt; packages/cli/src/config/repository/tracked.ts

## `packages/cli/src/parsers/packages/public.ts`

- requirementName (function, 35-42): **move** to `packages/cli/src/parsers/dependency-files.ts` `requirementName`. Moves to parsers/dependency-files.ts, the dependency half of packages/public.ts (PAR-063); one regex replaces the three inline tests. Values to config: REQUIREMENT_NAME = /^\[A-Za-z0-9\](?:\[A-Za-z0-9.\_-\]\*\[A-Za-z0-9\])?$/u -&gt; packages/cli/src/config/parsers/dependency-files.ts
- poetryDependencies (function, 44-59): **move** to `packages/cli/src/parsers/dependency-files.ts` `poetryDependencies`. Moves to parsers/dependency-files.ts (PAR-063): packages/public.ts dependency half becomes dependency-files.ts.
- pythonDependencies (function, 61-86): **move** to `packages/cli/src/parsers/dependency-files.ts` `pythonDependencies`. Moves to parsers/dependency-files.ts (PAR-063): packages/public.ts dependency half becomes dependency-files.ts.
- parseRequirements (function, 88-102): **move** to `packages/cli/src/parsers/dependency-files.ts` `parseRequirements`. Moves to parsers/dependency-files.ts, the dependency half of packages/public.ts (PAR-063). Values to config: LINE_CONTINUATION = /\\\\\\r?\\n/gu -&gt; packages/cli/src/config/parsers/dependency-files.ts; INLINE_COMMENT = /\\s#/u -&gt; packages/cli/src/config/parsers/dependency-files.ts
- readers (const, 104-109): **move** to `packages/cli/src/parsers/dependency-files.ts` `readers`. Moves to parsers/dependency-files.ts, the dependency half of packages/public.ts (PAR-063); a table of functions stays module-level, because config/ may not import code.
- packageRuntimes (function, 111-120): **move** to `packages/cli/src/parsers/dependency-files.ts` `packageRuntimes`. Moves to parsers/dependency-files.ts (PAR-063): packages/public.ts dependency half becomes dependency-files.ts.
- parsePackageSummary (function, 122-137): **move** to `packages/cli/src/parsers/dependency-files.ts` `parsePackageJson`. Moves to parsers/dependency-files.ts as parsePackageJson (PAR-063): parsePackageSummary becomes parsePackageJson.
- parsePipfile (function, 139-146): **move** to `packages/cli/src/parsers/dependency-files.ts` `parsePipfile`. Moves to parsers/dependency-files.ts (PAR-063): packages/public.ts dependency half becomes dependency-files.ts.
- parsePyproject (function, 148-157): **move** to `packages/cli/src/parsers/dependency-files.ts` `parsePyproject`. Moves to parsers/dependency-files.ts (PAR-063): packages/public.ts dependency half becomes dependency-files.ts.
- parseSwiftPackage (function, 159-172): **move** to `packages/cli/src/parsers/dependency-files.ts` `parseSwiftPackage`. Moves to parsers/dependency-files.ts (PAR-063); PAR-082: commented-out .package lines must not count. Values to config: GIT_SUFFIX = '.git' -&gt; packages/cli/src/config/parsers/dependency-files.ts
- TSCONFIG_MEMO (const, 174-174): **move** to `packages/cli/src/parsers/tsconfig.ts` `TSCONFIG_MEMO`. Moves to parsers/tsconfig.ts (PAR-022: TypeScript project reading gets its own file); a per-run cache factory stays module-level.
- normalizedPythonPackage (function exported, 181-183): **move** to `packages/cli/src/parsers/dependency-files.ts` `normalizedPythonPackage`. Moves to parsers/dependency-files.ts (PAR-063); used by the Python dependency readers and tools/python. Values to config: PYTHON_NAME_SEPARATORS = /\[.\_-\]+/gu -&gt; packages/cli/src/config/parsers/dependency-files.ts
- normalizedPythonIdentity (function exported, 190-192): **move** to `packages/cli/src/parsers/dependency-files.ts` `normalizedPythonIdentity`. Moves to parsers/dependency-files.ts beside normalizedPythonPackage (PAR-063); one caller, the licenses check. Values to config: PYTHON_IDENTITY_NAME = /^\[^@\]+(?=@)/u -&gt; packages/cli/src/config/parsers/dependency-files.ts
- parseBunInstallSettings (function exported, 199-202): **inline** to `packages/cli/src/checks/general/dependencies/bun-release-age.ts` `installTable`. Inline into installTable in checks/general/dependencies/bun-release-age.ts; a two-line wrapper with one caller.
- parsePackageManifest (function exported, 210-219): **merge** to `packages/cli/src/parsers/json.ts` `readJson`. Merges into readJson in parsers/json.ts (PAR-040): one JSON reader that names the file and validates with a schema (callers pass packageJsonSchema); PAR-040: the path is always given.
- manifestParser (function exported, 226-229): **move** to `packages/cli/src/parsers/dependency-files.ts` `dependencyFileParser`. Moves to parsers/dependency-files.ts as dependencyFileParser (PAR-063: manifest means only manifest.toml); the requirements-file pattern is the existing REQUIREMENTS_FILE, which moves to config/parsers/dependency-files.ts. Values to config: REQUIREMENTS_FILE = /(?:^|\\/)requirements\[^/\]\*\\.txt$/u -&gt; packages/cli/src/config/parsers/dependency-files.ts
- getTsconfig (function exported, 238-254): **move** to `packages/cli/src/parsers/tsconfig.ts` `readTsconfig`. Moves to parsers/tsconfig.ts as readTsconfig (PAR-022; NMS-016): it reads files, so read not get.
- tsconfigProjects (function exported, 263-276): **move** to `packages/cli/src/parsers/tsconfig.ts` `tsconfigProjects`. Moves to parsers/tsconfig.ts (PAR-022): TypeScript project reading gets its own file.
- getTsconfigProject (function exported, 286-308): **move** to `packages/cli/src/parsers/tsconfig.ts` `readTsconfigProject`. Moves to parsers/tsconfig.ts as readTsconfigProject (PAR-022; NMS-016: it reads files, so read, not get). Values to config: TSCONFIG_FILE = 'tsconfig.json' -&gt; packages/cli/src/config/parsers/tsconfig.ts
- projectSources (function exported, 318-335): **move** to `packages/cli/src/parsers/tsconfig.ts` `projectSources`. Moves to parsers/tsconfig.ts (PAR-022): TypeScript project reading gets its own file.

## `packages/cli/src/parsers/public.ts`

- withoutPunctuation (function, 37-41): **move** to `packages/cli/src/checks/general/docs.ts` `withoutPunctuation`. Moves to checks/general/docs.ts (PAR-012): helper of pathTokens, which moves to its one caller.
- findJsonSyntaxFinding (function, 43-52): **move** to `packages/cli/src/checks/language/markdown.ts` `jsonSyntaxError`. Moves to checks/language/markdown.ts as jsonSyntaxError: the fence syntax reader moves to its one caller (PAR-066: a syntax error, not a finding). Values to config: CAMEL_CASE_BOUNDARY = /(?&lt;first&gt;\[a-z\])(?&lt;next&gt;\[A-Z\])/gu -&gt; packages/cli/src/config/checks/language/markdown.ts
- findTomlSyntaxFinding (function, 54-62): **move** to `packages/cli/src/checks/language/markdown.ts` `tomlSyntaxError`. Moves to checks/language/markdown.ts as tomlSyntaxError: the fence syntax reader moves to its one caller (PAR-066: a syntax error, not a finding).
- findYamlSyntaxFinding (function, 64-68): **move** to `packages/cli/src/checks/language/markdown.ts` `yamlSyntaxError`. Moves to checks/language/markdown.ts as yamlSyntaxError: the fence syntax reader moves to its one caller (PAR-066: a syntax error, not a finding).
- findTreeSyntaxFinding (function, 70-83): **move** to `packages/cli/src/checks/language/markdown.ts` `treeSyntaxError`. Moves to checks/language/markdown.ts as treeSyntaxError: the fence syntax reader moves to its one caller (PAR-066); PAR-046: Bash fences use it too; PAR-038: positionAt.
- readSharedJson (function, 86-94): **move** to `packages/cli/src/parsers/json.ts` `readJson`. Moves to parsers/json.ts as readJson (PAR-040): the one JSON reader for .json and .jsonc that names the file; two other readers merge into it. Values to config: JSONC_EXTENSION = '.jsonc' -&gt; packages/cli/src/config/parsers/json.ts
- codeFences (function exported, 101-113): **move** to `packages/cli/src/checks/language/markdown.ts` `codeFences`. Moves to checks/language/markdown.ts: the fence syntax reader moves to its one caller; PAR-047: drop meta and stop exporting once the quickstart is built from example.json and the docs test goes.
- proseLines (function exported, 120-131): **move** to `packages/cli/src/checks/general/docs.ts` `proseLines`. Moves to checks/general/docs.ts (PAR-012): one caller, the docs check; PAR-037: it returns NumberedLine. Values to config: TITLE_ATTRIBUTE = 'title=' -&gt; packages/cli/src/config/checks/general/docs.ts
- pathTokens (function exported, 138-151): **move** to `packages/cli/src/checks/general/docs.ts` `pathTokens`. Moves to checks/general/docs.ts (PAR-012): one caller, the docs check. Values to config: EMPHASIS_MARKERS = \['\*\*', '\*'\] -&gt; packages/cli/src/config/checks/general/docs.ts
- ruleSections (function exported, 158-173): **move** to `packages/cli/src/rules.ts` `ruleSections`. Moves to src/rules.ts (PAR-012): one caller, and agent-rules/ becomes src/rules.ts. Values to config: ALL_LEVEL_MARKER = '&lt;!-- level: all --&gt;' -&gt; packages/cli/src/config/rules.ts
- parseBashSyntaxResult (function exported, 180-185): **delete**. Delete (PAR-046): Bash fences use tree-sitter, so no process result is read.
- findFenceSyntaxFindings (function exported, 194-226): **move** to `packages/cli/src/checks/language/markdown.ts` `fenceSyntaxErrors`. Moves to checks/language/markdown.ts as fenceSyntaxErrors: one caller (PAR-066); PAR-046: the checkBash parameter goes; stop exporting; it shares JSONC_OPTIONS with parseJsonc. Values to config: JSON_FENCE_OPTIONS = { disallowComments: true, allowTrailingComma: false } -&gt; packages/cli/src/config/checks/language/markdown.ts; JSONC_OPTIONS = { allowTrailingComma: true } -&gt; packages/cli/src/config/parsers/json.ts; OMITTED_BASH_LINE = ':' -&gt; packages/cli/src/config/checks/language/markdown.ts; EMPTY_ARGUMENTS = '()' -&gt; packages/cli/src/config/checks/language/markdown.ts; PLACEHOLDER_VALUE = 'PLACEHOLDER' -&gt; packages/cli/src/config/checks/language/markdown.ts
- cleanPathToken (function exported, 233-235): **move** to `packages/cli/src/checks/general/docs.ts` `cleanPathToken`. Moves to checks/general/docs.ts (PAR-012): one caller, the docs check; it reuses LEADING_DOT_SLASH from config/parsers/output.ts (S08-006). Values to config: LEADING_DOT_SLASH = /^\\.\\//u -&gt; packages/cli/src/config/parsers/output.ts; TRAILING_SLASH = /\\/$/u -&gt; packages/cli/src/config/system/paths.ts
- parseJsonDocument (function exported, 243-253): **move** to `packages/cli/src/parsers/json.ts` `parseJsonDocument`. Moves to parsers/json.ts (PAR-040; PAR-036): returns Parsed&lt;T&gt;; two Xcode check callers.
- parseJsonRecord (function exported, 260-264): **merge** to `packages/cli/src/parsers/json.ts` `readJson`. Merges into readJson in parsers/json.ts (PAR-040): one JSON reader that requires an object and names the file.
- openJsonDocument (function exported, 272-292): **move** to `packages/cli/src/parsers/json.ts` `openJsonFile`. Moves to parsers/json.ts as openJsonFile (PAR-065): document means two things; PAR-084: keep the re-parse, drop the wrapper text that blames the field.
- parseJsonc (function exported, 300-309): **move** to `packages/cli/src/parsers/json.ts` `parseJsonc`. Moves to parsers/json.ts (PAR-040), which holds readJson, parseJsonc and openJsonFile. Values to config: JSONC_OPTIONS = { allowTrailingComma: true } -&gt; packages/cli/src/config/parsers/json.ts
- hasHeader (function exported, 316-319): **move** to `packages/cli/src/parsers/generated-header.ts` `hasGeneratedHeader`. Moves to parsers/generated-header.ts as hasGeneratedHeader (EXG-048): header text and its detection in one file; PAR-064: header means four things.

## `packages/cli/src/parsers/shebang.ts`

- parseShebang (function exported, 10-18): **keep** to `packages/cli/src/parsers/shebang.ts` `parseShebang`. Stays in parsers/shebang.ts, a file-format reader. Values to config: SHEBANG_PREFIX = '#!' -&gt; packages/cli/src/config/parsers/shebang.ts; ENV_SPLIT_FLAG = '-S' -&gt; packages/cli/src/config/parsers/shebang.ts

## `packages/cli/src/parsers/source/contracts.ts`

- isBashStatement (function, 20-25): **move** to `packages/cli/src/checks/general/structure/trivial-functions.ts` `isBashStatement`. Moves to the trivial-functions check (S08-002): after PAR-002 its only production user is that check. Values to config: BASH_COMMAND_NODES = \['command', 'declaration_command'\] -&gt; packages/cli/src/config/checks/general/structure.ts
- STATEMENT_COUNTS (const, 28-36): **move** to `packages/cli/src/checks/general/structure/trivial-functions.ts` `STATEMENT_COUNTS`. Moves with statement counting into the trivial-functions check (S08-002); a table of functions stays module-level, because config/ may not import code.
- isSubstantialFunction (function, 39-47): **move** to `packages/cli/src/checks/general/structure/trivial-functions.ts` `isSubstantialFunction`. Moves to the trivial-functions check (S08-002): after PAR-002 its only production user is that check.
- isSubstantialAssignment (function, 50-54): **move** to `packages/cli/src/checks/general/structure/trivial-functions.ts` `isSubstantialAssignment`. Moves to the trivial-functions check (S08-002): after PAR-002 its only production user is that check. Values to config: PYTHON_EXPORT_LIST = '\_\_all\_\_' -&gt; packages/cli/src/config/parsers/python.ts
- isNonReferenceAlias (function, 57-60): **move** to `packages/cli/src/checks/general/structure/trivial-functions.ts` `isNonReferenceAlias`. Moves to the trivial-functions check (S08-002): after PAR-002 its only production user is that check.
- SUBSTANCE (const, 63-75): **move** to `packages/cli/src/checks/general/structure/trivial-functions.ts` `SUBSTANCE`. Moves with statement counting into the trivial-functions check (S08-002); a table of functions stays module-level, because config/ may not import code.
- LANGUAGE_SUBSTANCE (const, 78-87): **move** to `packages/cli/src/checks/general/structure/trivial-functions.ts` `LANGUAGE_SUBSTANCE`. Moves with statement counting into the trivial-functions check (S08-002); a table of functions stays module-level, because config/ may not import code. Values to config: BASH_SOURCE_COMMANDS = \['source', '.'\] -&gt; packages/cli/src/config/checks/general/structure.ts
- isInert (function, 90-93): **move** to `packages/cli/src/checks/general/structure/trivial-functions.ts` `isInert`. Moves to the trivial-functions check (S08-002): after PAR-002 its only production user is that check.
- isSubstantial (function, 96-107): **move** to `packages/cli/src/checks/general/structure/trivial-functions.ts` `isSubstantial`. Moves to the trivial-functions check (S08-002): after PAR-002 its only production user is that check.
- exportList (function, 110-114): **move** to `packages/cli/src/parsers/python.ts` `exportList`. Moves to parsers/python.ts (PAR-007), beside exportedNames, which it helps. Values to config: PYTHON_EXPORT_LIST = '\_\_all\_\_' -&gt; packages/cli/src/config/parsers/python.ts
- executableStatements (function exported, 122-133): **move** to `packages/cli/src/checks/general/structure/trivial-functions.ts` `executableStatements`. Moves into the trivial-functions check and stops being exported (S08-002): after PAR-002 its callers are that check and a unit test, and the moved unit tests call trivialFunctions.
- isDocstring (function exported, 141-147): **move** to `packages/cli/src/parsers/python.ts` `isDocstring`. Moves to parsers/python.ts: parsers/python.ts uses it (docstringOf, pythonFunctions), and the trivial-functions check imports it from there; there is no statements.ts (S08-002).
- isTrivialFile (function exported, 156-162): **move** to `packages/cli/src/checks/general/structure/trivial-functions.ts` `isTrivialFile`. Moves into the trivial-functions check and stops being exported (S08-002): after PAR-002 the Bash parser does not call it.
- trivialText (function exported, 171-174): **move** to `packages/cli/src/checks/general/structure/trivial-functions.ts` `trivialText`. Moves to checks/general/structure/trivial-functions.ts (PAR-012): a finding message is check work; export it for checks/language/sql.ts.
- readPython (function exported, 181-194): **move** to `packages/cli/src/parsers/python.ts` `readPython`. Moves to parsers/python.ts (PAR-007: Python module reading gets its own file). Values to config: PYTHON_EXTENSION = '.py' -&gt; packages/cli/src/config/parsers/python.ts
- parsePythonModule (function exported, 203-214): **move** to `packages/cli/src/parsers/python.ts` `parsePythonModule`. Moves to parsers/python.ts (PAR-007): Python module reading gets its own file.
- assignmentOf (function exported, 221-224): **move** to `packages/cli/src/parsers/python.ts` `assignmentOf`. Moves to parsers/python.ts (PAR-007): Python module reading gets its own file.
- docstringOf (function exported, 231-237): **move** to `packages/cli/src/parsers/python.ts` `docstringOf`. Moves to parsers/python.ts (PAR-007): Python module reading gets its own file.
- getPythonFunctions (function exported, 244-257): **move** to `packages/cli/src/parsers/python.ts` `pythonFunctions`. Moves to parsers/python.ts as pythonFunctions (NMS-016: a pure lookup takes a noun, not get); PAR-048: stop exporting. Values to config: PYTHON_FUNCTION_NODES = \['function_definition', 'lambda'\] -&gt; packages/cli/src/config/parsers/python.ts
- exportedNames (function exported, 264-274): **move** to `packages/cli/src/parsers/python.ts` `exportedNames`. Moves to parsers/python.ts (PAR-007: Python module reading gets its own file); it shares SURROUNDING_QUOTES with elementAttributes. Values to config: SURROUNDING_QUOTES = /^\["'\]|\["'\]$/gu -&gt; packages/cli/src/config/text.ts
- disposePython (function exported, 280-282): **move** to `packages/cli/src/parsers/python.ts` `disposePython`. Moves to parsers/python.ts (PAR-007): Python module reading gets its own file.
- typescriptImports (function exported, 289-305): **move** to `packages/cli/src/generation/fragments.ts` `typescriptImports`. Moves to generation/fragments.ts (PAR-075): its one production caller; the fragments unit test imports it from there.
- typescriptNodes (function exported, 312-320): **move** to `packages/cli/src/parsers/typescript.ts` `typescriptNodes`. Moves to parsers/typescript.ts (PAR-007): callers are the Drizzle and Next.js checks.
- typescriptProgram (function exported, 327-342): **delete**. Delete: its users, parsers/css.ts (CKO-029) and the structure test-placement check, are deleted.

## `packages/cli/src/parsers/source/public.ts`

- PARSED_MEMO (const, 25-27): **delete**. Delete (PAR-081): one Map in the run cache replaces the three nested maps.
- TREE_MEMO (const, 29-29): **move** to `packages/cli/src/parsers/tree-sitter.ts` `TREE_MEMO`. Moves to parsers/tree-sitter.ts (PAR-007); a per-run cache factory stays module-level.
- state (const, 31-34): **move** to `packages/cli/src/parsers/tree-sitter.ts` `state`. Moves to parsers/tree-sitter.ts (PAR-007); it stays module-level: the running process holds the grammars it has opened here, so it is state, not a static value.
- build (function, 36-43): **move** to `packages/cli/src/parsers/tree-sitter.ts` `buildParser`. Moves to parsers/tree-sitter.ts as buildParser (PAR-007): build already names the CLI and site builds. Values to config: TREE_SITTER_WASM = 'web-tree-sitter.wasm' -&gt; packages/cli/src/config/system/assets.ts; GRAMMAR_FILE_EXTENSION = '.wasm' -&gt; packages/cli/src/config/system/assets.ts
- parseTree (function, 46-50): **move** to `packages/cli/src/parsers/tree-sitter.ts` `parseTree`. Moves to parsers/tree-sitter.ts; PAR-007; PAR-050 keeps the null-tree guard (parse() returns Tree or null).
- commentAt (function, 52-61): **move** to `packages/cli/src/parsers/comments.ts` `commentAt`. Moves to parsers/comments.ts (PAR-007; PAR-039): the nginx commentAt becomes nginxComment, so this one keeps the name.
- javascriptComments (function, 64-89): **move** to `packages/cli/src/parsers/comments.ts` `javascriptComments`. Moves to parsers/comments.ts (PAR-007): source/public.ts splits into tree-sitter.ts and comments.ts.
- quotedEnd (function, 92-99): **move** to `packages/cli/src/parsers/comments.ts` `quotedEnd`. Moves to parsers/comments.ts (PAR-039): one quotedEnd; export it for the nginx check.
- commentStart (function, 101-108): **move** to `packages/cli/src/parsers/comments.ts` `commentStart`. Moves to parsers/comments.ts (PAR-007: source/public.ts splits into tree-sitter.ts and comments.ts). Values to config: QUOTE_CHARACTERS = \["'", '"', '''\] -&gt; packages/cli/src/config/parsers/comments.ts
- scssComments (function, 111-117): **move** to `packages/cli/src/parsers/comments.ts` `scssComments`. Moves to parsers/comments.ts (PAR-007): source/public.ts splits into tree-sitter.ts and comments.ts.
- yamlComments (function, 120-139): **move** to `packages/cli/src/parsers/comments.ts` `yamlComments`. Moves to parsers/comments.ts (PAR-007: source/public.ts splits into tree-sitter.ts and comments.ts). Values to config: YAML_SCALAR_TOKENS = \['doc-mode', 'flow-error-end', 'scalar'\] -&gt; packages/cli/src/config/parsers/comments.ts
- sqlComments (function, 141-148): **move** to `packages/cli/src/parsers/comments.ts` `sqlComments`. Moves to parsers/comments.ts (PAR-007; PAR-038): use positionAt.
- markdownHtml (function, 151-164): **move** to `packages/cli/src/parsers/comments.ts` `markdownHtml`. Moves to parsers/comments.ts (PAR-007); PAR-039: it uses blankOut; PAR-050 keeps the position guard. Values to config: NOT_LINE_BREAK = /\[^\\r\\n\]/gu -&gt; packages/cli/src/config/text.ts
- tomlComments (function, 168-176): **move** to `packages/cli/src/parsers/comments.ts` `tomlComments`. Moves to parsers/comments.ts (PAR-007; PAR-051): read comments with the TOML parser instead of the regex.
- treeComments (function, 178-189): **move** to `packages/cli/src/parsers/comments.ts` `treeComments`. Moves to parsers/comments.ts (PAR-007: source/public.ts splits into tree-sitter.ts and comments.ts). Values to config: HTML_ALTERNATE_COMMENT_END = '--!&gt;' -&gt; packages/cli/src/config/parsers/comments.ts; COMMENT_NODES = \['comment', 'multiline_comment'\] -&gt; packages/cli/src/config/parsers/comments.ts
- COMMENT_READERS (const, 191-217): **move** to `packages/cli/src/parsers/comments.ts` `COMMENT_READERS`. Moves to parsers/comments.ts (PAR-007); a table of functions stays module-level, because config/ may not import code.
- parserFor (function exported, 224-231): **move** to `packages/cli/src/parsers/tree-sitter.ts` `parserFor`. Moves to parsers/tree-sitter.ts (TPP-017): only tests import it, so stop exporting, and tests call parseSource.
- parseSource (function exported, 240-254): **move** to `packages/cli/src/parsers/tree-sitter.ts` `parseSource`. Moves to parsers/tree-sitter.ts (PAR-007).
- visitParsedSources (function exported, 262-275): **move** to `packages/cli/src/parsers/tree-sitter.ts` `visitParsedSources`. Moves to parsers/tree-sitter.ts (PAR-007).
- grammarFor (function exported, 283-291): **move** to `packages/cli/src/parsers/tree-sitter.ts` `grammarFor`. Moves to parsers/tree-sitter.ts (PAR-007). Values to config: LANGUAGE_GRAMMARS = { bash: 'bash', swift: 'swift', python: 'python', javascript: 'javascript', typescript: 'typescript' } -&gt; packages/cli/src/config/parsers/tree-sitter.ts; TSX_EXTENSION = '.tsx' -&gt; packages/cli/src/config/parsers/tree-sitter.ts
- visitParsed (function exported, 300-343): **move** to `packages/cli/src/parsers/tree-sitter.ts` `visitParsed`. Moves to parsers/tree-sitter.ts (PAR-081): one cache map in the run's ReadCache, one path, no ParsedVisit handle.
- commentText (function exported, 350-354): **move** to `packages/cli/src/parsers/comments.ts` `commentText`. Moves to parsers/comments.ts (PAR-007). Values to config: BLOCK_COMMENT_END = /\\\*\\/\\s\*$/u -&gt; packages/cli/src/config/parsers/comments.ts; HTML\_COMMENT\_END = /--!?&gt;\\s\*$/u -&gt; packages/cli/src/config/parsers/comments.ts
- parseComments (function exported, 362-365): **move** to `packages/cli/src/parsers/comments.ts` `parseComments`. Moves to parsers/comments.ts (PAR-007; CKG-043): take the grammar name instead of a fake path.

## `packages/cli/src/parsers/sql/contracts.ts`

- parse (function exported, 10-19): **move** to `packages/cli/src/parsers/sql/postgres.ts` `parsePostgres`. Moves to parsers/sql/postgres.ts as parsePostgres (PAR-007): sql/contracts.ts and sql/public.ts become postgres.ts; PAR-036: returns Parsed; parseSql is already the local libpg-query alias.
- nodeOf (function exported, 27-33): **move** to `packages/cli/src/parsers/sql/postgres.ts` `nodeOf`. Moves to parsers/sql/postgres.ts (PAR-007): sql/contracts.ts and sql/public.ts become postgres.ts.
- nodesOf (function exported, 41-46): **move** to `packages/cli/src/parsers/sql/postgres.ts` `nodesOf`. Moves to parsers/sql/postgres.ts; PAR-007; CKO-024 adds walkSqlTree beside it.
- readStatement (function exported, 55-62): **move** to `packages/cli/src/parsers/sql/postgres.ts` `readStatement`. Moves to parsers/sql/postgres.ts (PAR-007): sql/contracts.ts and sql/public.ts become postgres.ts.
- partsOf (function exported, 69-71): **move** to `packages/cli/src/parsers/sql/postgres.ts` `partsOf`. Moves to parsers/sql/postgres.ts (PAR-007): sql/contracts.ts and sql/public.ts become postgres.ts.

## `packages/cli/src/parsers/sql/lexer.ts`

- lineEnd (function, 5-8): **keep** to `packages/cli/src/parsers/sql/lexer.ts` `lineEnd`. Stays in parsers/sql/lexer.ts.
- doubledQuoteEnd (function, 11-18): **keep** to `packages/cli/src/parsers/sql/lexer.ts` `doubledQuoteEnd`. Stays in parsers/sql/lexer.ts.
- escapedStringEnd (function, 21-29): **keep** to `packages/cli/src/parsers/sql/lexer.ts` `escapedStringEnd`. Stays in parsers/sql/lexer.ts.
- identifierEnd (function, 32-37): **keep** to `packages/cli/src/parsers/sql/lexer.ts` `identifierEnd`. Stays in parsers/sql/lexer.ts. Values to config: IDENTIFIER_START = /\[A-Za-z\_\]/u -&gt; packages/cli/src/config/parsers/sql.ts; WORD_CHARACTER = /\\w/u -&gt; packages/cli/src/config/parsers/sql.ts
- variableEnd (function, 40-48): **keep** to `packages/cli/src/parsers/sql/lexer.ts` `variableEnd`. Stays in parsers/sql/lexer.ts.
- escapedStringAt (function, 51-54): **keep** to `packages/cli/src/parsers/sql/lexer.ts` `escapedStringAt`. Stays in parsers/sql/lexer.ts. Values to config: WORD_CHARACTER = /\\w/u -&gt; packages/cli/src/config/parsers/sql.ts
- dollarAt (function, 57-61): **keep** to `packages/cli/src/parsers/sql/lexer.ts` `dollarAt`. Stays in parsers/sql/lexer.ts. Values to config: DOLLAR_TAG_BLOCKER = /\[\\p{L}\\p{N}\_$\]/u -&gt; packages/cli/src/config/parsers/sql.ts
- colonAt (function, 64-68): **keep** to `packages/cli/src/parsers/sql/lexer.ts` `colonAt`. Stays in parsers/sql/lexer.ts.
- READERS (const, 71-91): **keep** to `packages/cli/src/parsers/sql/lexer.ts` `READERS`. Stays in parsers/sql/lexer.ts; a table of functions stays module-level, because config/ may not import code.
- blockCommentEnd (function, 94-108): **keep** to `packages/cli/src/parsers/sql/lexer.ts` `blockCommentEnd`. Stays in parsers/sql/lexer.ts.
- lexemeEnd (function, 111-117): **keep** to `packages/cli/src/parsers/sql/lexer.ts` `lexemeEnd`. Stays in parsers/sql/lexer.ts.
- replacement (function, 120-125): **keep** to `packages/cli/src/parsers/sql/lexer.ts` `replacement`. Stays in parsers/sql/lexer.ts.
- sqlTokens (function exported, 132-144): **keep** to `packages/cli/src/parsers/sql/lexer.ts` `sqlTokens`. Stays in parsers/sql/lexer.ts; users comments.ts and maskPsqlSyntax.
- maskPsqlSyntax (function exported, 151-164): **keep** to `packages/cli/src/parsers/sql/lexer.ts` `maskPsqlSyntax`. Stays in parsers/sql/lexer.ts.

## `packages/cli/src/parsers/sql/migrations.ts`

- frozenMigrationPaths (function exported, 10-21): **keep** to `packages/cli/src/parsers/sql/migrations.ts` `frozenMigrationPaths`. Stays in parsers/sql/migrations.ts (PAR-012): generation uses it and may not import checks. Values to config: MIGRATION_NUMBER = /^\\d+$/u -&gt; packages/cli/src/config/parsers/sql.ts

## `packages/cli/src/parsers/sql/public.ts`

- SQL_MEMO (const, 9-9): **move** to `packages/cli/src/parsers/sql/postgres.ts` `SQL_MEMO`. Moves to parsers/sql/postgres.ts (PAR-007: sql/public.ts joins postgres.ts); a per-run cache factory stays module-level.
- statementView (function, 11-15): **move** to `packages/cli/src/parsers/sql/postgres.ts` `statementView`. Moves to parsers/sql/postgres.ts (PAR-007): sql/public.ts joins postgres.ts.
- parseSqlText (function, 22-41): **move** to `packages/cli/src/parsers/sql/postgres.ts` `parseSqlText`. Moves to parsers/sql/postgres.ts (PAR-007; PAR-053): count code points with codePointLength in src/text.ts, with one suppression.
- positionAt (function exported, 49-53): **move** to `packages/cli/src/text.ts` `positionAt`. Moves to src/text.ts (PAR-038): one shared line-and-column helper for SQL, Markdown fences and comments; it returns TextPosition { line, column }, a new plain type in types/text.ts beside NumberedLine, because generic text code may not use SqlFile; PAR-053 puts codePointLength beside it.
- parseSqlFile (function exported, 61-70): **move** to `packages/cli/src/parsers/sql/postgres.ts` `parseSqlFile`. Moves to parsers/sql/postgres.ts (PAR-007): sql/public.ts joins postgres.ts.

## `packages/cli/src/parsers/swift/contracts.ts`

- parseSwiftCoverage (function exported, 13-35): **move** to `packages/cli/src/checks/testing/swift-tests.ts` `parseSwiftCoverage`. Moves into the swift-tests check (PAR-016): the coverage helpers merge into the check, which is in the testing group (CKO-005, NMU-009). Values to config: SWIFT_TARGET_MODULE = 'SwiftTarget' -&gt; packages/cli/src/config/checks/testing.ts; TEST_TARGET_TYPE = 'test' -&gt; packages/cli/src/config/checks/testing.ts

## `packages/cli/src/parsers/swift/public.ts`

- accessorName (function, 10-17): **move** to `packages/cli/src/checks/general/structure/trivial-functions.ts` `accessorName`. Moves to the trivial-functions check with swiftFunctionName, which it helps. Values to config: SWIFT_ACCESSOR_OWNERS = \['property_declaration', 'subscript_declaration'\] -&gt; packages/cli/src/config/checks/general/structure.ts
- readSwift (function exported, 24-38): **delete**. Delete (PAR-001): dead in production; only tests call it.
- getSwiftFunctions (function exported, 45-64): **delete**. Delete (PAR-001): dead in production; only readSwift and a test call it.
- disposeSwift (function exported, 70-72): **delete**. Delete (PAR-001): dead in production; only tests call it.
- readSwiftVersion (function exported, 80-86): **move** to `packages/cli/src/generation/tool-file-sources/swiftformat.ts` `readSwiftVersion`. Moves into the SwiftFormat builder, which reads each scope's Swift version: etaInputs, its caller today, is deleted, and no generation/tool-file-values.ts is made. Values to config: PACKAGE_SWIFT = 'Package.swift' -&gt; packages/cli/src/config/parsers/dependency-files.ts; PBXPROJ_NAME = 'project.pbxproj' -&gt; packages/cli/src/config/parsers/xcode.ts
- swiftFunctionName (function exported, 93-96): **move** to `packages/cli/src/checks/general/structure/trivial-functions.ts` `swiftFunctionName`. Moves to checks/general/structure/trivial-functions.ts; one caller.

## `packages/cli/src/parsers/toml/contracts.ts`

- tablePath (function, 23-38): **rename** to `packages/cli/src/parsers/toml/comments.ts` `tablePath`. Stays as tablePath; its file becomes parsers/toml/comments.ts (PAR-007): toml/contracts.ts becomes toml/comments.ts.
- valueEntries (function, 40-53): **rename** to `packages/cli/src/parsers/toml/comments.ts` `valueEntries`. Stays as valueEntries; its file becomes parsers/toml/comments.ts (PAR-007): toml/contracts.ts becomes toml/comments.ts.
- tomlSyntax (function exported, 61-95): **rename** to `packages/cli/src/parsers/toml/comments.ts` `tomlSyntax`. Stays as tomlSyntax; its file becomes parsers/toml/comments.ts (PAR-007): toml/contracts.ts becomes toml/comments.ts.
- tomlCommentOwner (function exported, 103-119): **rename** to `packages/cli/src/parsers/toml/comments.ts` `tomlCommentAnchor`. Renamed tomlCommentAnchor and moved to parsers/toml/comments.ts (PAR-007): it returns the entry a comment is anchored to, and "owner" is filler outside the ownership log (glossary); PAR-048: stop exporting.
- emitTomlComments (function exported, 129-147): **rename** to `packages/cli/src/parsers/toml/comments.ts` `emitTomlComments`. Stays as emitTomlComments; its file becomes parsers/toml/comments.ts (PAR-007; PAR-020): add the shared addTomlComment beside it.
- tomlCommentOwners (function exported, 154-160): **rename** to `packages/cli/src/parsers/toml/comments.ts` `tomlCommentAnchors`. Renamed tomlCommentAnchors and moved to parsers/toml/comments.ts, which replaces toml/contracts.ts (PAR-007): "owner" is filler outside the ownership log (glossary).
- getKind (function exported, 167-171): **delete**. Delete (PAR-050): compare String(node.type) directly.
- isValue (function exported, 178-180): **rename** to `packages/cli/src/parsers/toml/comments.ts` `isValue`. Stays as isValue; its file becomes parsers/toml/comments.ts (PAR-007; PAR-050): test String(node.type) without getKind.
- isKeyValue (function exported, 187-189): **rename** to `packages/cli/src/parsers/toml/comments.ts` `isKeyValue`. Stays as isKeyValue; its file becomes parsers/toml/comments.ts (PAR-007; PAR-050): test String(node.type) without getKind.
- isComment (function exported, 196-198): **rename** to `packages/cli/src/parsers/toml/comments.ts` `isComment`. Moves to parsers/toml/comments.ts (PAR-050): the manifest table-order check, its only outside user, is deleted, so stop exporting.
- isInlineTable (function exported, 205-207): **rename** to `packages/cli/src/parsers/toml/comments.ts` `isInlineTable`. Stays as isInlineTable; its file becomes parsers/toml/comments.ts (PAR-007; PAR-050): test String(node.type) without getKind.
- isInlineArray (function exported, 214-216): **rename** to `packages/cli/src/parsers/toml/comments.ts` `isInlineArray`. Stays as isInlineArray; its file becomes parsers/toml/comments.ts (PAR-007; PAR-050): test String(node.type) without getKind.
- tomlRange (function exported, 223-226): **rename** to `packages/cli/src/parsers/toml/comments.ts` `tomlRange`. Stays as tomlRange; its file becomes parsers/toml/comments.ts; PAR-007; PAR-050 keeps this guard: range is optional in the library type.

## `packages/cli/src/parsers/toml/public.ts`

- getTomlTable (function, 11-34): **rename** to `packages/cli/src/parsers/toml/document.ts` `findTomlTable`. Renamed findTomlTable in parsers/toml/document.ts (PAR-007): toml/public.ts becomes toml/document.ts; NMS-016: get hides that it creates tables.
- openTomlDocument (function exported, 41-73): **rename** to `packages/cli/src/parsers/toml/document.ts` `openTomlFile`. Renamed openTomlFile and moved to parsers/toml/document.ts (PAR-065); PAR-084: delete the re-parse after each edit.
- parseTomlFile (function exported, 81-87): **rename** to `packages/cli/src/parsers/toml/document.ts` `parseTomlFile`. Stays as parseTomlFile; its file becomes parsers/toml/document.ts (PAR-007): toml/public.ts becomes toml/document.ts.
- patchToml (function exported, 96-148): **rename** to `packages/cli/src/parsers/toml/document.ts` `patchToml`. Stays as patchToml; its file becomes parsers/toml/document.ts (PAR-048): stop exporting; PAR-020: use the shared addTomlComment.

## `packages/cli/src/types/parsers/attributes.ts`

- AttributeRule (type exported, 1-1): **move** to `packages/cli/src/types/parsers/git.ts` `AttributeRule`. Moves to types/parsers/git.ts with the plain Git types; the one-line types/parsers/attributes.ts goes; one user, attributeRules.

## `packages/cli/src/types/parsers/bash.ts`

- ScriptFunction (type exported, 4-11): **keep** to `packages/cli/src/types/parsers/bash.ts` `ScriptFunction`. Stays in types/parsers/bash.ts as a plain type; PAR-002: drop the statements field.
- FunctionCall (type exported, 14-14): **keep** to `packages/cli/src/types/parsers/bash.ts` `FunctionCall`. Stays in types/parsers/bash.ts as a plain type, not exported: only other types in the same file use it.
- QuotedArgument (type exported, 17-17): **delete**. Delete (PAR-002): quotedArguments has no reader.
- CodeLine (type exported, 20-20): **merge** to `packages/cli/src/types/text.ts` `NumberedLine`. Merges into NumberedLine (PAR-037): one plain generic type for a line and its number, in types/text.ts.
- TemporaryPath (type exported, 23-23): **keep** to `packages/cli/src/types/parsers/bash.ts` `TemporaryPath`. Stays in types/parsers/bash.ts as a plain type; one user.
- TemporaryTargets (type exported, 26-26): **keep** to `packages/cli/src/types/parsers/bash.ts` `TemporaryTargets`. Stays in types/parsers/bash.ts as a plain type; one user.
- CleanupContext (type exported, 29-34): **keep** to `packages/cli/src/types/parsers/bash.ts` `CleanupContext`. Stays in types/parsers/bash.ts as a plain type; one user.
- ScriptSyntax (type exported, 37-44): **keep** to `packages/cli/src/types/parsers/bash.ts` `ScriptSyntax`. Stays in types/parsers/bash.ts as a plain type; PAR-002: drop quotedArguments and isTrivialFile; ScriptFile in the Bash checks extends it.
- BashParseOptions (type exported, 46-46): **delete**. Delete (PAR-002): minimumStatements goes, so parseBashScript takes (text, cache?).

## `packages/cli/src/types/parsers/cloudflare.ts`

- WranglerParse (type exported, 4-4): **merge** to `packages/cli/src/types/errors.ts` `Parsed`. Merges into Parsed (PAR-036): one value-or-error shape, Parsed&lt;T, E&gt;, a plain generic type in types/errors.ts.
- HeaderBlock (type exported, 7-7): **move** to `packages/cli/src/types/checks/platform.ts` `HeaderBlock`. Moves to types/checks/platform.ts with the Cloudflare check types: the \_headers reader moves into the Cloudflare check (PAR-011), and the check types are few, so there is one file per configuration group.
- HeaderBlocks (type exported, 10-10): **move** to `packages/cli/src/types/checks/platform.ts` `HeaderBlocks`. Moves to types/checks/platform.ts with the Cloudflare check types (PAR-011); PAR-066: findings become real Finding values in the check; the check types are few, so there is one file per configuration group.

## `packages/cli/src/types/parsers/comments.ts`

- SourceComment (type exported, 1-1): **keep** to `packages/cli/src/types/parsers/comments.ts` `SourceComment`. Stays in types/parsers/comments.ts as a plain type (PAR-007); users are the comment readers and the suppressions check.
- CommentReader (type exported, 4-4): **keep** to `packages/cli/src/types/parsers/comments.ts` `CommentReader`. Stays in types/parsers/comments.ts as a plain type; one user, COMMENT_READERS.

## `packages/cli/src/types/parsers/css.ts`

- CssClass (type exported, 2-2): **delete**. Delete: CKO-029 (owner rule): css/module-classes and parsers/css.ts are deleted.
- Importer (type exported, 5-5): **delete**. Delete: CKO-029 (owner rule): css/module-classes and parsers/css.ts are deleted.
- CssImporterSource (type exported, 8-8): **delete**. Delete: CKO-029 (owner rule): css/module-classes and parsers/css.ts are deleted.

## `packages/cli/src/types/parsers/docker.ts`

- ComposeService (type exported, 5-5): **move** to `packages/cli/src/types/checks/infrastructure.ts` `ComposeService`. Moves to types/checks/infrastructure.ts: every exported type is written by hand in types/, and composeSchema is checked with satisfies z.ZodType&lt;T&gt; (PAR-008, CKO-005).

## `packages/cli/src/types/parsers/document.ts`

- KeyPath (type exported, 2-2): **move** to `packages/cli/src/types/parsers/editable-file.ts` `KeyPath`. Moves to types/parsers/editable-file.ts, named for what it holds (PAR-065); users in parsers, settings, ownership and configurations, beside EditableFile.
- KeyChange (type exported, 5-5): **inline** to `packages/cli/src/types/ownership.ts` `FileEdit`. Inline into FileEdit in types/ownership.ts: its one user, EmittedToolFile, is renamed FileEdit (EXG-013, NMS-003), a plain type in types/ownership.ts.
- ConfigurationDocument (type exported, 8-13): **move** to `packages/cli/src/types/parsers/editable-file.ts` `EditableFile`. Moves to types/parsers/editable-file.ts as EditableFile (PAR-065): "document" means two things; the shared shape of the JSON and TOML editors.

## `packages/cli/src/types/parsers/eslint.ts`

- EslintAllRules (type exported, 5-5): **move** to `packages/cli/src/types/configurations.ts` `EslintAllRules`. Moves to types/configurations.ts: every exported type is written by hand in types/, and eslintAllRulesSchema (part of the manifest schema) is checked with satisfies z.ZodType&lt;T&gt; (PAR-009).
- EslintRuleNames (type exported, 8-8): **move** to `packages/cli/src/types/generation/eslint.ts` `RuleNamesFile`. Moves to types/generation/eslint.ts as RuleNamesFile, the one type of ruleNamesFileSchema (PAR-024: one schema and type for both rule-name files); every exported type is written by hand in types/.
- EslintPresets (type exported, 11-11): **move** to `packages/cli/src/types/generation/eslint.ts` `EslintPresets`. Moves to types/generation/eslint.ts: every exported type is written by hand in types/, and eslintPresetsSchema, which only generation/eslint reads (PAR-031), is checked with satisfies z.ZodType&lt;T&gt;.

## `packages/cli/src/types/parsers/git.ts`

- GitEntry (type exported, 5-5): **keep** to `packages/cli/src/types/parsers/git.ts` `GitEntry`. Stays in types/parsers/git.ts with its name: every exported type is written by hand in types/, and gitEntrySchema is checked with satisfies z.ZodType&lt;T&gt; (PAR-008).
- GitIndexEntry (type exported, 8-8): **keep** to `packages/cli/src/types/parsers/git.ts` `GitIndexEntry`. Stays in types/parsers/git.ts with its name: every exported type is written by hand in types/; users are the Git parser, repository and inventory.
- GitStream (type exported, 11-11): **keep** to `packages/cli/src/types/parsers/git.ts` `GitStream`. Stays in types/parsers/git.ts as a plain type; one user.

## `packages/cli/src/types/parsers/html.ts`

- MarkupAttribute (type exported, 3-3): **move** to `packages/cli/src/types/parsers/tree-sitter.ts` `MarkupAttribute`. Moves to types/parsers/tree-sitter.ts with the parsed source types: a plain type over a web-tree-sitter Node (types/ may import library types), returned by elementAttributes and read by the html check.

## `packages/cli/src/types/parsers/json.ts`

- JsonDocument (type exported, 2-2): **merge** to `packages/cli/src/types/errors.ts` `Parsed`. Merges into Parsed (PAR-036, PAR-065): one value-or-error shape, Parsed&lt;T, E&gt;, a plain generic type in types/errors.ts.

## `packages/cli/src/types/parsers/lockfiles.ts`

- ToolProjectLockfile (type, 5-5): **inline** to `packages/cli/src/types/parsers/lockfiles.ts` `ToolProjectLockfileName`. Inline into ToolProjectLockfileName in types/parsers/lockfiles.ts: only ToolProjectLockfileName uses it.
- BunPackage (type exported, 8-13): **move** to `packages/cli/src/types/tools/project.ts` `BunPackage`. Moves to types/tools/project.ts: every exported type is written by hand in types/, and bunPackageSchema is checked with satisfies z.ZodType&lt;T&gt;; one user, the Bun lockfile reader.
- Lockfile (type exported, 16-16): **keep** to `packages/cli/src/types/parsers/lockfiles.ts` `Lockfile`. Stays in types/parsers/lockfiles.ts as (typeof LOCKFILES)\[number\] (PAR-085): types/ may import config/.
- ToolProjectLockfileName (type exported, 19-19): **keep** to `packages/cli/src/types/parsers/lockfiles.ts` `ToolProjectLockfileName`. Stays in types/parsers/lockfiles.ts, derived from Lockfile; users are parsers/tool-project.ts and tools/npm/lockfiles.ts.
- LockfileName (type exported, 22-22): **delete**. Delete (PAR-085): its only user, parseLockfile, is deleted.

## `packages/cli/src/types/parsers/markdown.ts`

- RuleSection (type exported, 2-2): **move** to `packages/cli/src/types/rules.ts` `RuleSection`. Moves to types/rules.ts, which replaces types/agent-rules.ts, with ruleSections (PAR-012).
- FencedBlock (type exported, 5-5): **move** to `packages/cli/src/types/checks/language.ts` `FencedBlock`. Moves to types/checks/language.ts with the Markdown fence check types: the check types are few, so there is one file per configuration group; PAR-047: drop meta.
- FenceParser (type exported, 8-8): **move** to `packages/cli/src/types/checks/language.ts` `FenceParser`. Moves to types/checks/language.ts, derived from config as (typeof FENCE_PARSERS)\[keyof typeof FENCE_PARSERS\], so config/checks/language/markdown.ts imports no type; the check types are few, so there is one file per configuration group.
- FenceSyntaxFinding (type exported, 11-11): **move** to `packages/cli/src/types/checks/language.ts` `FenceSyntaxError`. Moves to types/checks/language.ts as FenceSyntaxError (PAR-066: a syntax error, not a finding); the check types are few, so there is one file per configuration group.
- FenceSyntaxReader (type exported, 14-16): **delete**. Delete (PAR-046): no Bash callback, so no reader type.

## `packages/cli/src/types/parsers/naming.ts`

- NamingTerms (type exported, 5-5): **move** to `packages/cli/src/types/checks/general.ts` `NamingDefaults`. Moves to types/checks/general.ts as NamingDefaults (CFG-035: naming/policy.json becomes naming/defaults.json): every exported type is written by hand in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt; (PAR-009).
- NamingLanguage (type exported, 8-8): **move** to `packages/cli/src/types/checks/general.ts` `NamingLanguage`. Moves to types/checks/general.ts: every exported type is written by hand in types/ (PAR-009).
- NamingOverride (type exported, 11-11): **move** to `packages/cli/src/types/checks/general.ts` `NamingOverride`. Moves to types/checks/general.ts: every exported type is written by hand in types/, and namingOverrideSchema is checked with satisfies z.ZodType&lt;T&gt; (PAR-009).
- Identifier (type exported, 14-25): **move** to `packages/cli/src/types/checks/general.ts` `Identifier`. Moves to types/checks/general.ts with the naming check types: the check types are few, so there is one file per configuration group; PAR-080: the display field kind becomes label.
- IdentifierDeclaration (type exported, 28-28): **move** to `packages/cli/src/types/checks/general.ts` `IdentifierDeclaration`. Moves to types/checks/general.ts with the naming check types, beside createIdentifier's other types: the check types are few, so there is one file per configuration group.
- SqlNamed (type exported, 31-31): **move** to `packages/cli/src/types/checks/general.ts` `SqlNamed`. Moves to types/checks/general.ts with the naming check types: the check types are few, so there is one file per configuration group (PAR-013); one user.
- ExtractSink (type exported, 34-34): **move** to `packages/cli/src/types/checks/general.ts` `ExtractSink`. Moves to types/checks/general.ts with the naming check types: shared by the extractors (PAR-013); the check types are few, so there is one file per configuration group.

## `packages/cli/src/types/parsers/nextjs.ts`

- NextSettingsFinding (type exported, 2-2): **delete**. Delete (PAR-066; PAR-011): the Next.js settings reader moves into its check and returns Finding.

## `packages/cli/src/types/parsers/nginx.ts`

- DirectiveScan (type exported, 1-1): **move** to `packages/cli/src/types/checks/infrastructure.ts` `DirectiveScan`. Moves to types/checks/infrastructure.ts with the nginx check types (PAR-083, CKO-005): the check types are few, so there is one file per configuration group; one user.

## `packages/cli/src/types/parsers/output.ts`

- OutputSpec (type exported, 13-13): **keep** to `packages/cli/src/types/parsers/output.ts` `OutputSpec`. Stays in types/parsers/output.ts with its name: every exported type is written by hand in types/, and outputSchema is checked with satisfies z.ZodType&lt;T&gt; (PAR-009, PAR-014).
- MarkdownlintEntry (type exported, 15-15): **keep** to `packages/cli/src/types/parsers/output.ts` `MarkdownlintEntry`. Stays in types/parsers/output.ts with its name: every exported type is written by hand in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt; (PAR-014).
- KnipReport (type exported, 16-16): **keep** to `packages/cli/src/types/parsers/output.ts` `KnipReport`. Stays in types/parsers/output.ts with its name: every exported type is written by hand in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt; (PAR-014).
- TypoEntry (type exported, 17-17): **keep** to `packages/cli/src/types/parsers/output.ts` `TypoEntry`. Stays in types/parsers/output.ts with its name: every exported type is written by hand in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt; (PAR-014).
- RegexParser (type exported, 20-20): **keep** to `packages/cli/src/types/parsers/output.ts` `RegexParser`. Stays in types/parsers/output.ts with its name: every exported type is written by hand in types/ (PAR-014); one user.
- OutputPaths (type exported, 21-21): **keep** to `packages/cli/src/types/parsers/output.ts` `OutputPaths`. Stays in types/parsers/output.ts as a plain type (PAR-014); users parseOutput and execution/command.
- ParsingCheck (type exported, 23-23): **keep** to `packages/cli/src/types/parsers/output.ts` `ParsingCheck`. Stays in types/parsers/output.ts with its name: every exported type is written by hand in types/; the parameter of parseOutput (PAR-014).
- Parsing (type exported, 24-24): **keep** to `packages/cli/src/types/parsers/output.ts` `Parsing`. Stays in types/parsers/output.ts with its name: every exported type is written by hand in types/; one user, the outputFormats table.
- JsonFindingSpec (type exported, 27-27): **keep** to `packages/cli/src/types/parsers/output.ts` `JsonFindingSpec`. Stays in types/parsers/output.ts with its name: every exported type is written by hand in types/ (PAR-014); one user.
- Finding (type exported, 29-29): **move** to `packages/cli/src/types/execution/check.ts` `Finding`. Moves to types/execution/check.ts with the check result types (PAR-006): a plain type with no schema, and every layer may import types/.
- FindingPlace (type exported, 32-32): **move** to `packages/cli/src/types/execution/check.ts` `FindingPlace`. Moves to types/execution/check.ts beside Finding, which it picks from (CKG-056).
- ValeAlert (type exported, 35-35): **move** to `packages/cli/src/types/checks/general.ts` `ValeAlert`. Moves to types/checks/general.ts with the prose check types: the Vale reader moves into the Vale check (PAR-015, CKG-027), and the check types are few, so there is one file per configuration group.
- OutputDescriptor (type exported, 38-43): **keep** to `packages/cli/src/types/parsers/output.ts` `OutputDescriptor`. Stays in types/parsers/output.ts with its name: every exported type is written by hand in types/; EXG-033 keeps the withholdOutput field, renamed redactsOutput.

## `packages/cli/src/types/parsers/packages.ts`

- PackageInstaller (type exported, 16-16): **move** to `packages/cli/src/types/parsers/dependency-files.ts` `NpmClient`. Moves to types/parsers/dependency-files.ts as NpmClient (NMS-009, PAR-023: manager is a banned term, so code says NpmClient): every exported type is written by hand in types/, and its schema is checked with satisfies z.ZodType&lt;T&gt;.
- PackageInstallerIdentity (type exported, 19-19): **move** to `packages/cli/src/types/parsers/dependency-files.ts` `NpmClientIdentity`. Moves to types/parsers/dependency-files.ts as NpmClientIdentity (NMS-009, PAR-023): every exported type is written by hand in types/.
- PackageInstallerDeclaration (type exported, 21-21): **move** to `packages/cli/src/types/parsers/dependency-files.ts` `NpmClientDeclaration`. Moves to types/parsers/dependency-files.ts as NpmClientDeclaration (NMS-009, PAR-023): every exported type is written by hand in types/; one user file.
- PackageJson (type exported, 23-23): **move** to `packages/cli/src/types/parsers/dependency-files.ts` `PackageJson`. Moves to types/parsers/dependency-files.ts (PAR-063): every exported type is written by hand in types/, and packageJsonSchema is checked with satisfies z.ZodType&lt;T&gt;.
- InstalledDependency (type exported, 26-26): **rename** to `packages/cli/src/types/parsers/dependency-files.ts` `InstalledDependency`. Stays in types/parsers/packages.ts, which is renamed in place to dependency-files.ts (glossary: dependency file is the one name): a plain dependency-file type beside DependencyMap and DependencyFile, instead of a one-type repository file.
- DependencyMap (type exported, 28-28): **rename** to `packages/cli/src/types/parsers/dependency-files.ts` `DependencyMap`. Stays in types/parsers/packages.ts, which is renamed in place to dependency-files.ts (glossary: dependency file is the one name); a plain type with users in parsers, repository and tools.
- PackageManifest (type exported, 31-37): **rename** to `packages/cli/src/types/parsers/dependency-files.ts` `DependencyFile`. Renamed DependencyFile (PAR-063, PAR-063; glossary: dependency file) in types/parsers/packages.ts, which is renamed in place to dependency-files.ts.
- ManifestParser (type exported, 40-40): **rename** to `packages/cli/src/types/parsers/dependency-files.ts` `DependencyFileParser`. Renamed DependencyFileParser (PAR-063) in types/parsers/packages.ts, which is renamed in place to dependency-files.ts; one user.
- PythonManifest (type exported, 42-42): **move** to `packages/cli/src/types/parsers/dependency-files.ts` `Pyproject`. Moves to types/parsers/dependency-files.ts as Pyproject (PAR-063): every exported type is written by hand in types/, and pyprojectSchema is checked with satisfies z.ZodType&lt;T&gt;.
- PoetrySettings (type exported, 44-44): **move** to `packages/cli/src/types/parsers/dependency-files.ts` `PoetrySettings`. Moves to types/parsers/dependency-files.ts: every exported type is written by hand in types/; one user.
- PackageToolProject (type exported, 47-52): **move** to `packages/cli/src/types/tools/project.ts` `NpmToolProject`. Moves to types/tools/project.ts as NpmToolProject (PAR-023; NMS-009: the field installer becomes npmClient): every exported type is written by hand in types/.
- TypeScriptConfiguration (type exported, 55-58): **move** to `packages/cli/src/types/parsers/tsconfig.ts` `TypeScriptConfiguration`. Moves to types/parsers/tsconfig.ts (PAR-022): every exported type is written by hand in types/.
- TypeScriptProject (type exported, 61-65): **move** to `packages/cli/src/types/parsers/tsconfig.ts` `TypeScriptProject`. Moves to types/parsers/tsconfig.ts (PAR-022): every exported type is written by hand in types/.

## `packages/cli/src/types/parsers/python.ts`

- PythonModule (type exported, 6-12): **keep** to `packages/cli/src/types/parsers/python.ts` `PythonModule`. Stays in types/parsers/python.ts: a plain type over web-tree-sitter nodes (PAR-007).
- PythonExports (type exported, 15-15): **keep** to `packages/cli/src/types/parsers/python.ts` `PythonExports`. Stays in types/parsers/python.ts: a plain type over web-tree-sitter nodes; one user.
- PythonFunction (type exported, 18-18): **keep** to `packages/cli/src/types/parsers/python.ts` `PythonFunction`. Stays in types/parsers/python.ts: a plain type over web-tree-sitter nodes; one user.
- ParsedPython (type exported, 21-21): **rename** to `packages/cli/src/types/parsers/python.ts` `PythonFiles`. Renamed PythonFiles (PAR names table: drop the Parsed prefix); stays in types/parsers/python.ts.
- PythonDocstringStyle (type exported, 24-24): **move** to `packages/cli/src/types/checks/language.ts` `PythonDocstringStyle`. Moves to types/checks/language.ts (PAR-072, CKO-004): every exported type is written by hand in types/, and docstringStyleSchema is checked with satisfies z.ZodType&lt;T&gt;.

## `packages/cli/src/types/parsers/sarif.ts`

- SarifRun (type exported, 4-4): **move** to `packages/cli/src/types/parsers/output.ts` `SarifRun`. Moves to types/parsers/output.ts (PAR-008, PAR-014): written by hand in types/, and sarifLogSchema is checked with satisfies z.ZodType&lt;SarifLog&gt;.
- SarifArtifactLocation (type exported, 5-5): **move** to `packages/cli/src/types/parsers/output.ts` `SarifArtifactLocation`. Moves to types/parsers/output.ts (PAR-008, PAR-014): written by hand in types/ with the other SARIF types.
- SarifPhysicalLocation (type exported, 6-6): **move** to `packages/cli/src/types/parsers/output.ts` `SarifPhysicalLocation`. Moves to types/parsers/output.ts (PAR-008, PAR-014): written by hand in types/ with the other SARIF types.

## `packages/cli/src/types/parsers/semgrep.ts`

- SemgrepReport (type exported, 5-5): **move** to `packages/cli/src/types/parsers/output.ts` `SemgrepReport`. Moves to types/parsers/output.ts (PAR-008, PAR-014): written by hand in types/, and semgrepReportSchema is checked with satisfies z.ZodType&lt;SemgrepReport&gt;.

## `packages/cli/src/types/parsers/settings.ts`

- SettingValueDeclaration (type exported, 18-18): **merge** to `packages/cli/src/types/settings/tables.ts` `SettingDeclaration`. Merges into the SettingDeclaration type in types/settings/tables.ts (A9, S09-012): each setting is declared once in TypeScript in settings/schema/tables.ts, and the declaration type is written by hand in types/.
- SettingPrimitive (type exported, 20-20): **merge** to `packages/cli/src/types/settings/tables.ts` `SettingDeclaration`. Merges into the SettingDeclaration type in types/settings/tables.ts (A9, S09-012): each setting is declared once in TypeScript in settings/schema/tables.ts, and the declaration type is written by hand in types/.
- SettingFields (type exported, 22-22): **delete**. Delete: record field descriptions of list items exist only so gspot set can write a record list from JSON; set writes single values and list items only, so SettingDeclaration has no record items.
- SettingItems (type exported, 24-24): **delete**. Delete: the record form of list items goes, because gspot set writes plain list items only; the item type of a list comes from its zod schema, so SettingDeclaration has no items field.
- SettingField (type exported, 26-27): **delete**. Delete: a typed record field exists only for record items, which gspot set does not write.

## `packages/cli/src/types/parsers/site.ts`

- WebManifest (type exported, 5-5): **move** to `packages/cli/src/types/checks/framework.ts` `WebManifest`. Moves to types/checks/framework.ts (PAR-008, CKG-029): every exported type is written by hand in types/, and webManifestSchema is checked with satisfies z.ZodType&lt;T&gt;.

## `packages/cli/src/types/parsers/source.ts`

- GrammarName (type exported, 4-4): **move** to `packages/cli/src/types/parsers/tree-sitter.ts` `GrammarName`. Moves to types/parsers/tree-sitter.ts, the topic name of parsers/tree-sitter.ts (PAR-007).
- ParseReads (type exported, 6-6): **move** to `packages/cli/src/types/parsers/tree-sitter.ts` `ParseCache`. Moves to types/parsers/tree-sitter.ts as ParseCache (PAR-079): a read cache plus a cleanup stack; parameter cache.
- SourceInput (type exported, 9-9): **move** to `packages/cli/src/types/parsers/tree-sitter.ts` `SourceInput`. Moves to types/parsers/tree-sitter.ts, the topic name of parsers/tree-sitter.ts (PAR-007).
- ParsedFile (type exported, 12-12): **move** to `packages/cli/src/types/parsers/tree-sitter.ts` `ParsedFile`. Moves to types/parsers/tree-sitter.ts, the topic name of parsers/tree-sitter.ts (PAR-007); part of ParsedSourceInput; its other user, structure/config-logic, goes.
- ParsedSourceInput (type exported, 15-15): **move** to `packages/cli/src/types/parsers/tree-sitter.ts` `ParsedSourceInput`. Moves to types/parsers/tree-sitter.ts, the topic name of parsers/tree-sitter.ts (PAR-007).
- ParsedSource (type exported, 18-18): **move** to `packages/cli/src/types/parsers/tree-sitter.ts` `SourceTree`. Moves to types/parsers/tree-sitter.ts as SourceTree (PAR names table: drop the Parsed prefix).
- ProseLine (type exported, 20-20): **merge** to `packages/cli/src/types/text.ts` `NumberedLine`. Merges into NumberedLine (PAR-037): one plain generic type for a line and its number, in types/text.ts.
- ParserState (type exported, 23-26): **move** to `packages/cli/src/types/parsers/tree-sitter.ts` `ParserState`. Moves to types/parsers/tree-sitter.ts, the topic name of parsers/tree-sitter.ts; one user.
- NumberedLine (type exported, 29-29): **move** to `packages/cli/src/types/text.ts` `NumberedLine`. Moves to types/text.ts as a plain generic type (PAR-037: fields {number, text}), beside TextPosition, which positionAt in src/text.ts returns; users are parsers/bash.ts and the docs and Cloudflare checks.
- ParsedVisit (type exported, 32-32): **delete**. Delete (PAR-081): visitParsed returns the value; the run's DisposableStack frees it.

## `packages/cli/src/types/parsers/sql.ts`

- SqlToken (type exported, 4-8): **keep** to `packages/cli/src/types/parsers/sql.ts` `SqlToken`. Stays in types/parsers/sql.ts: a plain type (or a library type from @pgsql/types); one user.
- SqlRange (type exported, 11-11): **keep** to `packages/cli/src/types/parsers/sql.ts` `SqlRange`. Stays in types/parsers/sql.ts: a plain type (or a library type from @pgsql/types), produced by the lexer and read by SqlFile.
- PreparedSql (type exported, 14-14): **keep** to `packages/cli/src/types/parsers/sql.ts` `PreparedSql`. Stays in types/parsers/sql.ts: a plain type (or a library type from @pgsql/types); one user.
- SqlNodeFields (type exported, 17-17): **keep** to `packages/cli/src/types/parsers/sql.ts` `SqlNodeFields`. Stays in types/parsers/sql.ts: a plain type (or a library type from @pgsql/types) of sql/postgres.ts (PAR-007).
- SqlParse (type exported, 20-22): **move** to `packages/cli/src/types/errors.ts` `Parsed`. Becomes Parsed&lt;T, E&gt; in types/errors.ts (PAR-036): one value-or-error shape, a plain generic type; SqlParse carries the error type parameter for the SQL offset, so it is the one row that creates Parsed, and three other result types merge into it.
- SqlStatementView (type exported, 25-27): **keep** to `packages/cli/src/types/parsers/sql.ts` `SqlStatementView`. Stays in types/parsers/sql.ts: a plain type (or a library type from @pgsql/types) of sql/postgres.ts (PAR-007).
- SqlStatementReaders (type exported, 30-32): **keep** to `packages/cli/src/types/parsers/sql.ts` `SqlStatementReaders`. Stays in types/parsers/sql.ts: a plain type (or a library type from @pgsql/types) of sql/postgres.ts (PAR-007).
- SqlFile (type exported, 35-40): **keep** to `packages/cli/src/types/parsers/sql.ts` `SqlFile`. Stays in types/parsers/sql.ts: a plain type (or a library type from @pgsql/types) of sql/postgres.ts (PAR-007).

## `packages/cli/src/types/parsers/statements.ts`

- CountedLanguage (type exported, 3-3): **move** to `packages/cli/src/types/checks/general.ts` `CountedLanguage`. Moves to types/checks/general.ts: statement counting joins the trivial-functions check (S08-002); it is written as keyof typeof CONVENTION_QUERIES (the glossary retires "house"), so config/checks/general/structure.ts imports no type.
- IsSubstantial (type exported, 5-5): **move** to `packages/cli/src/types/checks/general.ts` `IsSubstantial`. Moves to types/checks/general.ts with statement counting (S08-002); one user.

## `packages/cli/src/types/parsers/stylelint.ts`

- StylelintModule (type exported, 2-4): **move** to `scripts/types/rule-lists.ts` `StylelintModule`. Moves to scripts/types/rule-lists.ts, the types of scripts/update-rule-lists.ts (PAR-031): only the rule-list script reads it.

## `packages/cli/src/types/parsers/supabase.ts`

- SupabaseConfiguration (type exported, 5-5): **move** to `packages/cli/src/types/checks/platform.ts` `SupabaseConfiguration`. Moves to types/checks/platform.ts (PAR-008, CKO-004): every exported type is written by hand in types/, and supabaseProjectSchema is checked with satisfies z.ZodType&lt;T&gt;.
- DenoLintReport (type exported, 8-8): **move** to `packages/cli/src/types/checks/platform.ts` `DenoLintReport`. Moves to types/checks/platform.ts (PAR-008, CKO-004): every exported type is written by hand in types/, and denoLintReportSchema is checked with satisfies z.ZodType&lt;T&gt;.
- SupabaseConfigurationRead (type exported, 11-11): **merge** to `packages/cli/src/types/errors.ts` `Parsed`. Merges into Parsed (PAR-036): one value-or-error shape, Parsed&lt;T, E&gt;, a plain generic type in types/errors.ts.

## `packages/cli/src/types/parsers/swift/coverage.ts`

- CoverageReport (type exported, 5-5): **move** to `packages/cli/src/types/checks/testing.ts` `CoverageReport`. Moves to types/checks/testing.ts (PAR-016, CKO-005): every exported type is written by hand in types/, and the xccov schema of the swift-tests check is checked with satisfies z.ZodType&lt;T&gt;.

## `packages/cli/src/types/parsers/swift/source.ts`

- SwiftFunction (type exported, 5-5): **delete**. Delete (PAR-001): the Swift function reader is dead.
- SwiftSource (type exported, 8-8): **delete**. Delete (PAR-001): the Swift function reader is dead.
- ParsedSwift (type exported, 11-11): **delete**. Delete (PAR-001): the Swift function reader is dead.
- SwiftVersionInput (type exported, 14-14): **move** to `packages/cli/src/types/generation/files.ts` `SwiftVersionInput`. Moves to types/generation/files.ts with the emit inputs: one type that goes with readSwiftVersion (PAR-011).

## `packages/cli/src/types/parsers/toml.ts`

- TomlBlock (type exported, 5-5): **keep** to `packages/cli/src/types/parsers/toml.ts` `TomlBlock`. Stays in types/parsers/toml.ts: a plain type (or one built from the toml-patch library); one user file.
- KeyValue (type exported, 7-7): **rename** to `packages/cli/src/types/parsers/toml.ts` `TomlKeyValue`. Renamed TomlKeyValue, because a bare KeyValue says nothing outside the TOML file; stays in types/parsers/toml.ts.
- Value (type exported, 9-9): **rename** to `packages/cli/src/types/parsers/toml.ts` `TomlValue`. Renamed TomlValue, because a bare Value says nothing outside the TOML file; stays in types/parsers/toml.ts.
- Kinded (type exported, 12-12): **delete**. Delete (PAR-050): getKind goes.
- NodeKind (type exported, 15-15): **delete**. Delete (PAR-050): NODE_KINDS goes.
- InlineTable (type exported, 17-17): **keep** to `packages/cli/src/types/parsers/toml.ts` `InlineTable`. Stays in types/parsers/toml.ts: a plain type (or one built from the toml-patch library); one user file.
- InlineArray (type exported, 19-19): **keep** to `packages/cli/src/types/parsers/toml.ts` `InlineArray`. Stays in types/parsers/toml.ts: a plain type (or one built from the toml-patch library); one user file.
- Comment (type exported, 21-21): **rename** to `packages/cli/src/types/parsers/toml.ts` `TomlCommentNode`. Renamed TomlCommentNode, one name per concept, because TomlComment already names the kept comment text; stays in types/parsers/toml.ts.
- SourceRange (type exported, 24-24): **keep** to `packages/cli/src/types/parsers/toml.ts` `SourceRange`. Stays in types/parsers/toml.ts: a plain type (or one built from the toml-patch library); one user, tomlRange.
- TomlInput (type exported, 27-27): **keep** to `packages/cli/src/types/parsers/toml.ts` `TomlInput`. Stays in types/parsers/toml.ts: a plain type (or one built from the toml-patch library); one user file.
- TomlTableOptions (type exported, 30-30): **keep** to `packages/cli/src/types/parsers/toml.ts` `TomlTableOptions`. Stays in types/parsers/toml.ts: a plain type (or one built from the toml-patch library); one user, findTomlTable.
- TomlSyntaxEntry (type exported, 33-37): **keep** to `packages/cli/src/types/parsers/toml.ts` `TomlSyntaxEntry`. Stays in types/parsers/toml.ts: a plain type (or one built from the toml-patch library); one user file.
- TomlSyntax (type exported, 40-45): **keep** to `packages/cli/src/types/parsers/toml.ts` `TomlSyntax`. Stays in types/parsers/toml.ts: a plain type (PAR-007); users are TOML editing and the settings layout.
- TomlComment (type exported, 48-48): **keep** to `packages/cli/src/types/parsers/toml.ts` `TomlComment`. Stays in types/parsers/toml.ts as a plain type, not exported: only other types in the same file use it (PAR-048).
- TomlCommentBlock (type exported, 51-51): **keep** to `packages/cli/src/types/parsers/toml.ts` `TomlCommentBlock`. Stays in types/parsers/toml.ts as a plain type, not exported: only other types in the same file use it (PAR-048).
- TomlComments (type exported, 54-54): **keep** to `packages/cli/src/types/parsers/toml.ts` `TomlComments`. Stays in types/parsers/toml.ts: a plain type (PAR-007); users are TOML editing and the settings comments and layout.
- TomlTablePositions (type exported, 57-61): **keep** to `packages/cli/src/types/parsers/toml.ts` `TomlTablePositions`. Stays in types/parsers/toml.ts: a plain type (or one built from the toml-patch library); one user, tablePath.
- TomlCommentOwner (type exported, 64-64): **rename** to `packages/cli/src/types/parsers/toml.ts` `TomlCommentAnchor`. Renamed TomlCommentAnchor ("owner" is filler outside the ownership log, glossary); it stays with the other TOML comment types instead of a one-type settings file; one user, settings/comments.ts.
- TomlTextChunk (type exported, 67-67): **keep** to `packages/cli/src/types/parsers/toml.ts` `TomlTextChunk`. Stays in types/parsers/toml.ts: a plain type (or one built from the toml-patch library); one user, patchToml.
- TomlOwnedComment (type exported, 70-70): **rename** to `packages/cli/src/types/parsers/toml.ts` `TomlAnchoredComment`. Renamed TomlAnchoredComment ("owner" is filler outside the ownership log, glossary), and its field owner becomes anchor; stays in types/parsers/toml.ts; one user file.

## `packages/cli/src/types/parsers/tool.ts`

- InstallerPin (type exported, 4-4): **move** to `packages/cli/src/types/configurations.ts` `InstallerPin`. Moves to types/configurations.ts with the manifest types: a plain type, and installerPinSchema goes (PAR-006).
- ToolPin (type exported, 7-7): **move** to `packages/cli/src/types/configurations.ts` `ToolDeclaration`. Moves to types/configurations.ts as ToolDeclaration (NMS-003: it is the whole \[\[tool\]\] declaration, not a pin): every exported type is written by hand in types/, and toolSchema is checked with satisfies z.ZodType&lt;T&gt;.
- ParsedToolVersion (type exported, 10-10): **move** to `packages/cli/src/types/tools/find.ts` `ParsedToolVersion`. Moves to types/tools/find.ts with the tool inspection types (ToolState, ToolInspection): a plain type; parseVersionOutput moves to tools/versions.ts (PAR-011), and PAR-036 keeps its three states.

## `packages/cli/src/types/parsers/typescript.ts`

- TypescriptImports (type exported, 2-2): **move** to `packages/cli/src/types/generation/fragments.ts` `TypescriptImports`. Moves to types/generation/fragments.ts with the fragment types (PAR-075).

## `packages/cli/src/types/parsers/xcode.ts`

- ProjectRoot (type exported, 4-4): **keep** to `packages/cli/src/types/parsers/xcode.ts` `ProjectRoot`. Stays in types/parsers/xcode.ts with its name: every exported type is written by hand in types/ (PAR-011).
- ProjectEntry (type exported, 6-6): **keep** to `packages/cli/src/types/parsers/xcode.ts` `ProjectEntry`. Stays in types/parsers/xcode.ts with its name: every exported type is written by hand in types/, and pbxprojSchema is checked with satisfies z.ZodType&lt;T&gt; (PAR-011).
- ProjectMetadata (type exported, 8-8): **keep** to `packages/cli/src/types/parsers/xcode.ts` `ProjectMetadata`. Stays in types/parsers/xcode.ts with its name: every exported type is written by hand in types/ (PAR-011); one user.
- XcodeProject (type exported, 10-16): **keep** to `packages/cli/src/types/parsers/xcode.ts` `XcodeProject`. Stays in types/parsers/xcode.ts with its name: every exported type is written by hand in types/ (PAR-011); one user.
- Folder (type exported, 18-18): **keep** to `packages/cli/src/types/parsers/xcode.ts` `Folder`. Stays in types/parsers/xcode.ts as a plain type (PAR-011); one user.
- ProjectSources (type exported, 21-21): **keep** to `packages/cli/src/types/parsers/xcode.ts` `ProjectSources`. Stays in types/parsers/xcode.ts as a plain type (PAR-011); one user.
- ProjectBuildSettings (type exported, 24-24): **keep** to `packages/cli/src/types/parsers/xcode.ts` `ProjectBuildSettings`. Stays in types/parsers/xcode.ts as a plain type (PAR-011); one user file.
