# Shipped language, framework, library, infrastructure, platform, testing, and database configurations

Besides `general/`, `packages/cli/configurations/` holds seven configuration groups: `language/` (9
configurations), `framework/` (12), `library/` (9), `infra/` (6), `platform/` (2), `test/` (4), and `database/` (1);
the groups `infra/` and `test/` become `infrastructure/` and `testing/`. Each configuration folder has a
`manifest.toml` (what to detect, which tools to pin, which checks to run, which tool files to write), rule files
(`rules/*.md`), the sources of its tool files (today `.eta` files), and some have Semgrep packs, ESLint fragments,
and frozen rule lists. The target: Eta goes for all 132 `.eta` files of every group, general included (CFL-001);
each manifest holds data only and no field that only a test or the docs site reads; each rule is said once, in
the file that holds its topic.

## Findings

### CFL-001: Replace Eta with plain files and TypeScript functions

- Where: all 132 `*.eta` files under `packages/cli/configurations/`; `packages/cli/src/generation/compilation/public.ts:2,177,186-267`; `packages/cli/src/generation/fragments.ts`; `packages/cli/src/generation/tool-files.ts:62-84`; `packages/cli/src/types/generation/eta.ts` (the 60-field `EtaInputs`); `packages/cli/src/config/generation/eta.ts:3-9` (`ETA_OPTIONS`); `packages/cli/package.json:58` (`eta`); `packages/cli/src/parsers/schema/configurations.ts:106-114` (default `source` is `<target>.eta`); `tests/cli/generation/every-template.test.ts`
- Kind: simplify
- Problem: gspot writes its tool files by running `.eta` files through Eta, a library that runs the JavaScript between `<%` and `%>` in a text file. 61 of the 132 files hold no Eta code at all; 5 print a fixed JavaScript object; 3 are one line that calls TypeScript; the other 63 are JavaScript programs stored as text, which no type check, lint, or naming check reads. Every file sees about 60 inputs as bare names (`useWith: true`), so a reader cannot tell where `isAll` or `rulesOff` comes from. Each file must also call `recordRules(document)` by hand, and the generator throws at run time when one forgets (`tool-files.ts:83-84`). `every-template.test.ts` exists only to prove that the text prints parseable JSON, YAML, TOML, and INI.
- Fix: Convert every file and delete Eta; no `.eta` file stays. Do steps 1 and 2 first (they only delete and rename), then step 3 one file per commit.
    1. Static files: drop the `.eta` suffix and copy the file byte for byte with its header: the Vale styles with no Eta code (into `general/prose/vale/styles/gspot/`, CFG-025), `syncpack.json`, `gitleaks.toml`, `zizmor.yml`, `markdownlint-cli2.mjs`, `trivyignore`, and the Semgrep packs as plain YAML (`semgrep/bash.yml`, `swift.yml`, `express.yml`, `fastapi.yml`, `javascript.yml`, `supabase.yml`, `cloudflare.yml`). Rewrite the four packs that build a JavaScript object as YAML. Two packs keep one value set in TypeScript: the `jsonwebtoken` rule of `javascript.yml` (only when the scope depends on it) and the functions folder of `supabase.yml`. For a file with `rule_keys`, the generator parses the YAML it read and takes the rule list from it, so `recordRules` goes. The default `source` in `toolFileSchema` becomes the plain target name, and the folder discovery in `configurations/public.ts:91-122` changes the same way. Update `tests/tools/configurations/general/prose/styles.test.ts:26,56,91,117`, which read styles by file name. Files that other findings delete are not converted: the deleted Vale styles, `trivy-findings.tpl.eta` (S5C-018), and `tsconfig.json.eta`, which goes with its tool file (GEN-018); `buildTsconfig` stays only for the file `runTsc` writes at run time.
    2. One-line files: the generator calls the TypeScript directly: `buildJsconfig` (`generation/jsconfig.ts`) for `jsconfig.json`, and `prettierConfiguration` (`generation/formatting.ts`) for `prettier.json` and the root `prettier.config.mjs` (CFG-001). Delete `jsconfig.json.eta`, `prettier.json.eta`, and `pointer.mjs.eta`.
    3. Every other file becomes one typed function that returns a plain object or lines, printed by the existing `json`, `yaml`, and `toml` printers: `packages/cli/src/generation/tool-file-sources/<tool>.ts` (`ruffToolFile`, `shellcheckToolFile`, `hadolintToolFile`, `swiftlintToolFile`, `htmlValidateToolFile`, ...); the Vale files in `packages/cli/src/generation/prose.ts` (`valeIniToolFile`, `acceptedWordsToolFile`, and nine styles); EditorConfig and prettierignore in `generation/formatting.ts`; the ESLint file in `generation/eslint/configuration.ts` (`eslintConfiguration`); and each ESLint fragment in `generation/eslint/fragments/<configuration>.ts` (`astroFragment`, `reactFragment`, ...), which returns its imports and blocks. Each function takes a typed input with only the fields it reads and holds only code that depends on settings (limits, level, your own options). Its fixed rule tables, globs, ignore lists, and options go to `packages/cli/src/config/generation/` (see Layout). The `[[tool_file]]` of a function keeps `target`, `tool`, and `per_scope`; its `source` field goes.
       Then delete the `eta` dependency, `ETA_OPTIONS`, `EtaInputs`, `etaInputs()`, the `recordRules` throw, and the JSON, YAML, TOML, and INI part of `every-template.test.ts`. Keep its parse check for the JavaScript files gspot still writes as text: `eslint.config.mjs`, `commitlint.config.cjs`, `markdownlint-cli2.mjs`, `purgecss.config.mjs`, and `prettier.config.mjs`. No new test: the existing generation tests move with the functions they test.
- Size: large

### CFL-002: Level-`all` ESLint rules are gated twice, and a test pins the layout

- Where: `language/javascript/eslint.config.mjs.eta:39-102` (`levelRules`, both branches), `:191`; `framework/react-native/eslint.fragment.js.eta:3`; `framework/expo/eslint.fragment.js.eta:2`; `framework/astro/eslint.fragment.js.eta:5`; `framework/react/eslint.fragment.js.eta:5`; `framework/vue/eslint.fragment.js.eta:9`; `library/translations/eslint.fragment.js.eta:2-4`; `test/jest/eslint.fragment.js.eta:2`; `test/vitest/eslint.fragment.js.eta:2`; every `eslint_all_rules` list; `packages/cli/src/generation/eslint/public.ts:113-118`; `tests/cli/generation/eslint/levels.test.ts:172-199`
- Kind: simplify
- Problem: a rule that runs only at level `all` is marked twice. Each manifest lists it in `eslint_all_rules`, and `eslintModule.block()` already turns every listed rule off at level recommended (`public.ts:117`: `!isAll && allRules.has(name) ? 'off' : value`). The files then also wrap the same rules in `isAll ? {...} : {...}`, and the JavaScript file writes the whole "off" list by hand (`:92-102`, 33 rules, every one of them in the javascript list). The same double gate is in react-native (3 rules), expo (`expo/prefer-box-shadow`), astro (4), translations (`i18next/no-literal-string`), jest and vitest (`prefer-strict-equal`). A test parses the compiled file with the TypeScript compiler to force every listed rule into an `IS_ALL` branch: a test of code layout, not of behavior. A size exception allows the extra bytes.
- Fix: Keep the manifest list (`eslint_all_rules`, `[eslint] all_level_rules` after NMU-071) as the one place that marks level-`all` rules. In the ESLint functions of CFL-001, turn each rule on once with no `isAll` wrap: delete the hand-written off branch (`:92-102`) and use the `all` values; delete the `isAll` wraps listed above; replace `testRuleNames.filter((name) => isAll || name !== 'prefer-strict-equal')` with `testRuleNames`. Keep `isAll` only where it does not switch a rule on or off (plugin imports, option values). Delete the test "authored all-only rule literals belong to the explicit level branch" (`levels.test.ts:172-199`) and drop the size exception. Add the five rules of S5C-009 to their lists in the same change. Do after TGN-002.
- Size: medium

### CFL-003: `eslint_all_rules` lists 18 rules whose entry changes nothing

- Where: `language/javascript/manifest.toml:7-217`; `framework/svelte/manifest.toml:4`; `framework/vue/manifest.toml:5`
- Kind: delete
- Problem: the list turns rules off at level recommended, so a rule that is never on needs no entry. Never turned on anywhere (the unicorn preset has them off and no file turns them on): `unicorn/consistent-destructuring`, `unicorn/custom-error-definition`, `unicorn/no-invalid-file-input-accept`, `unicorn/no-keyword-prefix`, `unicorn/no-unused-properties`, `unicorn/prefer-import-meta-properties`, `unicorn/prefer-iterator-concat`, `unicorn/require-post-message-target-origin`, `unicorn/string-content`, `unicorn/try-complexity`, `svelte/block-lang`, `vue/block-lang`. Off at both levels through the main block (`eslint.config.mjs.eta:179-191`): `unicorn/no-null`, `unicorn/prevent-abbreviations`, `unicorn/filename-case`, `unicorn/no-useless-undefined`, `unicorn/import-style`, and `unicorn/prefer-export-from` (off at `all` through `:191`, off at recommended through the list).
- Fix: Delete the 18 entries (16 in javascript, 1 in svelte, 1 in vue). In the ESLint rule table (CFL-017), write `'unicorn/prefer-export-from': 'off'` with no level condition.
- Size: small

### CFL-006: ESLint selectors are attached in two ways, one through hidden merge code

- Where: `packages/cli/src/configurations/public.ts:107-122`; `[[tool_file]] source = "eslint.fragment.js.eta"` blocks in `framework/react-native/manifest.toml:57-59`, `framework/nextjs/manifest.toml:53-55`, `framework/nestjs/manifest.toml:31-33`, `framework/express/manifest.toml:10-12`, `library/drizzle/manifest.toml:24-26`, `library/zustand/manifest.toml:10-12`; fragment declarations with no source file in `library/trpc/manifest.toml:10-14`, `library/react-hook-form/manifest.toml:9-13`; `language/javascript/manifest.toml:448-454`
- Kind: simplify
- Problem: a selector is a code pattern that ESLint's `no-restricted-syntax` rule refuses. Six manifests declare a fake `[[tool_file]]` whose `source` names the fragment file, only so `parseManifest` can merge their `selectors` into the fragment it added by itself (`configurations/public.ts:111-121`). Two other manifests write a full fragment declaration with no source file. A reader cannot see why `source = "eslint.fragment.js.eta"` is there. `eslint_rules_off` is already a top-level manifest field, so selectors are the odd one out.
- Fix: Put every `selectors` list in the manifest's `[eslint]` table as `selectors`, with the same fields as today (NMU-071 groups the ESLint keys there: `presets`, `all_level_rules`, `rules_off`, `selectors`). Delete the 8 fake `[[tool_file]]` blocks and the merge code at `configurations/public.ts:111-121`. The fragment functions of CFL-001 read the list.
- Size: medium

### CFL-007: The re-export selectors are copied 9 times and the Next.js route list 5 times

- Where: `language/javascript/manifest.toml:454`; `framework/nextjs/manifest.toml:55,122,128`
- Kind: simplify
- Problem: javascript lists the same 3 selectors twice (once for `structure.reexports = "none"`, once for `"index-only"`), all six with the message "Export values at their declaration instead of re-exporting them." Next.js repeats the 3 `"index-only"` selectors to add its route file names, then repeats the route glob (`**/{page,layout,template,...}.{js,jsx,ts,tsx}`, eleven names) in `eslint_rules_off` and the names again in its naming exceptions.
- Fix: These selectors translate a general setting, so build them once in TypeScript from `structure.reexports`: 3 selectors, with the ignore list `**/index.*` plus the route files of each selected framework. Add one Next.js manifest field, `route_files = ["page", "layout", ...]`, and derive from it the glob for the selectors and for `[eslint] rules_off`. Build the Next.js naming exception as `route_files` plus the other names it accepts today (`instrumentation`, `sitemap`, `robots`, `manifest`, `opengraph-image`, ...).
- Size: medium

### CFL-008: Three framework manifests repeat a default that React already sets

- Where: `framework/react-native/manifest.toml:40-41`, `framework/expo/manifest.toml:16-17`, `framework/nextjs/manifest.toml:37-38`
- Kind: delete
- Problem: each sets the ESLint import extension to "extensionless" in a `[set]` table. React Native and Next.js require React, and Expo requires React Native, so React's identical `[set]` (`framework/react/manifest.toml:18-19`) is always present. Equal values never conflict (`isScalarConflict`, `policy/settings/public.ts:26-30`).
- Fix: Delete the 3 `[set]` tables. React keeps the one default, `tools.eslint.import_extension = "extensionless"` (TML-008).
- Size: small

### CFL-009: "Folders this language creates" is declared three times in three syntaxes

- Where: `language/javascript/manifest.toml:4,219,221`; `language/python/manifest.toml:3,5,7`; `language/swift/manifest.toml:2,4`; readers `packages/cli/src/checks/general/repository.ts:48`, `packages/cli/src/generation/documents/contracts.ts:173,187`, `packages/cli/src/checks/tool/docker.ts:144`
- Kind: merge
- Problem: `untracked_files = ["**/{node_modules,bower_components}/**"]`, `ignored_folders = ["node_modules/"]`, and `dockerignore = ["node_modules"]` all say "do not commit, scan, or ship this folder". The lists already differ: `bower_components` and `venv` appear in only one of the three. `generatedIgnores` also writes its own `'**/node_modules/**'`.
- Fix: One manifest field, `ignored_folders = ["node_modules", "bower_components"]` (python: `.venv`, `venv`; swift: `.build`, `DerivedData`, `Pods`). The three readers derive `**/<name>/**`, `<name>/`, and `<name>`, and `generatedIgnores` uses the field. Delete the language `untracked_files` entries and `dockerignore`; `general/secrets` keeps its own `untracked_files` file patterns (CFG-052). On purpose, the `docker/dockerignore` check then also asks for `bower_components`, `venv`, `.build`, `DerivedData`, and `Pods` in `.dockerignore`.
- Size: medium

### CFL-010: `products` is a misnamed word list with duplicates

- Where: 38 manifests (`products = [...]`), 11 of them in `general/`; reader `packages/cli/src/generation/compilation/contracts.ts:77-84`; schema `packages/cli/src/parsers/schema/configurations.ts:254`
- Kind: rename
- Problem: the field feeds the words the prose and spelling checks accept. It is not a product list: it holds `DOM`, `RPC`, and `DTO`. The reader already adds every tool name, so an entry equal to a tool name in the same manifest does nothing: bash `shfmt` and `ast-grep`; javascript `knip`; python `basedpyright`; sql `sqlfluff`; docker `hadolint`; github-actions `actionlint` and `zizmor`; and in `general/` `commitlint`, `osv-scanner`, `taplo`, `yamllint`, `gitleaks`, and `typos`. `DOM` (react, svelte, site), `DTO` (nestjs, swift, general/naming), and `RPC` (nextjs, general/security) repeat across manifests.
- Fix: Rename the manifest field to `allowed_words`, the same name as the root list in `gspot.toml`, in the schema and in every manifest. Delete the 14 tool-name entries. Put `DOM`, `DTO`, and `RPC` once in `general/prose` and delete the other copies. The Vale accepted words and the case exceptions of CFG-038 come from the tool names, the manifest `allowed_words` of the selected configurations, and the root `allowed_words`.
- Size: small

### CFL-011: NestJS turns off a rule that nothing turns on, for Vue and Svelte files

- Where: `framework/nestjs/manifest.toml:43-46`
- Kind: delete
- Problem: `eslint_rules_off` sets `class-methods-use-this` off for `**/*.{ts,tsx,mts,cts,vue,svelte}`. No preset, file, or generator turns that rule on, and the glob names Vue and Svelte files in a NestJS service.
- Fix: Delete the block.
- Size: small

### CFL-012: Xcode's `xmllint` check is a copy of the files configuration's `xmllint` check

- Where: `infra/xcode/manifest.toml:35-46`; `general/files/manifest.toml:120-130`
- Kind: merge
- Problem: same command, same output pattern, same example, same `why`, and same `help`. Storyboards and xibs are XML, and `general/files` is always selected, so it already runs in every Xcode repository.
- Fix: Add `".storyboard", ".xib"` to `files.extensions` of `files/xmllint`; delete `xcode/xmllint`.
- Size: small

### CFL-013: Trivy gets its ignore file twice

- Where: `infra/docker/trivy.yml.eta:9` (`ignorefile:`), `infra/docker/manifest.toml:105` (`--ignorefile {tool_file:trivyignore}`), `infra/docker/trivyignore.eta` (0 bytes)
- Kind: simplify
- Problem: the settings file and the command line both name the same empty ignore file, `.gspot/config/<scope>/trivyignore`.
- Fix: `trivyToolFile` (CFL-001) writes no `ignorefile:` line. Keep the empty ignore file as the plain file `infrastructure/docker/trivyignore`: it stops Trivy from reading a repository `.trivyignore`.
- Size: small

### CFL-014: Unused output and a fake fragment in the SwiftLint files

- Where: `language/swift/swiftlint.yml.eta:161` (`<%~ fragments %>`); `test/swift-tests/manifest.toml:14-19`; `packages/cli/src/generation/fragments.ts:30`
- Kind: delete
- Problem: the SwiftLint file prints `fragments`, but the only fragment for that file (swift-tests) has no source, and `emittedFragments` skips fragments without a source, so the line always prints nothing. The swift-tests entry is marked `fragment = true` only to carry a pointer to its folder.
- Fix: `swiftlintToolFile` (S5C-010) writes no fragments part. Keep `fragment = true` on the swift-tests entry: it stops that entry from writing a second `.gspot/config/swiftlint.yml`, and one tool file holds one pointer.
- Size: small

### CFL-016: Four ESLint functions that TypeScript calls are defined in the file text, and one uses a name only another file imports

- Where: `language/javascript/eslint.config.mjs.eta:282-328`; `packages/cli/src/generation/eslint/public.ts:22-28,160`; `language/typescript/eslint.fragment.js.eta:1`
- Kind: move
- Problem: TypeScript writes calls such as `componentMatches(vueParser, "vue")`, `runtimeMatches(2)`, `policyMatches({...})`, and `stripRuntimeGlobals(...)` into the output (`selectorSource()`), but the four functions are defined in the text of `eslint.config.mjs.eta`. `componentMatches` uses `tseslint.parser`, and only the TypeScript fragment imports `tseslint`. Nothing checks that these pieces agree.
- Fix: Write the four function definitions from the module that writes their calls (`selectorSource`, in `generation/eslint/serialize.ts`), and give `componentMatches` the parser as an argument instead of reading a global name.
- Size: medium

### CFL-017: The JavaScript ESLint file is 362 lines of two languages mixed

- Where: `language/javascript/eslint.config.mjs.eta`
- Kind: simplify
- Problem: lines run JavaScript at generation time and also print JavaScript for run time (44 Eta marks). The file renames inputs for no reason (`IS_ALL = isAll`, `RESTRICTED`, `JAVASCRIPT_LIMITS`, `limits`, `TESTS`, `SCRIPTS`, lines 31-37), and builds one block with an 858-character line that splices plugin names (`:334`).
- Fix: `eslintConfiguration` (`packages/cli/src/generation/eslint/configuration.ts`, CFL-001 step 3) writes the file. The rule tables `CORE_RULES`, `SONAR_RULES`, `UNICORN_RULES`, `SECURITY_RULES`, `REGEXP_RULES`, and `IMPORT_RULES` with their off reasons, and the 13 level-`all` selectors `BASE_SELECTORS`, go to `packages/cli/src/config/generation/eslint-rules.ts`. Drop the aliases, and build the import list and the plugin map from the selected plugins.
- Size: large

### CFL-018: The two html-validate files are one file with different overrides

- Where: `language/html/html-validate-source.json.eta`; `framework/site/html-validate-built.json.eta`
- Kind: merge
- Problem: both build `{ extends: ['html-validate:recommended'], rules: htmlRules(check, overrides) }`. Only the check name and six overrides (five rules turned off, `valid-id` relaxed) differ.
- Fix: One function, `htmlValidateToolFile` in `packages/cli/src/generation/tool-file-sources/html-validate.ts`, writes both files. The six overrides of the built output are one constant, `HTML_BUILT_OVERRIDES`, beside `HTML_RULES` in `packages/cli/src/config/generation/html.ts`.
- Size: small

### CFL-019: Jest and Vitest fragments build test file lists two different ways

- Where: `test/jest/eslint.fragment.js.eta:2`; `test/vitest/eslint.fragment.js.eta:2`
- Kind: simplify
- Problem: Vitest rebuilds `test_files × code patterns` by hand, which is exactly `eslintFiles.tests` (`generation/eslint/public.ts:77`). Jest uses the raw `test_files`, so its block also matches files that are not code. Both repeat the `prefer-strict-equal` level filter (CFL-002). Testing Library already uses `eslintFiles.tests`.
- Fix: Use `files: eslintFiles.tests` in `jestFragment` and `vitestFragment`, and drop the level filter.
- Size: small

### CFL-020: The four coverage checks repeat one example and differ on extensions

- Where: `test/jest/manifest.toml:31,36,44`; `test/vitest/manifest.toml:45,51,54`; `test/pytest/manifest.toml:30,40`; `test/swift-tests/manifest.toml:46,54`
- Kind: rewrite-text
- Problem: Jest, Vitest, and Swift Tests share one `example` word for word; pytest has the same text with `coverage.lines`. The `why` "A floor keeps new code from arriving untested." appears twice word for word (pytest, Swift Tests), with close variants in Jest and Vitest. Jest checks `.cjs` files and Vitest does not, with no reason.
- Fix: Give each example the runner's own failure line (for example Jest's "coverage threshold ... not met" line). Add `.cjs` to Vitest, so both runners check the same files.
- Size: small

### CFL-021: The list of tsconfig files is computed twice in one output file

- Where: `language/javascript/eslint.config.mjs.eta:1`; `language/typescript/eslint.fragment.js.eta:5`
- Kind: delete
- Problem: both build `['tsconfig.json', ...scope paths + '/tsconfig.json']`. The TypeScript copy also filters out the root scope, which the input already leaves out (`compilation/public.ts:105`).
- Fix: Compute the project list once in `eslintConfiguration` and give it to `typescriptFragment`.
- Size: small

### CFL-022: basedpyright options live in two places, one a manifest field only Python uses

- Where: `language/python/manifest.toml:1` (`basedpyright_options`); `language/python/basedpyrightconfig.json.eta:6-16`; schema `packages/cli/src/parsers/schema/configurations.ts:304-309`
- Kind: merge
- Problem: half of the basedpyright options sit in a one-line, 1,860-character TOML table; the other half are written in the `.eta` file. The field reads as general ("declared by selected manifests"), but only Python uses it.
- Fix: Put all options in one constant, `BASEDPYRIGHT_OPTIONS` in `packages/cli/src/config/generation/python.ts`, which `basedpyrightToolFile` writes. Delete the manifest field `basedpyright_options` and its schema field; `EtaInputs.basedpyrightOptions` goes with Eta.
- Size: small

### CFL-023: sqlfluff writes an empty rule list that is never printed

- Where: `language/sql/sqlfluff.cfg.eta:13,43`; `language/sql/manifest.toml:41`
- Kind: delete
- Problem: the document sets `rules: []`, the printer skips empty lists (line 43), and `rule_keys` still records `sqlfluff.rules`.
- Fix: `sqlfluffToolFile` writes no `rules` key; delete `"sqlfluff.rules"` from `rule_keys`.
- Size: small

### CFL-024: SwiftFormat lists `trailingClosures` twice

- Where: `language/swift/swiftformat.eta:32,60`
- Kind: delete
- Problem: it is in the always-disabled list and again in the recommended-only list; a `Set` hides the repeat.
- Fix: Keep `trailingClosures` only in the always-disabled list (in `packages/cli/src/config/generation/swift.ts` after CFL-001).
- Size: small

### CFL-025: Every rule file repeats its title in front matter

- Where: lines 1-3 of all 86 rule files in the repository (59 in this part, 27 in `general/`); `packages/cli/src/agent-rules/public.ts:60-61`; `packages/cli/src/config/agent-rules.ts:2`
- Kind: delete
- Problem: each file starts with `---\ntitle: X\n---` and then `# X`; in all 86 files the title equals the first heading. Nothing reads the title: the code only strips it before parsing, markdownlint ignores it, and users get both copies.
- Fix: Delete the front matter from every rule file, `FRONT_MATTER`, and the strip at `public.ts:61`.
- Size: small

### CFL-026: Manifests carry documentation pages that only the docs site reads

- Where: `notes` in `language/css/manifest.toml:7-36`, `language/javascript/manifest.toml:231-274`, `language/typescript/manifest.toml:34-40`, `framework/react-native/manifest.toml:13-32`, `framework/nextjs/manifest.toml:25-29`, `language/markdown/manifest.toml:7-20`, `language/python/manifest.toml:15-17`
- Kind: move
- Problem: Markdown help pages sit inside TOML strings in the npm package. The CLI never reads them; the only reader is `docs/src/content/reference/configurations.ts:102`.
- Fix: Move each `notes` text into a docs file that the configuration reference page includes (for example a details section per configuration under `docs/src/content/docs/reference/configurations/`), and delete the `notes` field.
- Size: medium

### CFL-027: JavaScript notes promise Vite behavior that does not exist

- Where: `language/javascript/manifest.toml:246`; `packages/cli/src/config/generation/eslint.ts:81`
- Kind: rewrite-text
- Problem: the notes say "React, Vue, Svelte, and Vite application sources use browser globals". No `vite` configuration exists, so the `'vite'` entry in `ESLINT_BROWSER_CONFIGURATIONS` never matches.
- Fix: Drop "and Vite" from the notes and `'vite'` from the constant.
- Size: small

### CFL-028: React, Vue, and Svelte descriptions claim Testing Library rules they do not add

- Where: `framework/react/manifest.toml:13`, `framework/vue/manifest.toml:27`, `framework/svelte/manifest.toml:20`
- Kind: rewrite-text
- Problem: Testing Library is its own configuration (`library/testing-library`). These three neither require nor suggest it.
- Fix: Remove the Testing Library sentence from the three descriptions.
- Size: small

### CFL-029: Typos in user-facing notes

- Where: `framework/nextjs/manifest.toml:26` ("Next.js buildsrun"); `framework/react-native/manifest.toml:14` ("detects`react-native`")
- Kind: rewrite-text
- Problem: missing spaces.
- Fix: "Next.js builds run", "detects `react-native`".
- Size: small

### CFL-030: Headings that do not match their text

- Where: `language/python/rules/PYTHON.md:24` ("File naming" over a rule about comment language), `:138` ("Threading and tests", no tests); `language/python/rules/TYPING.md:117` ("Protocols and suppressions", no suppressions); `language/python/rules/PACKAGING.md:7` (promises "hash checking", none); `framework/vue/rules/VUE.md:43` ("Accessibility and tests", tests only); `framework/svelte/rules/SVELTE.md:47` ("Accessibility and tests", accessibility only)
- Kind: rewrite-text
- Problem: a reader who searches by heading finds the wrong text.
- Fix: Rename to "Comment language", "Threading", "Protocols", drop "and hash checking", "Tests", and "Accessibility".
- Size: small

### CFL-031: Repeated sentences inside one rule file

- Where: `platform/supabase/rules/SUPABASE.md:114-116,124-125`; `language/python/rules/PYTHON.md:13-16`; `language/python/rules/PACKAGING.md:34-36`
- Kind: rewrite-text
- Problem: SUPABASE.md says "Ask the user before ... unless the task already authorizes it. Write the reason in the commit when a commit is authorized." twice. PYTHON.md says "the surrounding file deciding where it allows more than one" and then "consistency with the surrounding module where a guide allows more than one style". PACKAGING.md says "Flatten packages that contain only `__init__.py` and one other module" and "Do not create single-file packages", and repeats the no-dynamic-import rule of `PYTHON.md:81`.
- Fix: Merge the two Supabase bullets into one; keep one of each Python pair.
- Size: small

### CFL-032: "Validate input at the boundary" is said four times in files written together

- Where: `language/javascript/rules/JAVASCRIPT.md:8,37`; `language/typescript/rules/TYPESCRIPT.md:25,50-54`
- Kind: rewrite-text
- Problem: TypeScript requires JavaScript, so a TypeScript repository gets both files and reads the same rule four times, with different lists of input sources.
- Fix: Keep one sentence in JAVASCRIPT.md that names every source TYPESCRIPT.md lists (HTTP bodies, query strings, route params, headers, environment variables, database rows, RPC results, provider responses, file input, webhooks, scheduled-job payloads), parsed where the program receives them. In TYPESCRIPT.md keep only the typing part (`unknown` plus narrowing).
- Size: small

### CFL-033: JavaScript and TypeScript naming files repeat the same file-name table

- Where: `language/javascript/rules/NAMING.md:32-37`; `language/typescript/rules/NAMING.md:24-29`
- Kind: merge
- Problem: both show `UserService` → `user-repository` and a file named after a role word → `session-token-verifier`, and both files are written in every TypeScript repository.
- Fix: Keep one table in the JavaScript NAMING.md with mixed `.js` and `.ts` names; delete the TypeScript table.
- Size: small

### CFL-034: React, TanStack Query, React Hook Form, and Zustand restate each other

- Where: `framework/react/rules/REACT.md:60-64,103-104,111`; `library/tanstack-query/rules/TANSTACK-QUERY.md:24-27`; `library/react-hook-form/rules/REACT-HOOK-FORM.md:34-35`; `library/zustand/rules/ZUSTAND.md:42-43`
- Kind: rewrite-text
- Problem: optimistic rollback and "a committed write stays successful when its refresh fails" are in REACT.md and TANSTACK-QUERY.md; "submission awaits the real save" is in REACT.md and REACT-HOOK-FORM.md; "subscribe rows by entity ID" is in REACT.md and ZUSTAND.md.
- Fix: Keep each rule in the library file of the API it is about; in REACT.md keep one line per topic that states the general idea without the library details.
- Size: small

### CFL-035: Vue, Svelte, and Astro rules copy the same component ideas

- Where: `framework/vue/rules/VUE.md:13-14,30`; `framework/svelte/rules/SVELTE.md:13-14,19,45`; `framework/astro/rules/ASTRO.md:38`; `language/javascript/rules/COMPONENTS.md`
- Kind: move
- Problem: "Keep markup declarative; move an expression longer than one operator into a derived value", "Do not reach into a child to change its state", "Do not copy a prop into local state and keep the copy updated by hand", and "Validate what an endpoint or action receives before it reaches a database" are written per framework. COMPONENTS.md is already written for Astro, Svelte, Vue, and React, and the Astro and Svelte validation sentences are nearly identical.
- Fix: Move the three component sentences into COMPONENTS.md and keep only the API words (`computed`, `$derived`, Svelte's element reference) in the framework files. The validation sentence is not about components: merge it into the input-validation sentence of JAVASCRIPT.md (CFL-032) and delete the Astro and Svelte copies.
- Size: small

### CFL-036: SQL and Postgres both say "Fully qualify cross-schema references"

- Where: `language/sql/rules/SQL.md:9`; `database/postgres/rules/POSTGRES.md:29`
- Kind: delete
- Problem: Postgres requires SQL, so both files are written together.
- Fix: Delete the POSTGRES.md bullet; SQL.md holds the general rule.
- Size: small

### CFL-037: Filler "Rules:" lines

- Where: 18 lines: `language/bash/rules/NAMING.md` (3), `language/javascript/rules/NAMING.md` (1), `language/python/rules/NAMING.md` (4), `language/python/rules/PACKAGING.md` (1), `language/sql/rules/NAMING.md` (4), `language/typescript/rules/NAMING.md` (4), `platform/supabase/rules/SUPABASE.md` (1)
- Kind: delete
- Problem: the heading already says what follows.
- Fix: Delete the 18 lines.
- Size: small

### CFL-038: The same naming path list is copied into Astro, Next.js, and Svelte

- Where: `framework/astro/manifest.toml:9-14`, `framework/nextjs/manifest.toml:12-17`, `framework/svelte/manifest.toml:9-14`
- Kind: merge
- Problem: three manifests hold the same 4-entry `naming.path_containers` list (`[...]`, `(...)`, `@`, `_`). The entries are not Next.js-only: Astro skips `_`-prefixed route files, and SvelteKit uses `@` for layout resets.
- Fix: Move the one shared list into the shipped naming defaults (`naming/defaults.json`, CFG-035) and delete the three copies. Do not narrow it per framework.
- Size: small

### CFL-039: Root path patterns that `**/` already covers

- Where: `framework/nextjs/manifest.toml:35`; `database/postgres/manifest.toml:12`; `infra/xcode/manifest.toml:8`; `infra/ansible/manifest.toml:6`; `infra/nginx/manifest.toml:7`
- Kind: delete
- Problem: `next.config.js` sits beside `**/next.config.js`, `supabase/migrations/*.sql` beside `**/supabase/migrations/*.sql`, `*.xcodeproj/project.pbxproj` beside `**/*.xcodeproj/...`, `ansible.cfg` beside `**/ansible.cfg`, and `**/nginx/*.conf` beside `**/nginx/**/*.conf`. gspot matches with picomatch (`repository/paths/public.ts:38`), and each `**/` pattern matches the root path.
- Fix: Delete the 7 shorter patterns.
- Size: small

### CFL-040: File names that use a second name for their configuration

- Where: `test/swift-tests/rules/XCTEST.md` (title "Swift Tests", covers XCTest and Swift Testing); `library/translations/rules/I18N.md` (title "Internationalization"; NEXT-INTL.md says "shared i18n rules"); `platform/cloudflare/rules/WORKERS.md` and `platform/cloudflare/semgrep/workers.yml.eta` (every other Semgrep pack is named after its configuration); `language/css/rule-names.json` beside `language/javascript/eslint-rule-names.json`; `language/javascript/runtime-names.json`; `framework/site/rules/SITE.md` (title "Static Sites", manifest title "Static Site")
- Kind: rename
- Problem: one configuration, two names.
- Fix: `testing/swift-tests/rules/SWIFT-TESTS.md`; `TRANSLATIONS.md` (title "Translations"; NEXT-INTL.md says "the shared translation rules"); `CLOUDFLARE.md`; `semgrep/cloudflare.yml`; `stylelint-rule-names.json`; `eslint-runtime-names.json`; SITE.md title "Static Site". Update the readers (`config/parsers/stylelint.ts:2`, `config/generation/eslint.ts:11`, `compilation/public.ts:34`, `policy/schema/tools.ts:4`) and the tests that name the files (`tests/cli/generation/eslint/runtimes.test.ts:145`, `tests/cli/generation/semgrep.test.ts:45`).
- Size: small

### CFL-041: `pointer.template` gives "template" a second meaning and a second fill-in syntax

- Where: `test/swift-tests/manifest.toml:19`; `general/format/manifest.toml:48`; `packages/cli/src/parsers/schema/configurations.ts:60-75`; pointer bodies with `{target}`, `{target_json}`, `{target_module}` in `language/css/manifest.toml:82`, `language/python/manifest.toml:98,105`, `language/swift/manifest.toml:70`, `language/javascript/manifest.toml:453`, `language/markdown/manifest.toml:47`
- Kind: delete
- Problem: in gspot a template is the file `gspot export` writes. Here the pointer key `template` names a `.eta` file instead. The pointers also use a second fill-in syntax (`{target_json}`), so `swiftlint.yml.eta` goes through both Eta and `{...}` filling. Only two pointers use the key: swift-tests and the Prettier root file (`pointer.mjs.eta`).
- Fix: The swift-tests source has no Eta code, so its pointer becomes a plain `body`, like the other pointers. `prettierConfiguration` writes the Prettier root file (CFG-001). Then nothing uses the key: delete `template` from the pointer schema and from both manifests.
- Size: small

### CFL-043: Semgrep messages keep trailing line breaks from a YAML conversion

- Where: `framework/express/semgrep/express.yml.eta:8,24,38,41,44,50,79,93-102,108`; `framework/fastapi/semgrep/fastapi.yml.eta:13,24,49`; `language/javascript/semgrep/javascript.yml.eta:37,67,84,99,116`; `platform/supabase/semgrep/supabase.yml.eta:20,31,49,52,56`; `language/swift/semgrep/swift.yml.eta:54,83,107,171`
- Kind: simplify
- Problem: many messages and patterns end in `\n` (left from `|` block text); others do not.
- Fix: Drop the trailing `\n` when the packs become plain YAML (CFL-001).
- Size: small

### CFL-044: A Semgrep rule turns off at level `all` with no reason given

- Where: `language/javascript/semgrep/javascript.yml.eta:109-124`
- Kind: rewrite-text
- Problem: `gspot.javascript.no-interpolated-exec` runs only at level recommended (`isAll ? [] : [...]`). Every other level choice in the repository adds rules at `all`. The likely reason is that `security/detect-child-process`, a level-`all` ESLint rule, covers it, but nothing says so.
- Fix: Run the rule at both levels; one duplicate finding at `all` does no harm. Delete the `isAll` branch.
- Size: small

### CFL-045: Zustand's store paths repeat one extension list four times

- Where: `library/zustand/manifest.toml:18`
- Kind: simplify
- Problem: `{ts,tsx,mts,cts,js,jsx,mjs,cjs}` is written 4 times.
- Fix: `["**/store.*", "**/stores/*", "**/store/*", "**/*.store.*"]`; the ESLint block already limits files to code files.
- Size: small

### CFL-046: The `entry` field comment describes something no manifest does

- Where: `language/javascript/manifest.toml:223`; `packages/cli/src/parsers/schema/configurations.ts:284`
- Kind: rewrite-text
- Problem: "Where a dead-code scan starts when no framework names its own entries." No framework manifest has `entry`; only javascript does.
- Fix: "Files the knip unused-code scan starts from."
- Size: small

### CFL-047: The OpenAPI `ajv` line has a comment nobody can read

- Where: `infra/openapi/manifest.toml:14-17`
- Kind: rewrite-text
- Problem: "Spectral and its Ajv plugins share one code generator instance in the tool project."
- Fix: "Spectral's Ajv plugins must use the same ajv package as Spectral, so the tool project installs one shared ajv."
- Size: small

### CFL-048: The JavaScript manifest declares the `typescript` npm package twice

- Where: `language/javascript/manifest.toml:434-446`
- Kind: merge
- Problem: tool `tsc` (npm `typescript` 5.9.3) and library `typescript` (npm `typescript` 5.9.3) pin the same package. `toolProjectPackage` installs npm tools even when `system = true` (`configurations/contracts.ts:179-186`).
- Fix: Delete the library entry if the eslint check's tool list pulls in `tsc`; otherwise make the `typescript-eslint` library require `tsc`. Check one generated `.gspot/package.json` before deleting.
- Size: small

### CFL-049: Cloudflare writes an empty Semgrep pack at level recommended

- Where: `platform/cloudflare/semgrep/workers.yml.eta:4-27`
- Kind: simplify
- Problem: the only rule is inside `isAll ? [...] : []`, so at level recommended gspot writes `rules: []`.
- Fix: Make the pack the plain file `semgrep/cloudflare.yml` (CFL-001, CFL-040) and mark it level `all` in the Cloudflare manifest, so gspot writes it only at level `all`.
- Size: small

### CFL-050: React DOM could fold into React, but stays its own configuration

- Where: `framework/react-dom/` (16-line manifest, 4-line fragment, presets), `framework/react/`
- Kind: merge
- Problem: React DOM only adds the `jsx-a11y` rules when a scope depends on `react-dom` and React Native is not selected. Testing Library already picks presets by `scopeDependencies` inside one configuration, so React could do the same.
- Fix: No change. React DOM stays its own configuration: folding it in adds a hidden branch to the React fragment. Expo and React Native stay separate too: they are another runtime with other tools (Expo adds `expo-doctor` and its plugin).
- Size: small

### CFL-051: Double blank lines in manifests

- Where: `framework/site/manifest.toml:207-208`; `infra/openapi/manifest.toml:60-61`; `platform/cloudflare/manifest.toml:88-89,96-97`; `language/swift/manifest.toml:169-170`
- Kind: simplify
- Problem: formatting noise that Taplo leaves alone.
- Fix: Delete one blank line in each.
- Size: small

### CFL-052: Semgrep packs and ESLint fragments are added by file name, out of sight

- Where: `packages/cli/src/configurations/public.ts:94-110`
- Kind: simplify
- Problem: a file under `semgrep/` silently becomes a tool file that runs only when the `security` configuration is selected; a file named `eslint.fragment.js.eta` silently becomes an ESLint fragment. Reading a manifest shows neither.
- Fix: Keep the `semgrep/` folder rule (it saves about 30 manifest lines) and say it once in the manifest schema comment. The fragment file-name rule goes: the fragments become TypeScript functions (CFL-001), and their selectors move to `[eslint] selectors` (CFL-006).
- Size: small

### CFL-053: The shipped knip settings hide exports that only their own file uses

- Where: `packages/cli/configurations/language/javascript/knip.json.eta:22` (`"ignoreExportsUsedInFile": true`)
- Kind: simplify
- Problem: knip does not report an export that only its own file uses, so at level `all` every user's repository keeps needless exports. In gspot itself the parser part alone has 10 such exports (PAR-048), and knip never reported them.
- Fix: `knipToolFile` (CFL-001) writes `ignoreExportsUsedInFile: true` only at level recommended, so level `all` reports these exports.
- Size: small

### S5C-004: Manifests still carry checks and fields that other findings delete

- Where: `general/structure/manifest.toml`, `language/css/manifest.toml`, `database/postgres/manifest.toml`, `language/javascript/manifest.toml`, and the nine manifests with `required_eslint_rules` (`language/javascript`, `language/typescript`, `framework/astro`, `framework/expo`, `framework/nestjs`, `framework/nextjs`, `framework/react`, `framework/svelte`, `framework/vue`); every manifest with checks or settings
- Kind: delete
- Problem: other findings delete code whose declarations sit in the manifests. Unless each manifest block goes in the same change, the manifests keep checks with no code and fields with no reader:
    - `general/structure`: the `[[check]]` blocks `folder-names` (CKG-003), `config-logic` (CKG-010), `test-placement` (CKG-011), `private-before-public` and `import-comments` (CKG-055).
    - `language/css`: the `[[check]]` block `module-classes` (CKO-029).
    - `database/postgres`: the `[[check]]` block `migration-docs` and the setting `postgres.doc_sections` (CKO-041).
    - `language/javascript`: the eslint-comments plugin `[[tool]]` (CKG-004); `gspot` and `gspotAll` in `eslint_presets` (PLG-008).
    - Nine manifests: `required_eslint_rules`, which only a test reads; its rule lists move into the test data `tests/config/eslint/lint-rules.ts`.
    - Every manifest with checks: the check `title` field (NMU-004). Every manifest with settings: its `[[setting]]` tables (POL-001).
- Fix: Delete each block in the same commit as the code its finding deletes. Delete the `required_eslint_rules` schema field with the tables. The check `example` field stays.
- Size: medium

### S5C-006: 14 `suggests` entries name configurations that are always selected

- Where: `suggests = ["security", ...]` in `framework/express`, `framework/fastapi`, `framework/nestjs`, `platform/cloudflare`, `platform/supabase`; `"naming"` in `language/bash`, `javascript`, `typescript`, `python`, `sql`, `swift`; `"format"` in `language/bash`, `javascript`, `typescript`
- Kind: delete
- Problem: `security` and `naming` have `always_selected = true`, and `format` is always present (CFG-047). `selectForScope` adds the always-selected general configurations after removals (`repository/selection/public.ts:121-144`), so a user cannot remove them. A suggestion of them has no effect: doctor skips selected ones (`commands/doctor/contracts.ts:57-64`).
- Fix: Delete the 14 entries. A `suggests` list keeps only configurations a repository can lack (`openapi`, `css`, `typescript`, `react-dom`, `swift`).
- Size: small

### S5C-007: `min_version` on tools that gspot installs at the exact pin

- Where: `language/css/manifest.toml:48` (stylelint), `language/html/manifest.toml:14` (html-validate, equal to its pin), `language/javascript/manifest.toml:295,323,332,361,369,377,406,431` (eslint, sonarjs, unicorn, n, jsdoc, regexp, boundaries, knip), `language/typescript/manifest.toml:58` (typescript-eslint)
- Kind: delete
- Problem: `min_version` lowers the floor, so a found version between the floor and the pin counts as `ok` (`toolVersionState`, `tools/contracts.ts:153-164`). These 11 tools come only from npm into the tool project, from a committed lockfile at the exact pin; a library's found version is its installed `node_modules/<name>/package.json` (`tools/public.ts:41-46,92-101`). The found version is the pin, or the install is stale, and then doctor should say `outdated` so the user runs `gspot install`. The floor only hides that.
- Fix: Delete these 11 `min_version` lines. Keep it on system tools (next, wrangler, drizzle-kit, supabase, pytest, vitest), where it is required, and on programs that may come from `PATH`.
- Size: small

### S5C-008: Six checks repeat their tool's operating system list

- Where: `general/security/manifest.toml:46,62` (the two Semgrep checks; the tool at `:20`), `infra/ansible/manifest.toml:24`, `infra/nginx/manifest.toml:35` (gixy), `infra/xcode/manifest.toml:27` (plutil), `language/swift/manifest.toml:150` (periphery)
- Kind: delete
- Problem: each check's `platforms` equals its tool's (`["macos", "linux"]` or `["macos"]`), and planning already skips a check whose tool has no build for the machine (`platformSkip` checks `check.platforms`, then `missingBuild`, `planning/contracts.ts:68-75`).
- Fix: Delete the list from these six checks. Keep it where it differs from the tool (`swift/swiftlint-analyze`, `swift/build`, `swift-tests/coverage`), under the key `operating_systems`, the same word as `ci.operating_systems`, in the schema and in those manifests.
- Size: small

### S5C-009: Five rules gated only by `isAll` are missing from `eslint_all_rules`, and one runs at both levels today

- Where: `framework/react/eslint.fragment.js.eta:5` (`react/self-closing-comp`), `framework/svelte/eslint.fragment.js.eta:6` (`svelte/no-useless-mustaches`, `svelte/prefer-const`), `framework/vue/eslint.fragment.js.eta:9` (`vue/no-useless-v-bind`, `vue/prefer-true-attribute-shorthand`); the `eslint_all_rules` lists of the three manifests
- Kind: fix-bug
- Problem: these five rules are switched on only inside `isAll ? {...} : {}` and are in no `eslint_all_rules` list. CFL-002 deletes every such wrap and makes the list the one place that marks level-`all` rules, so these five would then run at level recommended. One is already wrong: the Svelte preset turns `svelte/no-useless-mustaches` on at both levels (`framework/svelte/eslint-presets.json`, block 4), so its `isAll` wrap does nothing.
- Fix: Add the five rules to their manifest's list (`[eslint] all_level_rules` after NMU-071). The generator then turns them off at level recommended (`generation/eslint/public.ts:117`), which also fixes `svelte/no-useless-mustaches` now. Do it in the same change as CFL-002 at the latest.
- Size: small

### S5C-010: SwiftLint comments are pushed into YAML with string replace

- Where: `packages/cli/configurations/language/swift/swiftlint.yml.eta:158-160`
- Kind: simplify
- Problem: the file serializes YAML, then calls `.replace('identifier_name:', '# ...\nidentifier_name:')` twice to insert comments; a key rename drops the comment without a message. Every key of the file except the two comments depends on the level, `rulesOff`, or a limit (`options`, `disabled_rules`, `opt_in_rules`, `analyzer_rules`), so a split into a plain YAML part and a function would need merge code.
- Fix: One function, `swiftlintToolFile` in `packages/cli/src/generation/tool-file-sources/swiftlint.ts`, writes the whole file with its two comments as lines. The rule lists (`SWIFTLINT_OPT_IN`, `SWIFTLINT_RECOMMENDED_OFF`) go to `packages/cli/src/config/generation/swift.ts`.
- Size: small

### S5C-012: `SITE.md` holds edge rules that repeat the Cloudflare rules and do not fit a static site

- Where: `packages/cli/configurations/framework/site/rules/SITE.md:9-12` (Runtime isolation), `:31-36` (Edge middleware); `platform/cloudflare/rules/WORKERS.md:18-24`
- Kind: delete
- Problem: the Site configuration is "a site built to a folder and served as files". A static site has no requests to isolate and no middleware. The same rules sit in WORKERS.md ("Module state is neither durable storage nor a safe place for request-specific user data").
- Fix: Delete the two sections from SITE.md. The Cloudflare rule file (`CLOUDFLARE.md`, CFL-040) keeps them.
- Size: small

### S5C-013: Bash and Python rule files open with lines that list their sibling files

- Where: `language/bash/rules/BASH.md:7-11` and `:41-44` (Values), `LANGUAGE.md:7-8`, `OPERATIONS.md:7`, `SAFETY.md:7-8`; `language/python/rules/PYTHON.md:7-9`, `DESIGN.md:7-8`, `FLOW.md:7`, `TYPING.md:7-8`
- Kind: delete
- Problem: "The Bash rules span five files. This one covers ... Language covers ... Safety covers ..." A coding tool reads every rule file the AGENTS.md list names, and each heading says what follows. BASH.md "Values" repeats `LANGUAGE.md:188-189` (no binary data, trailing newlines).
- Fix: Delete the opening pointer lines of the eight files and the Values section of BASH.md.
- Size: small

### S5C-014: `stylelint-config-recommended` is pinned as its own tool

- Where: `packages/cli/configurations/language/css/manifest.toml:64-68` and the `tool` list of `css/stylelint`
- Kind: delete
- Problem: it is pinned to "pin the inherited recommended preset", but it arrives as a dependency of `stylelint-config-standard`, and the committed tool-project lockfile already freezes its version. No source or script names it.
- Fix: Delete the `[[tool]]` and its name in the check's `tool` list. Run one install to confirm the lockfile keeps the same version.
- Size: small

### S5C-017: The fragments repeat the preset sources that the manifests declare

- Where: `framework/astro/eslint.fragment.js.eta:2` (`[['recommended', 'flat/recommended'], ['accessibility', 'flat/jsx-a11y-recommended']]`), `framework/svelte/eslint.fragment.js.eta:4` (`configs.recommended`), `framework/vue/eslint.fragment.js.eta:5,7` (`configs['flat/recommended']` twice), `language/typescript/eslint.fragment.js.eta:4` (`configs.strictTypeChecked`), `language/javascript/eslint.config.mjs.eta:331,351` (five sources)
- Kind: simplify
- Problem: each manifest already says `eslint_presets.<name>.source` (for example `configs.flat/recommended`). The fragments write the same path again to emit `...plugin.configs[...][index]`, so a plugin rename needs two edits that nothing checks against each other.
- Fix: `eslintConfiguration` and the fragment functions (CFL-001) emit the spread from the manifest's preset `source` (`[eslint] presets` after NMU-071); no source string sits in the TypeScript.
- Size: small

### S5C-018: `trivy-findings.tpl` exists only to turn Trivy JSON into lines for a regex

- Where: `packages/cli/configurations/infra/docker/trivy-findings.tpl.eta`; `infra/docker/manifest.toml:51-55,105,108`
- Kind: delete
- Problem: gspot writes a Go template so Trivy prints `file:line:id:title`, then reads that with a regex. gspot's JSON output parser already reads nested reports, and child items take missing fields from their parent (`parsers/output/structured/public.ts:249`); the osv check uses this (`general/dependencies/manifest.toml:51`).
- Fix: Delete the file and its `[[tool_file]]`. The `trivy-config` command uses `--format json` instead of `--format template --template @...`, with `output = { format = "json", items = "Results", children = "Misconfigurations", fields = { file = "Target", line = "CauseMetadata.StartLine", rule = "ID", message = "Title" } }`. Run the docker integration test once.
- Size: small

## Layout

```text
packages/cli/configurations/
  language/ framework/ library/ infrastructure/ platform/ testing/ database/
    <name>/
      manifest.toml          data only: no notes, no basedpyright_options, no required_eslint_rules; ESLint keys in
                             one [eslint] table; words in allowed_words; folders in ignored_folders
      rules/*.md             no front matter
      semgrep/<name>.yml     plain YAML, found by folder
      eslint-presets.json    rule lists written by scripts/update-rule-lists.ts
  infrastructure/docker/trivyignore, infrastructure/github-actions/zizmor.yml,
  language/markdown/markdownlint-cli2.mjs     plain files, copied as they are
packages/cli/src/generation/
  tool-file-sources/<tool>.ts                 one function per tool file (ruffToolFile, swiftlintToolFile, ...)
  eslint/configuration.ts                     eslintConfiguration
  eslint/fragments/<configuration>.ts         one function per configuration that adds ESLint blocks
```

The fixed values of these functions, in `packages/cli/src/config/generation/`:

| File                   | What it holds                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint-rules.ts`      | the ESLint rule tables (`CORE_RULES`, `SONAR_RULES`, `UNICORN_RULES`, `SECURITY_RULES`, `REGEXP_RULES`, `IMPORT_RULES`) with their off reasons, and `BASE_SELECTORS`, the 13 level-`all` `no-restricted-syntax` selectors                                                                                                                                                                                                                                                              |
| `eslint-fragments.ts`  | the lint rules and file globs each configuration adds to the ESLint file, among them `TYPESCRIPT_RULES`                                                                                                                                                                                                                                                                                                                                                                                |
| `tool-file-sources.ts` | fixed defaults of the smaller tool files (commitlint, yamllint, taplo, v8r, hadolint, trivy, spectral, squawk, sqlfluff, shellcheck, markdownlint, stylelint, knip, jscpd, typos, semgrep ignore, purgecss), among them `STYLELINT_ALL_LEVEL_RULES`, `TAILWIND_AT_RULES`, the per-tool recommended-level off lists (`HADOLINT_RECOMMENDED_OFF`, `SQLFLUFF_RECOMMENDED_OFF`, `SPECTRAL_RECOMMENDED_OFF`, `SQUAWK_RECOMMENDED_OFF`), `TYPOS_EXCLUDED_FILES`, and `TYPOS_IGNORE_PATTERNS` |
| `swift.ts`             | SwiftLint, SwiftFormat, and Periphery rule lists and options: `SWIFTLINT_OPT_IN` (81 rules), `SWIFTLINT_RECOMMENDED_OFF` (34), `SWIFTFORMAT_RECOMMENDED_OFF` (63)                                                                                                                                                                                                                                                                                                                      |
| `python.ts`            | `RUFF_IGNORED_RULES` (17 codes), the isort options, and `BASEDPYRIGHT_OPTIONS`                                                                                                                                                                                                                                                                                                                                                                                                         |
| `prose.ts`             | Vale: `VALE_OFF_RULES`, the styles kept at level recommended, the length-style text, the alt-text tokens, `BANNED_HEADINGS`, the shared acronym list                                                                                                                                                                                                                                                                                                                                   |
| `html.ts`              | `HTML_RULES`, `HTML_ALL_RULES`, the html-validate `extends`, and `HTML_BUILT_OVERRIDES`                                                                                                                                                                                                                                                                                                                                                                                                |
| `formatting.ts`        | the fixed EditorConfig sections and the prettierignore header                                                                                                                                                                                                                                                                                                                                                                                                                          |
