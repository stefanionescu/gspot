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
import { checkVulture } from '#cli/checks/python/vulture.ts';
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
import { checkLockfiles } from '#cli/checks/dependencies/lockfiles.ts';
import { checkDockerignore } from '#cli/checks/docker/dockerignore.ts';
import { checkTranslationMessages } from '#cli/checks/translations.ts';
import { checkFilesWithoutTarget } from '#cli/checks/xcode/project.ts';
import { checkBashDocComments } from '#cli/checks/bash/doc-comments.ts';
import { checkReplacedFiles } from '#cli/checks/gspot/replaced-files.ts';
import { checkImportRules } from '#cli/checks/structure/import-rules.ts';
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
import { checkStaleGeneratorOutputs } from '#cli/checks/generator-outputs.ts';
import { checkForeignKeyIndexes } from '#cli/checks/postgres/foreign-keys.ts';
import { checkPythonFunctionSize } from '#cli/checks/python/function-size.ts';
import { checkSharedPrefixes } from '#cli/checks/structure/shared-prefixes.ts';
import { checkBashUnreadArguments } from '#cli/checks/bash/unread-arguments.ts';
import { checkBashUnusedFunctions } from '#cli/checks/bash/unused-functions.ts';
import { checkReactVersions } from '#cli/checks/dependencies/react-versions.ts';
import { checkStaleLockfile } from '#cli/checks/dependencies/stale-lockfile.ts';
import { checkUnmatchedPatterns } from '#cli/checks/gspot/unmatched-patterns.ts';
import { checkTrivialFunctions } from '#cli/checks/structure/trivial-functions.ts';
import { checkDocsMissingPaths, checkDocsRequiredFiles } from '#cli/checks/docs.ts';
import { checkFileFolderClashes } from '#cli/checks/structure/file-folder-clashes.ts';
import { checkEnvironmentReaders } from '#cli/checks/structure/environment-readers.ts';
import { checkPackageManagerPin } from '#cli/checks/dependencies/package-manager-pin.ts';
import { checkMarkdownFences, buildMarkdownlintArguments } from '#cli/checks/markdown.ts';
import { checkCloudflareHeaders, checkCloudflareRedirects } from '#cli/checks/cloudflare.ts';
import { checkSecretsEnvExamples, checkSecretsGitleaksPushed } from '#cli/checks/secrets.ts';
import { type CheckImplementation, type CheckImplementations } from '#cli/types/runs/check.ts';
import { checkPythonPlaceholderDocstrings } from '#cli/checks/python/placeholder-docstrings.ts';
import { checkXcodeEntitlements, checkAppTransportSecurity } from '#cli/checks/xcode/settings.ts';
import { checkXcstrings, checkXcodeAssets, checkXcodeUnusedAssets } from '#cli/checks/xcode/resources.ts';
import { checkPostgresMigrationOrder, checkPostgresEditedMigrations } from '#cli/checks/postgres/history.ts';
import { checkNamingPaths, checkNamingIdentifiers, checkNamingAllowedNames } from '#cli/checks/naming/checks.ts';
import { checkPostgresGrants, checkRowLevelSecurity, checkDefinerSearchPath } from '#cli/checks/postgres/access.ts';

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
    checkSiteLychee,
    checkSiteSitemap,
    checkSitePurgecss,
    checkSiteHtmlValidate,
} from '#cli/checks/site/pages.ts';

/** Every check implementation, by check ID. */
const CHECK_IMPLEMENTATIONS: CheckImplementations = {
    'ansible/ansible-lint': { check: checkAnsibleLint },
    'bash/doc-comments': { check: checkBashDocComments },
    'bash/function-size': { check: checkBashFunctionSize },
    'bash/inline-scripts': { check: checkBashInlineScripts },
    'bash/safety': { check: checkBashSafety },
    'bash/script-layout': { check: checkBashScriptLayout },
    'bash/shellcheck': { run: checkShellcheck },
    'bash/unread-arguments': { check: checkBashUnreadArguments },
    'bash/unused-functions': { check: checkBashUnusedFunctions },
    'cloudflare/headers': { check: checkCloudflareHeaders },
    'cloudflare/redirects': { check: checkCloudflareRedirects },
    'commits/commitlint-pushed': { run: checkCommitlintPushed },
    'dependencies/lockfiles': { check: checkLockfiles },
    'dependencies/package-manager-pin': { check: checkPackageManagerPin },
    'dependencies/react-versions': { check: checkReactVersions },
    'dependencies/stale-lockfile': { check: checkStaleLockfile },
    'docker/compose': { run: checkDockerCompose },
    'docker/dockerignore': { check: checkDockerignore },
    'docker/trivy-image': { check: checkDockerTrivyImage },
    'docs/missing-paths': { check: checkDocsMissingPaths },
    'docs/required-files': { check: checkDocsRequiredFiles },
    'duplication/jscpd': { check: checkJscpd },
    'expo/expo-doctor': { check: checkExpoDoctor },
    'github-actions/actionlint': { run: checkActionlint },
    'gspot/generated-files': { run: checkGeneratedFiles },
    'gspot/replaced-files': { run: checkReplacedFiles },
    'gspot/suppressions': { check: checkSuppressions },
    'gspot/unmatched-patterns': { check: checkUnmatchedPatterns },
    'html/scripts': { check: checkHtmlScripts },
    'javascript/tsc': { run: checkJavascriptTsc },
    'licenses/allowed': { check: checkAllowedLicenses },
    'markdown/fences': { check: checkMarkdownFences },
    'markdown/markdownlint': { arguments: (_session, planned) => buildMarkdownlintArguments(planned) },
    'naming/allowed-names': { check: checkNamingAllowedNames },
    'naming/identifiers': { check: checkNamingIdentifiers },
    'naming/paths': { check: checkNamingPaths },
    'nextjs/tsc': { run: checkNextjsTsc },
    'nginx/config-test': { check: checkNginxSyntax },
    'postgres/definer-search-path': { check: checkDefinerSearchPath },
    'postgres/edited-migrations': { check: checkPostgresEditedMigrations },
    'postgres/foreign-key-indexes': { check: checkForeignKeyIndexes },
    'postgres/grants': { check: checkPostgresGrants },
    'postgres/migration-order': { check: checkPostgresMigrationOrder },
    'postgres/row-level-security': { check: checkRowLevelSecurity },
    'prose/vale': { check: checkVale },
    'python/deptry': { run: checkDeptry },
    'python/function-size': { check: checkPythonFunctionSize },
    'python/pip-installs': { check: checkPythonPipInstalls },
    'python/placeholder-docstrings': { check: checkPythonPlaceholderDocstrings },
    'python/pydoclint': { run: checkPydoclint },
    'python/vulture': { check: checkVulture },
    'repository/large-files': { check: checkLargeFiles },
    'repository/local-files': { check: checkLocalFiles },
    'secrets/env-examples': { check: checkSecretsEnvExamples },
    'secrets/gitleaks-pushed': { run: checkSecretsGitleaksPushed },
    'security/semgrep': { run: checkSemgrep },
    'site/build': { check: checkSiteBuild },
    'site/html-validate': { check: checkSiteHtmlValidate },
    'site/lychee': { check: checkSiteLychee },
    'site/purgecss': { check: checkSitePurgecss },
    'site/sitemap': { check: checkSiteSitemap },
    'site/size': { check: checkSiteSize },
    'site/unused-assets': { check: checkSiteUnusedAssets },
    'structure/environment-readers': { check: checkEnvironmentReaders },
    'structure/file-folder-clashes': { check: checkFileFolderClashes },
    'structure/import-rules': { check: checkImportRules },
    'structure/lone-files': { check: checkLoneFiles },
    'structure/long-files': { check: checkLongFiles },
    'structure/shared-prefixes': { check: checkSharedPrefixes },
    'structure/trivial-functions': { check: checkTrivialFunctions },
    'supabase/deno-check': { check: checkSupabaseDeno },
    'supabase/deno-lint': { check: checkSupabaseDenoLint },
    'supabase/service-role-key': { check: checkServiceRoleKey },
    'supabase/storage-policies': { check: checkSupabaseStoragePolicies },
    'svelte/svelte-check': { check: checkSvelte },
    'swift/build': { check: checkSwiftBuild },
    'swift/coverage': { check: checkSwiftCoverage },
    'swift/periphery': { check: checkSwiftPeriphery },
    'swift/skip-reasons': { check: checkSwiftSkipReasons },
    'swift/swiftlint': { toolFiles: listSwiftlintToolFiles },
    'swift/swiftlint-analyze': { check: checkSwiftlintAnalyze },
    'translations/messages': { check: checkTranslationMessages },
    'typescript/tsc': { run: checkTsc },
    'typescript/tsconfig': { check: checkTypescriptTsconfig },
    'vue/vue-tsc': { run: checkTsc },
    'xcode/app-transport-security': { check: checkAppTransportSecurity },
    'xcode/assets': { check: checkXcodeAssets },
    'xcode/entitlements': { check: checkXcodeEntitlements },
    'xcode/files-without-target': { check: checkFilesWithoutTarget },
    'xcode/unused-assets': { check: checkXcodeUnusedAssets },
    'xcode/xcstrings': { check: checkXcstrings },
};

/**
 * Find the check implementation of one check: the stale-output check, or the implementation under its check ID.
 *
 * @param check the check to run.
 * @returns the implementation, or undefined for a tool check that runs only its command.
 */
export function selectCheckImplementation(
    check: Pick<CheckDeclaration, 'name' | 'generator_outputs'>,
): CheckImplementation | undefined {
    if (check.generator_outputs !== undefined) return { check: checkStaleGeneratorOutputs };
    return CHECK_IMPLEMENTATIONS[check.name];
}
