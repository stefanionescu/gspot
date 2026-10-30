import { checkTsc } from '#cli/checks/tsc/check.ts';
import type { CheckCode } from '#cli/types/runs/check.ts';
import { checkProseVale } from '#cli/checks/general/prose.ts';
import { checkExpoDoctor } from '#cli/checks/framework/expo.ts';
import { checkNextjsTsc } from '#cli/checks/framework/nextjs.ts';
import { checkSvelteCheck } from '#cli/checks/framework/svelte.ts';
import { checkSiteBuild } from '#cli/checks/framework/site/build.ts';
import { checkBashSafety } from '#cli/checks/language/bash/safety.ts';
import { checkHtmlInlineScripts } from '#cli/checks/language/html.ts';
import { checkSwiftBuild } from '#cli/checks/language/swift/build.ts';
import { checkLicensesAllowed } from '#cli/checks/general/licenses.ts';
import { checkNamingPaths } from '#cli/checks/general/naming/paths.ts';
import { checkSecuritySemgrep } from '#cli/checks/general/security.ts';
import { checkNginxSyntax } from '#cli/checks/infrastructure/nginx.ts';
import { checkMarkdownFences } from '#cli/checks/language/markdown.ts';
import { checkJavascriptTsc } from '#cli/checks/language/javascript.ts';
import { checkTranslationsMessages } from '#cli/checks/translations.ts';
import { checkAnsibleLint } from '#cli/checks/infrastructure/ansible.ts';
import { MARKDOWNLINT_PATH_PREFIX } from '#cli/config/checks/registry.ts';
import { checkDuplicationJscpd } from '#cli/checks/general/duplication.ts';
import { checkSwiftCoverage } from '#cli/checks/language/swift/coverage.ts';
import { checkTypescriptTsconfig } from '#cli/checks/language/typescript.ts';
import { checkPostgresGrants } from '#cli/checks/database/postgres/grants.ts';
import { checkBashShellcheck } from '#cli/checks/language/bash/shellcheck.ts';
import { checkSwiftPeriphery } from '#cli/checks/language/swift/periphery.ts';
import { checkReactDomReactVersions } from '#cli/checks/framework/react-dom.ts';
import { checkBashDocComments } from '#cli/checks/language/bash/doc-comments.ts';
import { checkNamingIdentifiers } from '#cli/checks/general/naming/identifiers.ts';
import { checkBashFunctionSize } from '#cli/checks/language/bash/function-size.ts';
import { checkBashScriptLayout } from '#cli/checks/language/bash/script-layout.ts';
import { checkSwiftDocComments } from '#cli/checks/language/swift/doc-comments.ts';
import { checkSwiftSkipReasons } from '#cli/checks/language/swift/skip-reasons.ts';
import { checkSiteUnusedAssets } from '#cli/checks/framework/site/unused-assets.ts';
import { checkBashInlineScripts } from '#cli/checks/language/bash/inline-scripts.ts';
import { checkNamingAllowedNames } from '#cli/checks/general/naming/allowed-names.ts';
import { checkStructureLoneFiles } from '#cli/checks/general/structure/lone-files.ts';
import { checkStructureLongFiles } from '#cli/checks/general/structure/long-files.ts';
import { checkStructureBareBlocks } from '#cli/checks/general/structure/bare-blocks.ts';
import { checkBashUnreadArguments } from '#cli/checks/language/bash/unread-arguments.ts';
import { checkBashUnusedFunctions } from '#cli/checks/language/bash/unused-functions.ts';
import { checkStructureImportRules } from '#cli/checks/general/structure/import-rules.ts';
import { checkDocsMissingPaths, checkDocsRequiredFiles } from '#cli/checks/general/docs.ts';
import { checkGithubActionsActionlint } from '#cli/checks/infrastructure/github-actions.ts';
import { checkPostgresMigrationOrder } from '#cli/checks/database/postgres/migration-order.ts';
import { checkStructureSharedPrefixes } from '#cli/checks/general/structure/shared-prefixes.ts';
import { checkPostgresEditedMigrations } from '#cli/checks/database/postgres/edited-migrations.ts';
import { checkPostgresRowLevelSecurity } from '#cli/checks/database/postgres/row-level-security.ts';
import { checkStructureTrivialFunctions } from '#cli/checks/general/structure/trivial-functions.ts';
import { checkSecretsEnvExamples, checkSecretsGitleaksPushed } from '#cli/checks/general/secrets.ts';
import { checkPostgresDefinerSearchPath } from '#cli/checks/database/postgres/definer-search-path.ts';
import { checkPostgresForeignKeyIndexes } from '#cli/checks/database/postgres/foreign-key-indexes.ts';
import { checkCommitsReferences, checkCommitsCommitlintPushed } from '#cli/checks/general/commits.ts';
import { checkCloudflareHeaders, checkCloudflareRedirects } from '#cli/checks/platform/cloudflare.ts';
import { checkStructureFileFolderClashes } from '#cli/checks/general/structure/file-folder-clashes.ts';
import { checkStructureEnvironmentReaders } from '#cli/checks/general/structure/environment-readers.ts';
import { checkStructurePassThroughFolders } from '#cli/checks/general/structure/pass-through-folders.ts';
import { listSwiftlintConfigFiles, checkSwiftSwiftlintAnalyze } from '#cli/checks/language/swift/swiftlint.ts';
import { checkDockerignore, checkDockerCompose, checkDockerTrivyImage } from '#cli/checks/infrastructure/docker.ts';

import {
    checkRepositoryEncoding,
    checkRepositoryLargeFiles,
    checkRepositoryLocalFiles,
} from '#cli/checks/general/repository.ts';
import {
    checkDependenciesLockfiles,
    checkDependenciesStaleLockfile,
    checkDependenciesPackageManagerPin,
} from '#cli/checks/general/dependencies.ts';
import {
    checkSiteSize,
    checkSiteLychee,
    checkSiteSitemap,
    checkSitePurgecss,
    checkSiteHtmlValidate,
} from '#cli/checks/framework/site/pages.ts';
import {
    checkGspotSuppressions,
    checkGspotGeneratedFiles,
    checkGspotUnmatchedPaths,
    checkGspotConflictingConfigFiles,
} from '#cli/checks/general/gspot.ts';
import {
    checkSupabaseDenoLint,
    checkSupabaseDenoCheck,
    checkSupabaseServiceRoleKey,
    checkSupabaseStoragePolicies,
} from '#cli/checks/platform/supabase.ts';
import {
    checkPythonDeptry,
    checkPythonVulture,
    checkPythonPydoclint,
    checkPythonPipInstalls,
    checkPythonFunctionSize,
    checkPythonPlaceholderDocstrings,
} from '#cli/checks/language/python.ts';
import {
    checkXcodeAssets,
    checkXcodeXcstrings,
    checkXcodeEntitlements,
    checkXcodeUnusedAssets,
    checkXcodeFilesWithoutTarget,
    checkXcodeAppTransportSecurity,
} from '#cli/checks/infrastructure/xcode.ts';

export const CHECK_CODE: Record<string, CheckCode> = {
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
    'commits/references': { check: checkCommitsReferences },
    'dependencies/lockfiles': { check: checkDependenciesLockfiles },
    'dependencies/package-manager-pin': { check: checkDependenciesPackageManagerPin },
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
    'gspot/conflicting-config-files': { check: checkGspotConflictingConfigFiles },
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
    'postgres/definer-search-path': { check: checkPostgresDefinerSearchPath },
    'postgres/edited-migrations': { check: checkPostgresEditedMigrations },
    'postgres/foreign-key-indexes': { check: checkPostgresForeignKeyIndexes },
    'postgres/grants': { check: checkPostgresGrants },
    'postgres/migration-order': { check: checkPostgresMigrationOrder },
    'postgres/row-level-security': { check: checkPostgresRowLevelSecurity },
    'prose/vale': { check: checkProseVale },
    'python/deptry': { run: checkPythonDeptry },
    'python/function-size': { check: checkPythonFunctionSize },
    'python/pip-installs': { check: checkPythonPipInstalls },
    'python/placeholder-docstrings': { check: checkPythonPlaceholderDocstrings },
    'python/pydoclint': { run: checkPythonPydoclint },
    'python/vulture': { check: checkPythonVulture },
    'repository/encoding': { check: checkRepositoryEncoding },
    'react-dom/react-versions': { check: checkReactDomReactVersions },
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
    'structure/file-folder-clashes': { check: checkStructureFileFolderClashes },
    'structure/import-rules': { check: checkStructureImportRules },
    'structure/bare-blocks': { check: checkStructureBareBlocks },
    'structure/lone-files': { check: checkStructureLoneFiles },
    'structure/pass-through-folders': { check: checkStructurePassThroughFolders },
    'structure/long-files': { check: checkStructureLongFiles },
    'structure/shared-prefixes': { check: checkStructureSharedPrefixes },
    'structure/trivial-functions': { check: checkStructureTrivialFunctions },
    'supabase/deno-check': { check: checkSupabaseDenoCheck },
    'supabase/deno-lint': { check: checkSupabaseDenoLint },
    'supabase/service-role-key': { check: checkSupabaseServiceRoleKey },
    'supabase/storage-policies': { check: checkSupabaseStoragePolicies },
    'svelte/svelte-check': { check: checkSvelteCheck },
    'swift/build': { check: checkSwiftBuild },
    'swift/coverage': { check: checkSwiftCoverage },
    'swift/doc-comments': { check: checkSwiftDocComments },
    'swift/periphery': { check: checkSwiftPeriphery },
    'swift/skip-reasons': { check: checkSwiftSkipReasons },
    'swift/swiftlint': { listConfigFiles: listSwiftlintConfigFiles },
    'swift/swiftlint-analyze': { check: checkSwiftSwiftlintAnalyze },
    'translations/messages': { check: checkTranslationsMessages },
    'typescript/tsc': { run: checkTsc },
    'typescript/tsconfig': { check: checkTypescriptTsconfig },
    'vue/vue-tsc': { run: checkTsc },
    'xcode/app-transport-security': { check: checkXcodeAppTransportSecurity },
    'xcode/assets': { check: checkXcodeAssets },
    'xcode/entitlements': { check: checkXcodeEntitlements },
    'xcode/files-without-target': { check: checkXcodeFilesWithoutTarget },
    'xcode/unused-assets': { check: checkXcodeUnusedAssets },
    'xcode/xcstrings': { check: checkXcodeXcstrings },
};
