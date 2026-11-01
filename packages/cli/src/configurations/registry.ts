import type { Check } from '#cli/types/manifests.ts';
import { checkTsc } from '#cli/configurations/tsc/check.ts';
import type { CheckCode } from '#cli/types/engine/check.ts';
import type { ConfigBuilder } from '#cli/types/generation/files.ts';
import { checkVale } from '#cli/configurations/general/prose/checks.ts';
import { checkYaml } from '#cli/configurations/general/data-files/checks.ts';
import { checkAllowed } from '#cli/configurations/general/licenses/checks.ts';
import { checkSemgrep } from '#cli/configurations/general/security/checks.ts';
import { checkFences } from '#cli/configurations/language/markdown/checks.ts';
import { checkExpoDoctor } from '#cli/configurations/framework/expo/checks.ts';
import { buildLycheeFile } from '#cli/configurations/general/docs/generate.ts';
import { checkJscpd } from '#cli/configurations/general/duplication/checks.ts';
import { checkNextjsTsc } from '#cli/configurations/framework/nextjs/checks.ts';
import { checkPaths } from '#cli/configurations/general/naming/checks/paths.ts';
import { buildKnipFile } from '#cli/configurations/language/javascript/knip.ts';
import { checkGeneratorOutputs } from '#cli/configurations/generator-outputs.ts';
import { checkSyntax } from '#cli/configurations/infrastructure/nginx/checks.ts';
import { checkSafety } from '#cli/configurations/language/bash/checks/safety.ts';
import { buildSqlfluffFile } from '#cli/configurations/language/sql/generate.ts';
import { checkSvelteCheck } from '#cli/configurations/framework/svelte/checks.ts';
import { buildTyposFile } from '#cli/configurations/general/spelling/generate.ts';
import { buildStylelintFile } from '#cli/configurations/language/css/generate.ts';
import { buildBiomeFile } from '#cli/configurations/language/javascript/biome.ts';
import { checkTsconfig } from '#cli/configurations/language/typescript/checks.ts';
import { checkMessages } from '#cli/configurations/library/translations/checks.ts';
import { buildCoverageFile } from '#cli/configurations/testing/pytest/generate.ts';
import { buildSquawkFile } from '#cli/configurations/database/postgres/generate.ts';
import { checkSiteBuild } from '#cli/configurations/framework/site/checks/build.ts';
import { buildShellcheckFile } from '#cli/configurations/language/bash/generate.ts';
import { checkGrants } from '#cli/configurations/database/postgres/checks/grants.ts';
import { buildJscpdFile } from '#cli/configurations/general/duplication/generate.ts';
import { buildGixyFile } from '#cli/configurations/infrastructure/nginx/generate.ts';
import { checkHtmlInlineScripts } from '#cli/configurations/language/html/checks.ts';
import { checkSwiftBuild } from '#cli/configurations/language/swift/checks/build.ts';
import { buildPeripheryFile } from '#cli/configurations/language/swift/periphery.ts';
import { buildSwiftlintFile } from '#cli/configurations/language/swift/swiftlint.ts';
import { buildCommitlintFile } from '#cli/configurations/general/commits/generate.ts';
import { buildHtmlValidateFile } from '#cli/configurations/language/html/generate.ts';
import { checkCoverage } from '#cli/configurations/language/swift/checks/coverage.ts';
import { checkReactVersions } from '#cli/configurations/framework/react-dom/checks.ts';
import { checkAnsibleLint } from '#cli/configurations/infrastructure/ansible/checks.ts';
import { buildJsconfigFile } from '#cli/configurations/language/javascript/jsconfig.ts';
import { checkPeriphery } from '#cli/configurations/language/swift/checks/periphery.ts';
import { checkShellcheck } from '#cli/configurations/language/bash/checks/shellcheck.ts';
import { buildSwiftformatFile } from '#cli/configurations/language/swift/swiftformat.ts';
import { buildMarkdownlintFile } from '#cli/configurations/language/markdown/generate.ts';
import { buildPurgecssSafelistFile } from '#cli/configurations/framework/site/generate.ts';
import { buildOsvScannerFile } from '#cli/configurations/general/dependencies/generate.ts';
import { buildSpectralFile } from '#cli/configurations/infrastructure/openapi/generate.ts';
import { buildEslintFile } from '#cli/configurations/language/javascript/eslint/config.ts';
import { checkIdentifiers } from '#cli/configurations/general/naming/checks/identifiers.ts';
import { checkLoneFiles } from '#cli/configurations/general/structure/checks/lone-files.ts';
import { checkLongFiles } from '#cli/configurations/general/structure/checks/long-files.ts';
import { checkSkipReasons } from '#cli/configurations/language/swift/checks/skip-reasons.ts';
import { checkBareBlocks } from '#cli/configurations/general/structure/checks/bare-blocks.ts';
import { buildAnsibleLintFile } from '#cli/configurations/infrastructure/ansible/generate.ts';
import { checkActionlint } from '#cli/configurations/infrastructure/github-actions/checks.ts';
import { checkScriptLayout } from '#cli/configurations/language/bash/checks/script-layout.ts';
import { checkAllowedNames } from '#cli/configurations/general/naming/checks/allowed-names.ts';
import { checkImportRules } from '#cli/configurations/general/structure/checks/import-rules.ts';
import { checkBashDocComments } from '#cli/configurations/language/bash/checks/doc-comments.ts';
import { checkHeaders, checkRedirects } from '#cli/configurations/platform/cloudflare/checks.ts';
import { YAML_RULE_DOCS, MARKDOWNLINT_PATH_PREFIX } from '#cli/config/configurations/registry.ts';
import { buildV8rFile, buildTaploFile } from '#cli/configurations/general/data-files/generate.ts';
import { checkBashFunctionSize } from '#cli/configurations/language/bash/checks/function-size.ts';
import { checkSwiftDocComments } from '#cli/configurations/language/swift/checks/doc-comments.ts';
import { checkSiteUnusedAssets } from '#cli/configurations/framework/site/checks/unused-assets.ts';
import { checkMissingPaths, checkRequiredFiles } from '#cli/configurations/general/docs/checks.ts';
import { checkFunctionOrder } from '#cli/configurations/general/structure/checks/function-order.ts';
import { checkBashInlineScripts } from '#cli/configurations/language/bash/checks/inline-scripts.ts';
import { checkUnreadArguments } from '#cli/configurations/language/bash/checks/unread-arguments.ts';
import { checkUnusedFunctions } from '#cli/configurations/language/bash/checks/unused-functions.ts';
import { checkMigrationOrder } from '#cli/configurations/database/postgres/checks/migration-order.ts';
import { checkEnvExamples, checkGitleaksPushed } from '#cli/configurations/general/secrets/checks.ts';
import { checkSharedPrefixes } from '#cli/configurations/general/structure/checks/shared-prefixes.ts';
import { checkReferences, checkCommitlintPushed } from '#cli/configurations/general/commits/checks.ts';
import { buildRuffFile, buildBasedpyrightFile } from '#cli/configurations/language/python/generate.ts';
import { checkEditedMigrations } from '#cli/configurations/database/postgres/checks/edited-migrations.ts';
import { checkTrivialFunctions } from '#cli/configurations/general/structure/checks/trivial-functions.ts';
import { buildTrivyFile, buildHadolintFile } from '#cli/configurations/infrastructure/docker/generate.ts';
import { checkRowLevelSecurity } from '#cli/configurations/database/postgres/checks/row-level-security.ts';
import { checkDefinerSearchPath } from '#cli/configurations/database/postgres/checks/definer-search-path.ts';
import { checkForeignKeyIndexes } from '#cli/configurations/database/postgres/checks/foreign-key-indexes.ts';
import { checkFileFolderClashes } from '#cli/configurations/general/structure/checks/file-folder-clashes.ts';
import { checkJavascriptTsc, checkJavascriptBiome } from '#cli/configurations/language/javascript/checks.ts';
import { checkEnvironmentReaders } from '#cli/configurations/general/structure/checks/environment-readers.ts';
import { checkPassThroughFolders } from '#cli/configurations/general/structure/checks/pass-through-folders.ts';
import { checkEncoding, checkLargeFiles, checkLocalFiles } from '#cli/configurations/general/repository/checks.ts';
import { listSwiftlintConfigs, checkSwiftlintAnalyze } from '#cli/configurations/language/swift/checks/swiftlint.ts';
import { checkCompose, checkTrivyImage, checkDockerignore } from '#cli/configurations/infrastructure/docker/checks.ts';

import {
    checkLockfiles,
    checkStaleLockfile,
    checkPackageManagerPin,
} from '#cli/configurations/general/dependencies/checks.ts';
import {
    buildPrettierFile,
    buildEditorconfigFile,
    buildPrettierignoreFile,
} from '#cli/configurations/general/format/generate.ts';
import {
    checkLychee,
    checkSitemap,
    checkPurgecss,
    checkHtmlValidate,
} from '#cli/configurations/framework/site/checks/pages.ts';
import {
    checkDenoLint,
    checkDenoCheck,
    checkServiceRoleKey,
    checkStoragePolicies,
} from '#cli/configurations/platform/supabase/checks.ts';
import {
    checkSuppressions,
    checkGeneratedFiles,
    checkUnmatchedPaths,
    checkConflictingConfigs,
} from '#cli/configurations/general/gspot/checks.ts';
import {
    checkDeptry,
    checkVulture,
    checkPydoclint,
    checkPipInstalls,
    checkPythonFunctionSize,
    checkPlaceholderDocstrings,
} from '#cli/configurations/language/python/checks.ts';
import {
    checkAssets,
    checkXcstrings,
    checkEntitlements,
    checkXcodeUnusedAssets,
    checkFilesWithoutTarget,
    checkAppTransportSecurity,
} from '#cli/configurations/infrastructure/xcode/checks.ts';
import {
    buildValeIniFile,
    buildLengthStyle,
    buildAltTextStyle,
    buildAcronymsStyle,
    buildAcceptedWordsFile,
    buildCapitalizationStyle,
    buildBannedHeadingsStyle,
} from '#cli/configurations/general/prose/generate.ts';

export const CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder | undefined>> = {
    'pytest/coveragerc': buildCoverageFile,
    'ansible/ansible-lint.yml': buildAnsibleLintFile,
    'prose/styles/gspot/acronyms.yml': buildAcronymsStyle,
    'nginx/gixy.cfg': buildGixyFile,
    'postgres/squawk.toml': buildSquawkFile,
    'docker/trivy.yml': buildTrivyFile,
    'bash/shellcheckrc': buildShellcheckFile,
    'commits/commitlint.json': buildCommitlintFile,
    'markdown/markdownlint.jsonc': buildMarkdownlintFile,
    'duplication/jscpd.json': buildJscpdFile,
    'data-files/taplo.toml': buildTaploFile,
    'docs/lychee.toml': buildLycheeFile,
    'docker/hadolint.yml': buildHadolintFile,
    'openapi/spectral.yml': buildSpectralFile,
    'data-files/v8r.yml': buildV8rFile,
    'dependencies/osv-scanner.toml': buildOsvScannerFile,
    'site/purgecss-safelist.json': buildPurgecssSafelistFile,
    'site/html-validate.json': buildHtmlValidateFile,
    'format/.prettierignore': buildPrettierignoreFile,
    'format/.editorconfig': buildEditorconfigFile,
    'prose/styles/config/vocabularies/words/accept.txt': buildAcceptedWordsFile,
    'prose/vale.ini': buildValeIniFile,
    'prose/styles/gspot/heading-case.yml': (planned) => buildCapitalizationStyle(planned, 'heading'),
    'prose/styles/gspot/paragraph-length.yml': (planned) => buildLengthStyle(planned, 'paragraph'),
    'prose/styles/gspot/alt-text.yml': buildAltTextStyle,
    'prose/styles/gspot/banned-headings.yml': buildBannedHeadingsStyle,
    'prose/styles/gspot/sentence-length.yml': (planned) => buildLengthStyle(planned, 'sentence'),
    'prose/styles/gspot/title-case.yml': (planned) => buildCapitalizationStyle(planned, 'title'),
    'prose/styles/gspot/item-length.yml': (planned) => buildLengthStyle(planned, 'item'),
    'spelling/typos.toml': buildTyposFile,
    'python/basedpyright.json': buildBasedpyrightFile,
    'python/ruff.toml': buildRuffFile,
    'css/stylelint.json': buildStylelintFile,
    'html/html-validate.json': buildHtmlValidateFile,
    'swift/periphery.yml': buildPeripheryFile,
    'swift/swiftformat': buildSwiftformatFile,
    'swift/swiftlint.yml': buildSwiftlintFile,
    'javascript/knip.json': buildKnipFile,
    'javascript/biome.json': buildBiomeFile,
    'sql/sqlfluff.cfg': buildSqlfluffFile,
    'javascript/eslint/eslint.mjs': buildEslintFile,
    'javascript/jsconfig.json': buildJsconfigFile,
    'format/prettier.json': buildPrettierFile,
};

export const CHECK_CODE: Record<string, CheckCode> = {
    'ansible/ansible-lint': { check: checkAnsibleLint },
    'bash/doc-comments': { check: checkBashDocComments },
    'bash/function-size': { check: checkBashFunctionSize },
    'bash/inline-scripts': { check: checkBashInlineScripts },
    'bash/safety': { check: checkSafety },
    'bash/script-layout': { check: checkScriptLayout },
    'bash/shellcheck': { run: checkShellcheck },
    'bash/unread-arguments': { check: checkUnreadArguments },
    'bash/unused-functions': { check: checkUnusedFunctions },
    'cloudflare/headers': { check: checkHeaders },
    'cloudflare/redirects': { check: checkRedirects },
    'commits/commitlint-pushed': { run: checkCommitlintPushed },
    'commits/references': { check: checkReferences },
    'data-files/yaml': { check: checkYaml, ruleDocs: YAML_RULE_DOCS },
    'dependencies/lockfiles': { check: checkLockfiles },
    'dependencies/package-manager-pin': { check: checkPackageManagerPin },
    'dependencies/stale-lockfile': { check: checkStaleLockfile },
    'docker/compose': { run: checkCompose },
    'docker/dockerignore': { check: checkDockerignore },
    'docker/trivy-image': { check: checkTrivyImage },
    'docs/missing-paths': { check: checkMissingPaths },
    'docs/required-files': { check: checkRequiredFiles },
    'duplication/jscpd': { check: checkJscpd },
    'expo/expo-doctor': { check: checkExpoDoctor },
    'github-actions/actionlint': { run: checkActionlint },
    'gspot/generated-files': { check: checkGeneratedFiles },
    'gspot/conflicting-configs': { check: checkConflictingConfigs },
    'gspot/suppressions': { check: checkSuppressions },
    'gspot/unmatched-paths': { check: checkUnmatchedPaths },
    'html/inline-scripts': { check: checkHtmlInlineScripts },
    'javascript/tsc': { run: checkJavascriptTsc },
    'javascript/biome': { run: checkJavascriptBiome },
    'licenses/allowed': { check: checkAllowed },
    'markdown/fences': { check: checkFences },
    'markdown/markdownlint': {
        listFileArguments: (_session, planned) =>
            planned.files.map((file) => `${MARKDOWNLINT_PATH_PREFIX}${file.path}`),
    },
    'naming/allowed-names': { check: checkAllowedNames },
    'naming/identifiers': { check: checkIdentifiers },
    'naming/paths': { check: checkPaths },
    'nextjs/tsc': { run: checkNextjsTsc },
    'nginx/syntax': { check: checkSyntax },
    'postgres/definer-search-path': { check: checkDefinerSearchPath },
    'postgres/edited-migrations': { check: checkEditedMigrations },
    'postgres/foreign-key-indexes': { check: checkForeignKeyIndexes },
    'postgres/grants': { check: checkGrants },
    'postgres/migration-order': { check: checkMigrationOrder },
    'postgres/row-level-security': { check: checkRowLevelSecurity },
    'prose/vale': { check: checkVale },
    'python/deptry': { run: checkDeptry },
    'python/function-size': { check: checkPythonFunctionSize },
    'python/pip-installs': { check: checkPipInstalls },
    'python/placeholder-docstrings': { check: checkPlaceholderDocstrings },
    'python/pydoclint': { run: checkPydoclint },
    'python/vulture': { check: checkVulture },
    'repository/encoding': { check: checkEncoding },
    'react-dom/react-versions': { check: checkReactVersions },
    'repository/large-files': { check: checkLargeFiles },
    'repository/local-files': { check: checkLocalFiles },
    'secrets/env-examples': { check: checkEnvExamples },
    'secrets/gitleaks-pushed': { run: checkGitleaksPushed },
    'security/semgrep': { run: checkSemgrep },
    'site/build': { check: checkSiteBuild },
    'site/html-validate': { check: checkHtmlValidate },
    'site/lychee': { check: checkLychee },
    'site/purgecss': { check: checkPurgecss },
    'site/sitemap': { check: checkSitemap },
    'site/unused-assets': { check: checkSiteUnusedAssets },
    'structure/environment-readers': { check: checkEnvironmentReaders },
    'structure/file-folder-clashes': { check: checkFileFolderClashes },
    'structure/import-rules': { check: checkImportRules },
    'structure/bare-blocks': { check: checkBareBlocks },
    'structure/function-order': { check: checkFunctionOrder },
    'structure/lone-files': { check: checkLoneFiles },
    'structure/pass-through-folders': { check: checkPassThroughFolders },
    'structure/long-files': { check: checkLongFiles },
    'structure/shared-prefixes': { check: checkSharedPrefixes },
    'structure/trivial-functions': { check: checkTrivialFunctions },
    'supabase/deno-check': { check: checkDenoCheck },
    'supabase/deno-lint': { check: checkDenoLint },
    'supabase/service-role-key': { check: checkServiceRoleKey },
    'supabase/storage-policies': { check: checkStoragePolicies },
    'svelte/svelte-check': { check: checkSvelteCheck },
    'swift/build': { check: checkSwiftBuild },
    'swift/coverage': { check: checkCoverage },
    'swift/doc-comments': { check: checkSwiftDocComments },
    'swift/periphery': { check: checkPeriphery },
    'swift/skip-reasons': { check: checkSkipReasons },
    'swift/swiftlint': { listConfigs: listSwiftlintConfigs },
    'swift/swiftlint-analyze': { check: checkSwiftlintAnalyze },
    'translations/messages': { check: checkMessages },
    'typescript/tsc': { run: checkTsc },
    'typescript/tsconfig': { check: checkTsconfig },
    'vue/vue-tsc': { run: checkTsc },
    'xcode/app-transport-security': { check: checkAppTransportSecurity },
    'xcode/assets': { check: checkAssets },
    'xcode/entitlements': { check: checkEntitlements },
    'xcode/files-without-target': { check: checkFilesWithoutTarget },
    'xcode/unused-assets': { check: checkXcodeUnusedAssets },
    'xcode/xcstrings': { check: checkXcstrings },
};

/**
Find the implementation of a built-in check or a check that compares generator outputs.

@param check the manifest check.
*/
export function selectCheckCode(check: Check): CheckCode | undefined {
    const code = CHECK_CODE[check.id];
    if (check.generator_outputs !== undefined) return { check: checkGeneratorOutputs };
    return code;
}
