import { checkVale } from '#cli/checks/general/prose.ts';
import { runBuiltInCheck } from '#cli/checks/run/built-in.ts';
import { checkSemgrep } from '#cli/checks/general/security.ts';
import { checkExpoDoctor } from '#cli/checks/framework/expo.ts';
import { checkJscpd } from '#cli/checks/general/duplication.ts';
import { checkHtmlScripts } from '#cli/checks/language/html.ts';
import { checkNextjsTsc } from '#cli/checks/framework/nextjs.ts';
import { runSvelteCheck } from '#cli/checks/framework/svelte.ts';
import { runCheckCommand } from '#cli/checks/run/command/check.ts';
import { checkDeptry } from '#cli/checks/language/python/deptry.ts';
import { checkSiteBuild } from '#cli/checks/framework/site/build.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';
import { checkBashSafety } from '#cli/checks/language/bash/safety.ts';
import { checkCommitlintPushed } from '#cli/checks/general/commits.ts';
import { checkAllowedLicenses } from '#cli/checks/general/licenses.ts';
import { checkNginxSyntax } from '#cli/checks/infrastructure/nginx.ts';
import { checkTranslationMessages } from '#cli/checks/translations.ts';
import { checkAnsibleLint } from '#cli/checks/infrastructure/ansible.ts';
import { checkShellcheck } from '#cli/checks/language/bash/shellcheck.ts';
import { checkPydoclint } from '#cli/checks/language/python/pydoclint.ts';
import { checkSwiftTestsCoverage } from '#cli/checks/testing/coverage.ts';
import { checkSwiftSkipReasons } from '#cli/checks/testing/swift-tests.ts';
import { importLinter } from '#cli/checks/language/python/import-linter.ts';
import { checkLoneFiles } from '#cli/checks/general/structure/lone-files.ts';
import { checkLongFiles } from '#cli/checks/general/structure/long-files.ts';
import { checkSuppressions } from '#cli/checks/general/gspot/suppressions.ts';
import { checkLockfiles } from '#cli/checks/general/dependencies/lockfiles.ts';
import { checkDockerignore } from '#cli/checks/infrastructure/dockerignore.ts';
import { checkActionlint } from '#cli/checks/infrastructure/github-actions.ts';
import { checkBashDocComments } from '#cli/checks/language/bash/doc-comments.ts';
import { checkReleaseAge } from '#cli/checks/general/dependencies/release-age.ts';
import { checkGeneratedFiles } from '#cli/checks/general/gspot/generated-files.ts';
import { checkBashFunctionSize } from '#cli/checks/language/bash/function-size.ts';
import { checkBashScriptLayout } from '#cli/checks/language/bash/script-layout.ts';
import { checkSiteUnusedAssets } from '#cli/checks/framework/site/unused-assets.ts';
import { checkStaleGeneratorOutputs } from '#cli/checks/stale-generator-outputs.ts';
import { checkBashInlineScripts } from '#cli/checks/language/bash/inline-scripts.ts';
import { checkPythonPipInstalls } from '#cli/checks/language/python/pip-installs.ts';
import { checkTsc, checkJavascriptTsc } from '#cli/checks/language/typescript/tsc.ts';
import { checkTypescriptTsconfig } from '#cli/checks/language/typescript/tsconfig.ts';
import { checkForeignKeyIndexes } from '#cli/checks/database/postgres/foreign-keys.ts';
import { checkSharedPrefixes } from '#cli/checks/general/structure/shared-prefixes.ts';
import { checkXcodeUntargetedFiles } from '#cli/checks/infrastructure/xcode/project.ts';
import { checkUnmatchedPatterns } from '#cli/checks/general/gspot/unmatched-patterns.ts';
import { checkBashUnreadArguments } from '#cli/checks/language/bash/unread-arguments.ts';
import { checkBashUnusedFunctions } from '#cli/checks/language/bash/unused-functions.ts';
import { checkTrivialFunctions } from '#cli/checks/general/structure/trivial-functions.ts';
import { checkDocsMissingPaths, checkDocsRequiredFiles } from '#cli/checks/general/docs.ts';
import { checkLargeFiles, checkIgnoredFilesTracked } from '#cli/checks/general/repository.ts';
import { checkFileFolderClashes } from '#cli/checks/general/structure/file-folder-clashes.ts';
import { checkEnvironmentReaders } from '#cli/checks/general/structure/environment-readers.ts';
import { type RunnableCheck, type CheckImplementations } from '#cli/types/checks/run/check.ts';
import { checkDockerCompose, checkDockerTrivyImage } from '#cli/checks/infrastructure/docker.ts';
import { checkMarkdownFences, buildMarkdownlintArguments } from '#cli/checks/language/markdown.ts';
import { checkCloudflareHeaders, checkCloudflareRedirects } from '#cli/checks/platform/cloudflare.ts';
import { checkPythonPlaceholderDocstrings } from '#cli/checks/language/python/placeholder-docstrings.ts';
import { checkXcodeEntitlements, checkAppTransportSecurity } from '#cli/checks/infrastructure/xcode/settings.ts';
import { checkPostgresMigrationOrder, checkPostgresEditedMigrations } from '#cli/checks/database/postgres/history.ts';

import {
    checkNamingPaths,
    checkNamingIdentifiers,
    checkNamingAllowedNames,
} from '#cli/checks/general/naming/checks.ts';
import {
    checkXcstrings,
    checkXcodeAssets,
    checkXcodeUnusedAssets,
} from '#cli/checks/infrastructure/xcode/resources.ts';
import {
    checkPostgresGrants,
    checkRowLevelSecurity,
    checkDefinerSearchPath,
} from '#cli/checks/database/postgres/access.ts';
import {
    checkSecretsEnvExamples,
    checkSecretsGitleaksPushed,
    checkSecretsTrufflehogPushed,
} from '#cli/checks/general/secrets.ts';
import {
    checkSwiftBuild,
    checkSwiftPeriphery,
    checkSwiftlintAnalyze,
    listSwiftlintToolFiles,
} from '#cli/checks/language/swift/build.ts';
import {
    checkServiceRoleKey,
    checkSupabaseDenoLint,
    checkSupabaseDenoTypes,
    checkSupabaseStoragePolicies,
} from '#cli/checks/platform/supabase.ts';
import {
    checkSiteSize,
    checkSiteSitemap,
    checkSitePurgecss,
    checkSiteLinkinator,
    checkSiteHtmlValidate,
} from '#cli/checks/framework/site/pages.ts';

/** Every check implementation, by check ID. */
export const CHECK_IMPLEMENTATIONS = {
    'gspot/unmatched-patterns': { check: checkUnmatchedPatterns },
    'expo/expo-doctor': { check: checkExpoDoctor },
    'svelte/svelte-check': { check: runSvelteCheck },
    'translations/messages': { check: checkTranslationMessages },
    'ansible/ansible-lint': { check: checkAnsibleLint },
    'nginx/config-test': { check: checkNginxSyntax },
    'structure/trivial-functions': { check: checkTrivialFunctions },
    'structure/environment-readers': { check: checkEnvironmentReaders },
    'structure/long-files': { check: checkLongFiles },
    'gspot/suppressions': { check: checkSuppressions },
    'repository/large-files': { check: checkLargeFiles },
    'typescript/tsconfig': { check: checkTypescriptTsconfig },
    'docs/missing-paths': { check: checkDocsMissingPaths },
    'docs/required-files': { check: checkDocsRequiredFiles },
    'markdown/fences': { check: checkMarkdownFences },
    'duplication/jscpd': { check: checkJscpd },
    'secrets/env-examples': { check: checkSecretsEnvExamples },
    'repository/local-files': { check: checkIgnoredFilesTracked },
    'dependencies/release-age': { check: checkReleaseAge },
    'licenses/allowed': { check: checkAllowedLicenses },
    'dependencies/lockfiles': { check: checkLockfiles },
    'cloudflare/headers': { check: checkCloudflareHeaders },
    'cloudflare/redirects': { check: checkCloudflareRedirects },
    'site/build': { check: checkSiteBuild },
    'site/html-validate': { check: checkSiteHtmlValidate },
    'site/purgecss': { check: checkSitePurgecss },
    'site/linkinator': { check: checkSiteLinkinator },
    'site/size': { check: checkSiteSize },
    'site/sitemap': { check: checkSiteSitemap },
    'site/unused-assets': { check: checkSiteUnusedAssets },
    'html/scripts': { check: checkHtmlScripts },
    'python/placeholder-docstrings': { check: checkPythonPlaceholderDocstrings },
    'python/import-linter': { check: importLinter },
    'python/pip-installs': { check: checkPythonPipInstalls },
    'swift-tests/skip-reasons': { check: checkSwiftSkipReasons },
    'swift-tests/coverage': { check: checkSwiftTestsCoverage },
    'xcode/entitlements': { check: checkXcodeEntitlements },
    'xcode/app-transport-security': { check: checkAppTransportSecurity },
    'xcode/xcstrings': { check: checkXcstrings },
    'xcode/assets': { check: checkXcodeAssets },
    'xcode/unused-assets': { check: checkXcodeUnusedAssets },
    'xcode/files-without-target': { check: checkXcodeUntargetedFiles },
    'swift/build': { check: checkSwiftBuild },
    'swift/swiftlint-analyze': { check: checkSwiftlintAnalyze },
    'swift/periphery': { check: checkSwiftPeriphery },
    'supabase/storage-policies': { check: checkSupabaseStoragePolicies },
    'supabase/deno-lint': { check: checkSupabaseDenoLint },
    'supabase/deno-check': { check: checkSupabaseDenoTypes },
    'supabase/service-role-key': { check: checkServiceRoleKey },
    'postgres/row-level-security': { check: checkRowLevelSecurity },
    'postgres/grants': { check: checkPostgresGrants },
    'postgres/definer-search-path': { check: checkDefinerSearchPath },
    'postgres/foreign-key-indexes': { check: checkForeignKeyIndexes },
    'postgres/migration-order': { check: checkPostgresMigrationOrder },
    'postgres/edited-migrations': { check: checkPostgresEditedMigrations },
    'docker/dockerignore': { check: checkDockerignore },
    'docker/trivy-image': { check: checkDockerTrivyImage },
    'structure/lone-files': { check: checkLoneFiles },
    'structure/shared-prefixes': { check: checkSharedPrefixes },
    'structure/file-folder-clashes': { check: checkFileFolderClashes },
    'bash/function-size': { check: checkBashFunctionSize },
    'bash/doc-comments': { check: checkBashDocComments },
    'bash/unused-functions': { check: checkBashUnusedFunctions },
    'bash/unread-arguments': { check: checkBashUnreadArguments },
    'bash/script-layout': { check: checkBashScriptLayout },
    'bash/inline-scripts': { check: checkBashInlineScripts },
    'bash/safety': { check: checkBashSafety },
    'prose/vale': { check: checkVale },
    'naming/identifiers': { check: checkNamingIdentifiers },
    'naming/paths': { check: checkNamingPaths },
    'naming/allowed-names': { check: checkNamingAllowedNames },
    'markdown/markdownlint': { run: runCheckCommand, arguments: buildMarkdownlintArguments },
    'swift/swiftlint': { run: runCheckCommand, toolFiles: listSwiftlintToolFiles },
    'gspot/generated-files': { run: checkGeneratedFiles },
    'security/semgrep': { run: checkSemgrep },
    'nextjs/tsc': { run: checkNextjsTsc },
    'docker/compose': { run: checkDockerCompose },
    'secrets/trufflehog-pushed': { run: checkSecretsTrufflehogPushed },
    'secrets/gitleaks-pushed': { run: checkSecretsGitleaksPushed },
    'commits/commitlint-pushed': { run: checkCommitlintPushed },
    'vue/vue-tsc': { run: checkTsc },
    'typescript/tsc': { run: checkTsc },
    'javascript/tsc': { run: checkJavascriptTsc },
    'bash/shellcheck': { run: checkShellcheck },
    'python/pydoclint': { run: checkPydoclint },
    'python/deptry': { run: checkDeptry },
    'github-actions/actionlint': { run: checkActionlint },
} satisfies CheckImplementations;

/**
 * Pick the code that runs one check: the stale-output check, a built-in implementation, its own runner, or the tool
 * command.
 * @param check the check to run.
 * @returns the run function.
 */
export function selectCheckRun(check: CheckDeclaration): RunnableCheck['run'] {
    if (check.generator_outputs !== undefined) return runBuiltInCheck(checkStaleGeneratorOutputs);
    const builtIn = (CHECK_IMPLEMENTATIONS as CheckImplementations)[check.name];
    if (builtIn?.check !== undefined) return runBuiltInCheck(builtIn.check);
    const run = builtIn?.run ?? runCheckCommand;
    // A tool check with its own arguments or tool files gets them on every run.
    return (session, planned, options) =>
        run(session, planned, { ...options, arguments: builtIn?.arguments, toolFiles: builtIn?.toolFiles });
}
