import { checkExpoDoctor } from '#cli/checks/expo.ts';
import { checkProseVale } from '#cli/checks/prose.ts';
import { checkNextjsTsc } from '#cli/checks/nextjs.ts';
import { checkNginxSyntax } from '#cli/checks/nginx.ts';
import { checkSvelteCheck } from '#cli/checks/svelte.ts';
import { checkTsc } from '#cli/checks/typescript/tsc.ts';
import { checkAnsibleLint } from '#cli/checks/ansible.ts';
import type { Check } from '#cli/types/configurations.ts';
import type { CheckCode } from '#cli/types/runs/check.ts';
import { checkSiteBuild } from '#cli/checks/site/build.ts';
import { checkBashSafety } from '#cli/checks/bash/safety.ts';
import { checkHtmlInlineScripts } from '#cli/checks/html.ts';
import { checkMarkdownFences } from '#cli/checks/markdown.ts';
import { checkJavascriptTsc } from '#cli/checks/javascript.ts';
import { checkLicensesAllowed } from '#cli/checks/licenses.ts';
import { checkNamingPaths } from '#cli/checks/naming/paths.ts';
import { checkSecuritySemgrep } from '#cli/checks/security.ts';
import { checkPythonDeptry } from '#cli/checks/python/deptry.ts';
import { checkDockerCompose } from '#cli/checks/docker/compose.ts';
import { checkDuplicationJscpd } from '#cli/checks/duplication.ts';
import { checkPythonVulture } from '#cli/checks/python/vulture.ts';
import { checkSwiftCoverage } from '#cli/checks/swift/coverage.ts';
import { checkBashShellcheck } from '#cli/checks/bash/shellcheck.ts';
import { checkCommitsCommitlintPushed } from '#cli/checks/commits.ts';
import { checkDockerignore } from '#cli/checks/docker/dockerignore.ts';
import { checkPythonPydoclint } from '#cli/checks/python/pydoclint.ts';
import { checkFilesWithoutTarget } from '#cli/checks/xcode/project.ts';
import { checkBashDocComments } from '#cli/checks/bash/doc-comments.ts';
import { checkTranslationsMessages } from '#cli/checks/translations.ts';
import { checkGeneratorOutputs } from '#cli/checks/generator-outputs.ts';
import { checkBashFunctionSize } from '#cli/checks/bash/function-size.ts';
import { checkBashScriptLayout } from '#cli/checks/bash/script-layout.ts';
import { checkDockerTrivyImage } from '#cli/checks/docker/trivy-image.ts';
import { checkSiteUnusedAssets } from '#cli/checks/site/unused-assets.ts';
import { checkSwiftSkipReasons } from '#cli/checks/swift/skip-reasons.ts';
import { MARKDOWNLINT_PATH_PREFIX } from '#cli/config/checks/markdown.ts';
import { checkGspotSuppressions } from '#cli/checks/gspot/suppressions.ts';
import { checkNamingIdentifiers } from '#cli/checks/naming/identifiers.ts';
import { checkBashInlineScripts } from '#cli/checks/bash/inline-scripts.ts';
import { checkPythonPipInstalls } from '#cli/checks/python/pip-installs.ts';
import { checkGithubActionsActionlint } from '#cli/checks/github-actions.ts';
import { checkTypescriptTsconfig } from '#cli/checks/typescript/tsconfig.ts';
import { checkGspotReplacedFiles } from '#cli/checks/gspot/replaced-files.ts';
import { checkNamingAllowedNames } from '#cli/checks/naming/allowed-names.ts';
import { checkPythonFunctionSize } from '#cli/checks/python/function-size.ts';
import { checkStructureLoneFiles } from '#cli/checks/structure/lone-files.ts';
import { checkStructureLongFiles } from '#cli/checks/structure/long-files.ts';
import { checkBashUnreadArguments } from '#cli/checks/bash/unread-arguments.ts';
import { checkBashUnusedFunctions } from '#cli/checks/bash/unused-functions.ts';
import { checkReactVersions } from '#cli/checks/dependencies/react-versions.ts';
import { checkGspotGeneratedFiles } from '#cli/checks/gspot/generated-files.ts';
import { checkGspotUnmatchedPaths } from '#cli/checks/gspot/unmatched-paths.ts';
import { checkStructureImportRules } from '#cli/checks/structure/import-rules.ts';
import { checkDependenciesLockfiles } from '#cli/checks/dependencies/lockfiles.ts';
import { checkDocsMissingPaths, checkDocsRequiredFiles } from '#cli/checks/docs.ts';
import { checkForeignKeyIndexes } from '#cli/checks/postgres/foreign-key-indexes.ts';
import { checkFileFolderClashes } from '#cli/checks/structure/file-folder-clashes.ts';
import { checkStructureSharedPrefixes } from '#cli/checks/structure/shared-prefixes.ts';
import { checkPackageManagerPin } from '#cli/checks/dependencies/package-manager-pin.ts';
import { checkDependenciesStaleLockfile } from '#cli/checks/dependencies/stale-lockfile.ts';
import { checkStructureTrivialFunctions } from '#cli/checks/structure/trivial-functions.ts';
import { checkCloudflareHeaders, checkCloudflareRedirects } from '#cli/checks/cloudflare.ts';
import { checkSecretsEnvExamples, checkSecretsGitleaksPushed } from '#cli/checks/secrets.ts';
import { checkPythonPlaceholderDocstrings } from '#cli/checks/python/placeholder-docstrings.ts';
import { checkStructureEnvironmentReaders } from '#cli/checks/structure/environment-readers.ts';
import { checkRepositoryLargeFiles, checkRepositoryLocalFiles } from '#cli/checks/repository.ts';
import { checkXcodeEntitlements, checkAppTransportSecurity } from '#cli/checks/xcode/settings.ts';
import { checkPostgresMigrationOrder, checkPostgresEditedMigrations } from '#cli/checks/postgres/history.ts';
import { checkXcodeAssets, checkXcodeXcstrings, checkXcodeUnusedAssets } from '#cli/checks/xcode/resources.ts';
import { checkPostgresGrants, checkRowLevelSecurity, checkDefinerSearchPath } from '#cli/checks/postgres/access.ts';

import {
    checkSwiftBuild,
    checkSwiftPeriphery,
    listSwiftlintToolFiles,
    checkSwiftSwiftlintAnalyze,
} from '#cli/checks/swift/build.ts';
import {
    checkSiteSize,
    checkSiteLychee,
    checkSiteSitemap,
    checkSitePurgecss,
    checkSiteHtmlValidate,
} from '#cli/checks/site/pages.ts';
import {
    checkServiceRoleKey,
    checkSupabaseDenoLint,
    checkSupabaseDenoCheck,
    checkSupabaseStoragePolicies,
} from '#cli/checks/supabase.ts';

/** The code of each check, keyed by check ID. */
const CHECK_CODE: Record<string, CheckCode> = {
    'ansible/ansible-lint': { check: checkAnsibleLint },
    'bash/doc-comments': { check: checkBashDocComments },
    'bash/function-size': { check: checkBashFunctionSize },
    'bash/inline-scripts': { check: checkBashInlineScripts },
    'bash/safety': { check: checkBashSafety },
    'bash/script-layout': { check: checkBashScriptLayout },
    'bash/shellcheck': { run: checkBashShellcheck },
    'bash/unread-arguments': { check: checkBashUnreadArguments },
    'bash/unused-functions': { check: checkBashUnusedFunctions },
    'cloudflare/headers': { check: checkCloudflareHeaders },
    'cloudflare/redirects': { check: checkCloudflareRedirects },
    'commits/commitlint-pushed': { run: checkCommitsCommitlintPushed },
    'dependencies/lockfiles': { check: checkDependenciesLockfiles },
    'dependencies/package-manager-pin': { check: checkPackageManagerPin },
    'react-dom/react-versions': { check: checkReactVersions },
    'dependencies/stale-lockfile': { check: checkDependenciesStaleLockfile },
    'docker/compose': { run: checkDockerCompose },
    'docker/dockerignore': { check: checkDockerignore },
    'docker/trivy-image': { check: checkDockerTrivyImage },
    'docs/missing-paths': { check: checkDocsMissingPaths },
    'docs/required-files': { check: checkDocsRequiredFiles },
    'duplication/jscpd': { check: checkDuplicationJscpd },
    'expo/expo-doctor': { check: checkExpoDoctor },
    'github-actions/actionlint': { run: checkGithubActionsActionlint },
    'gspot/generated-files': { run: checkGspotGeneratedFiles },
    'gspot/replaced-files': { run: checkGspotReplacedFiles },
    'gspot/suppressions': { check: checkGspotSuppressions },
    'gspot/unmatched-paths': { check: checkGspotUnmatchedPaths },
    'html/inline-scripts': { check: checkHtmlInlineScripts },
    'javascript/tsc': { run: checkJavascriptTsc },
    'licenses/allowed': { check: checkLicensesAllowed },
    'markdown/fences': { check: checkMarkdownFences },
    'markdown/markdownlint': {
        listFileArguments: (_session, planned) =>
            planned.files.map((file) => `${MARKDOWNLINT_PATH_PREFIX}${file.path}`),
    },
    'naming/allowed-names': { check: checkNamingAllowedNames },
    'naming/identifiers': { check: checkNamingIdentifiers },
    'naming/paths': { check: checkNamingPaths },
    'nextjs/tsc': { run: checkNextjsTsc },
    'nginx/syntax': { check: checkNginxSyntax },
    'postgres/definer-search-path': { check: checkDefinerSearchPath },
    'postgres/edited-migrations': { check: checkPostgresEditedMigrations },
    'postgres/foreign-key-indexes': { check: checkForeignKeyIndexes },
    'postgres/grants': { check: checkPostgresGrants },
    'postgres/migration-order': { check: checkPostgresMigrationOrder },
    'postgres/row-level-security': { check: checkRowLevelSecurity },
    'prose/vale': { check: checkProseVale },
    'python/deptry': { run: checkPythonDeptry },
    'python/function-size': { check: checkPythonFunctionSize },
    'python/pip-installs': { check: checkPythonPipInstalls },
    'python/placeholder-docstrings': { check: checkPythonPlaceholderDocstrings },
    'python/pydoclint': { run: checkPythonPydoclint },
    'python/vulture': { check: checkPythonVulture },
    'repository/large-files': { check: checkRepositoryLargeFiles },
    'repository/local-files': { check: checkRepositoryLocalFiles },
    'secrets/env-examples': { check: checkSecretsEnvExamples },
    'secrets/gitleaks-pushed': { run: checkSecretsGitleaksPushed },
    'security/semgrep': { run: checkSecuritySemgrep },
    'site/build': { check: checkSiteBuild },
    'site/html-validate': { check: checkSiteHtmlValidate },
    'site/lychee': { check: checkSiteLychee },
    'site/purgecss': { check: checkSitePurgecss },
    'site/sitemap': { check: checkSiteSitemap },
    'site/size': { check: checkSiteSize },
    'site/unused-assets': { check: checkSiteUnusedAssets },
    'structure/environment-readers': { check: checkStructureEnvironmentReaders },
    'structure/file-folder-clashes': { check: checkFileFolderClashes },
    'structure/import-rules': { check: checkStructureImportRules },
    'structure/lone-files': { check: checkStructureLoneFiles },
    'structure/long-files': { check: checkStructureLongFiles },
    'structure/shared-prefixes': { check: checkStructureSharedPrefixes },
    'structure/trivial-functions': { check: checkStructureTrivialFunctions },
    'supabase/deno-check': { check: checkSupabaseDenoCheck },
    'supabase/deno-lint': { check: checkSupabaseDenoLint },
    'supabase/service-role-key': { check: checkServiceRoleKey },
    'supabase/storage-policies': { check: checkSupabaseStoragePolicies },
    'svelte/svelte-check': { check: checkSvelteCheck },
    'swift/build': { check: checkSwiftBuild },
    'swift/coverage': { check: checkSwiftCoverage },
    'swift/periphery': { check: checkSwiftPeriphery },
    'swift/skip-reasons': { check: checkSwiftSkipReasons },
    'swift/swiftlint': { listToolFiles: listSwiftlintToolFiles },
    'swift/swiftlint-analyze': { check: checkSwiftSwiftlintAnalyze },
    'translations/messages': { check: checkTranslationsMessages },
    'typescript/tsc': { run: checkTsc },
    'typescript/tsconfig': { check: checkTypescriptTsconfig },
    'vue/vue-tsc': { run: checkTsc },
    'xcode/app-transport-security': { check: checkAppTransportSecurity },
    'xcode/assets': { check: checkXcodeAssets },
    'xcode/entitlements': { check: checkXcodeEntitlements },
    'xcode/files-without-target': { check: checkFilesWithoutTarget },
    'xcode/unused-assets': { check: checkXcodeUnusedAssets },
    'xcode/xcstrings': { check: checkXcodeXcstrings },
};

/**
 * Find the code of one check: the generator output check, or the code under its check ID.
 *
 * @param check the check to run.
 * @returns the check code, or undefined for a check that runs only its declared command.
 */
export function findCheckCode(check: Pick<Check, 'id' | 'generator_outputs'>): CheckCode | undefined {
    if (check.generator_outputs !== undefined) return { check: checkGeneratorOutputs };
    return CHECK_CODE[check.id];
}
