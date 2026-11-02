import type { Check } from '#cli/types/manifests.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import { checkTsc } from '#cli/configurations/tsc/check.ts';
import { checkYaml } from '#cli/configurations/general/data-files/checks.ts';
import { checkAllowed } from '#cli/configurations/general/licenses/checks.ts';
import { checkSemgrep } from '#cli/configurations/general/security/checks.ts';
import { checkFences } from '#cli/configurations/language/markdown/checks.ts';
import { checkExpoDoctor } from '#cli/configurations/framework/expo/checks.ts';
import { checkNextjsTsc } from '#cli/configurations/framework/nextjs/checks.ts';
import { checkPaths } from '#cli/configurations/general/naming/checks/paths.ts';
import { checkGeneratorOutputs } from '#cli/configurations/generator-outputs.ts';
import { checkSyntax } from '#cli/configurations/infrastructure/nginx/checks.ts';
import { checkSafety } from '#cli/configurations/language/bash/checks/safety.ts';
import { checkSvelteCheck } from '#cli/configurations/framework/svelte/checks.ts';
import { checkTsconfig } from '#cli/configurations/language/typescript/checks.ts';
import { checkJscpd } from '#cli/configurations/general/structure/checks/jscpd.ts';
import { checkMessages } from '#cli/configurations/library/translations/checks.ts';
import { checkPytestCoverage } from '#cli/configurations/testing/pytest/checks.ts';
import { checkSiteBuild } from '#cli/configurations/framework/site/checks/build.ts';
import { checkGrants } from '#cli/configurations/database/postgres/checks/grants.ts';
import { checkAgentsFiles } from '#cli/configurations/general/engineering/checks.ts';
import { checkBaseline } from '#cli/configurations/general/gspot/checks/baseline.ts';
import { checkHtmlInlineScripts } from '#cli/configurations/language/html/checks.ts';
import { checkSwiftBuild } from '#cli/configurations/language/swift/checks/build.ts';
import { checkCoverage } from '#cli/configurations/language/swift/checks/coverage.ts';
import { checkReactVersions } from '#cli/configurations/framework/react-dom/checks.ts';
import { checkAnsibleLint } from '#cli/configurations/infrastructure/ansible/checks.ts';
import { checkPeriphery } from '#cli/configurations/language/swift/checks/periphery.ts';
import { checkWeakenings } from '#cli/configurations/general/gspot/checks/weakenings.ts';
import { checkShellcheck } from '#cli/configurations/language/bash/checks/shellcheck.ts';
import { checkCompose } from '#cli/configurations/infrastructure/docker/checks/compose.ts';
import { checkSwiftSecurity } from '#cli/configurations/language/swift/checks/security.ts';
import { checkIdentifiers } from '#cli/configurations/general/naming/checks/identifiers.ts';
import { checkLoneFiles } from '#cli/configurations/general/structure/checks/lone-files.ts';
import { checkLongFiles } from '#cli/configurations/general/structure/checks/long-files.ts';
import { YAML_RULE_DOCS, WEAKENING_RULE_DOCS } from '#cli/config/configurations/registry.ts';
import { checkSuppressions } from '#cli/configurations/general/gspot/checks/suppressions.ts';
import { checkSkipReasons } from '#cli/configurations/language/swift/checks/skip-reasons.ts';
import { checkBareBlocks } from '#cli/configurations/general/structure/checks/bare-blocks.ts';
import { checkScriptLayout } from '#cli/configurations/language/bash/checks/script-layout.ts';
import { checkAllowedNames } from '#cli/configurations/general/naming/checks/allowed-names.ts';
import { checkSwiftlintAnalyze } from '#cli/configurations/language/swift/checks/swiftlint.ts';
import { checkImportRules } from '#cli/configurations/general/structure/checks/import-rules.ts';
import { checkBashDocComments } from '#cli/configurations/language/bash/checks/doc-comments.ts';
import { checkHeaders, checkRedirects } from '#cli/configurations/platform/cloudflare/checks.ts';
import { checkGeneratedFiles } from '#cli/configurations/general/gspot/checks/generated-files.ts';
import { checkUnmatchedPaths } from '#cli/configurations/general/gspot/checks/unmatched-paths.ts';
import { checkTrivyImage } from '#cli/configurations/infrastructure/docker/checks/trivy-image.ts';
import { checkBashFunctionSize } from '#cli/configurations/language/bash/checks/function-size.ts';
import { checkSwiftDocComments } from '#cli/configurations/language/swift/checks/doc-comments.ts';
import { checkSiteUnusedAssets } from '#cli/configurations/framework/site/checks/unused-assets.ts';
import { checkFunctionOrder } from '#cli/configurations/general/structure/checks/function-order.ts';
import { checkBashInlineScripts } from '#cli/configurations/language/bash/checks/inline-scripts.ts';
import { checkUnreadArguments } from '#cli/configurations/language/bash/checks/unread-arguments.ts';
import { checkUnusedFunctions } from '#cli/configurations/language/bash/checks/unused-functions.ts';
import { checkDockerignore } from '#cli/configurations/infrastructure/docker/checks/dockerignore.ts';
import { checkInstructions } from '#cli/configurations/infrastructure/docker/checks/instructions.ts';
import { checkMigrationOrder } from '#cli/configurations/database/postgres/checks/migration-order.ts';
import { checkSharedPrefixes } from '#cli/configurations/general/structure/checks/shared-prefixes.ts';
import { checkReferences, checkCommitlintPushed } from '#cli/configurations/general/commits/checks.ts';
import { checkVale, checkDates, checkCommitMessage } from '#cli/configurations/general/prose/checks.ts';
import { checkEditedMigrations } from '#cli/configurations/database/postgres/checks/edited-migrations.ts';
import { checkConflictingConfigs } from '#cli/configurations/general/gspot/checks/conflicting-configs.ts';
import { checkTrivialFunctions } from '#cli/configurations/general/structure/checks/trivial-functions.ts';
import { checkRowLevelSecurity } from '#cli/configurations/database/postgres/checks/row-level-security.ts';
import { checkDefinerSearchPath } from '#cli/configurations/database/postgres/checks/definer-search-path.ts';
import { checkForeignKeyIndexes } from '#cli/configurations/database/postgres/checks/foreign-key-indexes.ts';
import { checkFileFolderClashes } from '#cli/configurations/general/structure/checks/file-folder-clashes.ts';
import { checkJavascriptTsc, checkJavascriptBiome } from '#cli/configurations/language/javascript/checks.ts';
import { checkEnvironmentReaders } from '#cli/configurations/general/structure/checks/environment-readers.ts';
import { checkPassThroughFolders } from '#cli/configurations/general/structure/checks/pass-through-folders.ts';
import { checkDetectedConfigurations } from '#cli/configurations/general/gspot/checks/detected-configurations.ts';
import { checkActionlint, checkWorkflowShape } from '#cli/configurations/infrastructure/github-actions/checks.ts';
import { checkMissingPaths, checkRequiredFiles, checkVersionStrings } from '#cli/configurations/general/docs/checks.ts';
import { checkEnvExamples, checkEnvDefaults, checkGitleaksPushed } from '#cli/configurations/general/secrets/checks.ts';

import {
    checkLockfiles,
    checkStaleLockfile,
    checkPackageManagerPin,
} from '#cli/configurations/general/dependencies/checks.ts';
import {
    checkLychee,
    checkSitemap,
    checkPurgecss,
    checkHtmlValidate,
} from '#cli/configurations/framework/site/checks/pages.ts';
import {
    checkEncoding,
    checkLargeFiles,
    checkLocalFiles,
    checkConflictMarkers,
} from '#cli/configurations/general/repository/checks.ts';
import {
    checkDenoLint,
    checkDenoCheck,
    checkVerifyJwt,
    checkServiceRoleKey,
    checkStoragePolicies,
} from '#cli/configurations/platform/supabase/checks.ts';
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
    checkBuildSettings,
    checkXcodeUnusedAssets,
    checkFilesWithoutTarget,
    checkAppTransportSecurity,
} from '#cli/configurations/infrastructure/xcode/checks.ts';

export const CHECK_CODE: Record<string, CheckCode> = {
    'ansible/ansible-lint': { check: checkAnsibleLint },
    'ansible/ansible-lint-production': { check: checkAnsibleLint },
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
    'docker/instructions': { check: checkInstructions },
    'docker/trivy-image': { check: checkTrivyImage },
    'docs/missing-paths': { check: checkMissingPaths },
    'docs/required-files': { check: checkRequiredFiles },
    'docs/version-strings': { check: checkVersionStrings },
    'engineering/nested-agents-files': { check: checkAgentsFiles },
    'structure/jscpd': { check: checkJscpd },
    'expo/expo-doctor': { check: checkExpoDoctor },
    'github-actions/actionlint': { run: checkActionlint },
    'gspot/baseline': { check: checkBaseline, runsLast: true },
    'github-actions/workflow-shape': { check: checkWorkflowShape },
    'gspot/detected-configurations': { check: checkDetectedConfigurations },
    'gspot/generated-files': { check: checkGeneratedFiles },
    'gspot/conflicting-configs': { check: checkConflictingConfigs },
    'gspot/suppressions': { check: checkSuppressions },
    'gspot/unmatched-paths': { check: checkUnmatchedPaths },
    'gspot/weakenings': { check: checkWeakenings, ruleDocs: WEAKENING_RULE_DOCS },
    'html/inline-scripts': { check: checkHtmlInlineScripts },
    'javascript/tsc': { run: checkJavascriptTsc },
    'javascript/biome': { run: checkJavascriptBiome },
    'licenses/allowed': { check: checkAllowed },
    'markdown/fences': { check: checkFences },
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
    'prose/commit-message': { check: checkCommitMessage },
    'prose/dates': { check: checkDates },
    'prose/vale': { check: checkVale },
    'python/deptry': { run: checkDeptry },
    'python/function-size': { check: checkPythonFunctionSize },
    'python/pip-installs': { check: checkPipInstalls },
    'python/placeholder-docstrings': { check: checkPlaceholderDocstrings },
    'python/pydoclint': { run: checkPydoclint },
    'python/vulture': { check: checkVulture },
    'pytest/tests': { run: checkPytestCoverage },
    'repository/conflict-markers': { check: checkConflictMarkers },
    'repository/encoding': { check: checkEncoding },
    'react-dom/react-versions': { check: checkReactVersions },
    'repository/large-files': { check: checkLargeFiles },
    'repository/local-files': { check: checkLocalFiles },
    'secrets/environment-examples': { check: checkEnvExamples },
    'secrets/environment-defaults': { check: checkEnvDefaults },
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
    'supabase/verify-jwt': { check: checkVerifyJwt },
    'svelte/svelte-check': { check: checkSvelteCheck },
    'swift/build': { check: checkSwiftBuild },
    'swift/tests': { check: checkCoverage },
    'swift/doc-comments': { check: checkSwiftDocComments },
    'swift/periphery': { check: checkPeriphery },
    'swift/security': { check: checkSwiftSecurity },
    'swift/skip-reasons': { check: checkSkipReasons },
    'swift/swiftlint-analyze': { check: checkSwiftlintAnalyze },
    'translations/messages': { check: checkMessages },
    'typescript/tsc': { run: checkTsc },
    'typescript/tsconfig': { check: checkTsconfig },
    'vue/vue-tsc': { run: checkTsc },
    'xcode/app-transport-security': { check: checkAppTransportSecurity },
    'xcode/assets': { check: checkAssets },
    'xcode/build-settings': { check: checkBuildSettings },
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
