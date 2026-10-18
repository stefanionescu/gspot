import { checkVale } from '#cli/checks/prose.ts';
import { checkSvelte } from '#cli/checks/svelte.ts';
import { checkExpoDoctor } from '#cli/checks/expo.ts';
import { checkHtmlScripts } from '#cli/checks/html.ts';
import { checkNextjsTsc } from '#cli/checks/nextjs.ts';
import { checkSemgrep } from '#cli/checks/security.ts';
import { checkJscpd } from '#cli/checks/duplication.ts';
import { checkNginxSyntax } from '#cli/checks/nginx.ts';
import { checkAnsibleLint } from '#cli/checks/ansible.ts';
import { checkDeptry } from '#cli/checks/python/deptry.ts';
import { checkSiteBuild } from '#cli/checks/site/build.ts';
import { checkBashSafety } from '#cli/checks/bash/safety.ts';
import { checkLockfiles } from '#cli/checks/dependencies.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { checkCommitlintPushed } from '#cli/checks/commits.ts';
import { checkAllowedLicenses } from '#cli/checks/licenses.ts';
import { checkActionlint } from '#cli/checks/github-actions.ts';
import { checkShellcheck } from '#cli/checks/bash/shellcheck.ts';
import { checkPydoclint } from '#cli/checks/python/pydoclint.ts';
import { checkDockerCompose } from '#cli/checks/docker/compose.ts';
import { checkSwiftCoverage } from '#cli/checks/swift/coverage.ts';
import { checkLoneFiles } from '#cli/checks/structure/lone-files.ts';
import { checkLongFiles } from '#cli/checks/structure/long-files.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';
import { checkSuppressions } from '#cli/checks/gspot/suppressions.ts';
import { checkDockerignore } from '#cli/checks/docker/dockerignore.ts';
import { checkTranslationMessages } from '#cli/checks/translations.ts';
import { checkFilesWithoutTarget } from '#cli/checks/xcode/project.ts';
import { checkBashDocComments } from '#cli/checks/bash/doc-comments.ts';
import { checkImportLinter } from '#cli/checks/python/import-linter.ts';
import { checkBashFunctionSize } from '#cli/checks/bash/function-size.ts';
import { checkBashScriptLayout } from '#cli/checks/bash/script-layout.ts';
import { checkDockerTrivyImage } from '#cli/checks/docker/trivy-image.ts';
import { checkSiteUnusedAssets } from '#cli/checks/site/unused-assets.ts';
import { checkSwiftSkipReasons } from '#cli/checks/swift/skip-reasons.ts';
import { checkGeneratedFiles } from '#cli/checks/gspot/generated-files.ts';
import { checkBashInlineScripts } from '#cli/checks/bash/inline-scripts.ts';
import { checkPythonPipInstalls } from '#cli/checks/python/pip-installs.ts';
import { checkLargeFiles, checkLocalFiles } from '#cli/checks/repository.ts';
import { checkTsc, checkJavascriptTsc } from '#cli/checks/typescript/tsc.ts';
import { checkTypescriptTsconfig } from '#cli/checks/typescript/tsconfig.ts';
import { checkForeignKeyIndexes } from '#cli/checks/postgres/foreign-keys.ts';
import { checkSharedPrefixes } from '#cli/checks/structure/shared-prefixes.ts';
import { checkBashUnreadArguments } from '#cli/checks/bash/unread-arguments.ts';
import { checkBashUnusedFunctions } from '#cli/checks/bash/unused-functions.ts';
import { checkUnmatchedPatterns } from '#cli/checks/gspot/unmatched-patterns.ts';
import { checkTrivialFunctions } from '#cli/checks/structure/trivial-functions.ts';
import { checkDocsMissingPaths, checkDocsRequiredFiles } from '#cli/checks/docs.ts';
import { checkFileFolderClashes } from '#cli/checks/structure/file-folder-clashes.ts';
import { checkEnvironmentReaders } from '#cli/checks/structure/environment-readers.ts';
import { checkStaleGeneratorOutputs } from '#cli/checks/gspot/stale-generator-outputs.ts';
import { checkMarkdownFences, buildMarkdownlintArguments } from '#cli/checks/markdown.ts';
import { checkCloudflareHeaders, checkCloudflareRedirects } from '#cli/checks/cloudflare.ts';
import { type CheckImplementation, type CheckImplementations } from '#cli/types/runs/check.ts';
import { checkPythonPlaceholderDocstrings } from '#cli/checks/python/placeholder-docstrings.ts';
import { checkXcodeEntitlements, checkAppTransportSecurity } from '#cli/checks/xcode/settings.ts';
import { checkXcstrings, checkXcodeAssets, checkXcodeUnusedAssets } from '#cli/checks/xcode/resources.ts';
import { checkPostgresMigrationOrder, checkPostgresEditedMigrations } from '#cli/checks/postgres/history.ts';
import { checkNamingPaths, checkNamingIdentifiers, checkNamingAllowedNames } from '#cli/checks/naming/checks.ts';
import { checkPostgresGrants, checkRowLevelSecurity, checkDefinerSearchPath } from '#cli/checks/postgres/access.ts';

import {
    checkSecretsEnvExamples,
    checkSecretsGitleaksPushed,
    checkSecretsTrufflehogPushed,
} from '#cli/checks/secrets.ts';
import {
    checkSwiftBuild,
    checkSwiftPeriphery,
    checkSwiftlintAnalyze,
    listSwiftlintToolFiles,
} from '#cli/checks/swift/build.ts';
import {
    checkSupabaseDeno,
    checkServiceRoleKey,
    checkSupabaseDenoLint,
    checkSupabaseStoragePolicies,
} from '#cli/checks/supabase.ts';
import {
    checkSiteSize,
    checkSiteSitemap,
    checkSitePurgecss,
    checkSiteLinkinator,
    checkSiteHtmlValidate,
} from '#cli/checks/site/pages.ts';

/** Every check implementation, by check ID. */
const CHECK_IMPLEMENTATIONS = {
    'gspot/unmatched-patterns': { check: checkUnmatchedPatterns },
    'expo/expo-doctor': { check: checkExpoDoctor },
    'svelte/svelte-check': { check: checkSvelte },
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
    'repository/local-files': { check: checkLocalFiles },
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
    'python/import-linter': { check: checkImportLinter },
    'python/pip-installs': { check: checkPythonPipInstalls },
    'swift/skip-reasons': { check: checkSwiftSkipReasons },
    'swift/coverage': { check: checkSwiftCoverage },
    'xcode/entitlements': { check: checkXcodeEntitlements },
    'xcode/app-transport-security': { check: checkAppTransportSecurity },
    'xcode/xcstrings': { check: checkXcstrings },
    'xcode/assets': { check: checkXcodeAssets },
    'xcode/unused-assets': { check: checkXcodeUnusedAssets },
    'xcode/files-without-target': { check: checkFilesWithoutTarget },
    'swift/build': { check: checkSwiftBuild },
    'swift/swiftlint-analyze': { check: checkSwiftlintAnalyze },
    'swift/periphery': { check: checkSwiftPeriphery },
    'supabase/storage-policies': { check: checkSupabaseStoragePolicies },
    'supabase/deno-lint': { check: checkSupabaseDenoLint },
    'supabase/deno-check': { check: checkSupabaseDeno },
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
 * Find the check implementation of one check: the stale-output check, or the implementation under its check ID.
 * @param check the check to run.
 * @returns the implementation, or undefined for a tool check that runs only its command.
 */
export function selectCheckImplementation(
    check: Pick<CheckDeclaration, 'name' | 'generator_outputs'>,
): CheckImplementation | undefined {
    if (check.generator_outputs !== undefined) return { check: checkStaleGeneratorOutputs };
    return (CHECK_IMPLEMENTATIONS as CheckImplementations)[check.name];
}
