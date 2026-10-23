import { checkTsc } from '#cli/checks/tsc/check.ts';
import type { Check } from '#cli/types/configurations.ts';
import type { CheckCode } from '#cli/types/runs/check.ts';
import { checkProseVale } from '#cli/checks/general/prose.ts';
import { checkExpoDoctor } from '#cli/checks/framework/expo.ts';
import { checkNextjsTsc } from '#cli/checks/framework/nextjs.ts';
import { checkSvelteCheck } from '#cli/checks/framework/svelte.ts';
import { checkSiteBuild } from '#cli/checks/framework/site/build.ts';
import { checkBashSafety } from '#cli/checks/language/bash/safety.ts';
import { checkHtmlInlineScripts } from '#cli/checks/language/html.ts';
import { checkLicensesAllowed } from '#cli/checks/general/licenses.ts';
import { checkNamingPaths } from '#cli/checks/general/naming/paths.ts';
import { checkSecuritySemgrep } from '#cli/checks/general/security.ts';
import { checkNginxSyntax } from '#cli/checks/infrastructure/nginx.ts';
import { checkMarkdownFences } from '#cli/checks/language/markdown.ts';
import { checkReactVersions } from '#cli/checks/framework/react-dom.ts';
import { checkJavascriptTsc } from '#cli/checks/language/javascript.ts';
import { checkTranslationsMessages } from '#cli/checks/translations.ts';
import { checkGeneratorOutputs } from '#cli/checks/generator-outputs.ts';
import { checkAnsibleLint } from '#cli/checks/infrastructure/ansible.ts';
import { checkPythonDeptry } from '#cli/checks/language/python/deptry.ts';
import { MARKDOWNLINT_PATH_PREFIX } from '#cli/config/checks/registry.ts';
import { checkDuplicationJscpd } from '#cli/checks/general/duplication.ts';
import { checkPythonVulture } from '#cli/checks/language/python/vulture.ts';
import { checkSwiftCoverage } from '#cli/checks/language/swift/coverage.ts';
import { checkTypescriptTsconfig } from '#cli/checks/language/typescript.ts';
import { checkCommitsCommitlintPushed } from '#cli/checks/general/commits.ts';
import { checkBashShellcheck } from '#cli/checks/language/bash/shellcheck.ts';
import { checkPythonPydoclint } from '#cli/checks/language/python/pydoclint.ts';
import { checkBashDocComments } from '#cli/checks/language/bash/doc-comments.ts';
import { checkDockerCompose } from '#cli/checks/infrastructure/docker/compose.ts';
import { checkGspotSuppressions } from '#cli/checks/general/gspot/suppressions.ts';
import { checkNamingIdentifiers } from '#cli/checks/general/naming/identifiers.ts';
import { checkBashFunctionSize } from '#cli/checks/language/bash/function-size.ts';
import { checkBashScriptLayout } from '#cli/checks/language/bash/script-layout.ts';
import { checkSwiftSkipReasons } from '#cli/checks/language/swift/skip-reasons.ts';
import { checkSiteUnusedAssets } from '#cli/checks/framework/site/unused-assets.ts';
import { checkBashInlineScripts } from '#cli/checks/language/bash/inline-scripts.ts';
import { checkPythonPipInstalls } from '#cli/checks/language/python/pip-installs.ts';
import { checkNamingAllowedNames } from '#cli/checks/general/naming/allowed-names.ts';
import { checkStructureLoneFiles } from '#cli/checks/general/structure/lone-files.ts';
import { checkStructureLongFiles } from '#cli/checks/general/structure/long-files.ts';
import { checkDockerignore } from '#cli/checks/infrastructure/docker/dockerignore.ts';
import { checkFilesWithoutTarget } from '#cli/checks/infrastructure/xcode/project.ts';
import { checkPythonFunctionSize } from '#cli/checks/language/python/function-size.ts';
import { checkGspotGeneratedFiles } from '#cli/checks/general/gspot/generated-files.ts';
import { checkGspotUnmatchedPaths } from '#cli/checks/general/gspot/unmatched-paths.ts';
import { checkStructureBareBlocks } from '#cli/checks/general/structure/bare-blocks.ts';
import { checkDockerTrivyImage } from '#cli/checks/infrastructure/docker/trivy-image.ts';
import { checkBashUnreadArguments } from '#cli/checks/language/bash/unread-arguments.ts';
import { checkBashUnusedFunctions } from '#cli/checks/language/bash/unused-functions.ts';
import { checkStructureImportRules } from '#cli/checks/general/structure/import-rules.ts';
import { checkDependenciesLockfiles } from '#cli/checks/general/dependencies/lockfiles.ts';
import { checkDocsMissingPaths, checkDocsRequiredFiles } from '#cli/checks/general/docs.ts';
import { checkGithubActionsActionlint } from '#cli/checks/infrastructure/github-actions.ts';
import { checkForeignKeyIndexes } from '#cli/checks/database/postgres/foreign-key-indexes.ts';
import { checkFileFolderClashes } from '#cli/checks/general/structure/file-folder-clashes.ts';
import { checkPassThroughFolders } from '#cli/checks/general/structure/pass-through-folders.ts';
import { checkStructureSharedPrefixes } from '#cli/checks/general/structure/shared-prefixes.ts';
import { checkPackageManagerPin } from '#cli/checks/general/dependencies/package-manager-pin.ts';
import { checkDependenciesStaleLockfile } from '#cli/checks/general/dependencies/stale-lockfile.ts';
import { checkConflictingConfigFiles } from '#cli/checks/general/gspot/conflicting-config-files.ts';
import { checkStructureTrivialFunctions } from '#cli/checks/general/structure/trivial-functions.ts';
import { checkSecretsEnvExamples, checkSecretsGitleaksPushed } from '#cli/checks/general/secrets.ts';
import { checkCloudflareHeaders, checkCloudflareRedirects } from '#cli/checks/platform/cloudflare.ts';
import { checkStructureEnvironmentReaders } from '#cli/checks/general/structure/environment-readers.ts';
import { checkRepositoryLargeFiles, checkRepositoryLocalFiles } from '#cli/checks/general/repository.ts';
import { checkPythonPlaceholderDocstrings } from '#cli/checks/language/python/placeholder-docstrings.ts';
import { checkXcodeEntitlements, checkAppTransportSecurity } from '#cli/checks/infrastructure/xcode/settings.ts';
import { checkPostgresMigrationOrder, checkPostgresEditedMigrations } from '#cli/checks/database/postgres/history.ts';

import {
    checkPostgresGrants,
    checkRowLevelSecurity,
    checkDefinerSearchPath,
} from '#cli/checks/database/postgres/access.ts';
import {
    checkXcodeAssets,
    checkXcodeXcstrings,
    checkXcodeUnusedAssets,
} from '#cli/checks/infrastructure/xcode/resources.ts';
import {
    checkSwiftBuild,
    checkSwiftPeriphery,
    listSwiftlintConfigFiles,
    checkSwiftSwiftlintAnalyze,
} from '#cli/checks/language/swift/build.ts';
import {
    checkServiceRoleKey,
    checkSupabaseDenoLint,
    checkSupabaseDenoCheck,
    checkSupabaseStoragePolicies,
} from '#cli/checks/platform/supabase.ts';
import {
    checkSiteSize,
    checkSiteLychee,
    checkSiteSitemap,
    checkSitePurgecss,
    checkSiteHtmlValidate,
} from '#cli/checks/framework/site/pages.ts';

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
    'gspot/generated-files': { check: checkGspotGeneratedFiles },
    'gspot/conflicting-config-files': { check: checkConflictingConfigFiles },
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
    'structure/bare-blocks': { check: checkStructureBareBlocks },
    'structure/lone-files': { check: checkStructureLoneFiles },
    'structure/pass-through-folders': { check: checkPassThroughFolders },
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
    'swift/swiftlint': { listConfigFiles: listSwiftlintConfigFiles },
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
