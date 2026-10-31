import { checkVale } from '#cli/checks/general/prose.ts';
import type { CheckCode } from '#cli/types/runs/check.ts';
import { checkAllowed } from '#cli/checks/general/licenses.ts';
import { checkSemgrep } from '#cli/checks/general/security.ts';
import { checkFences } from '#cli/checks/language/markdown.ts';
import { checkExpoDoctor } from '#cli/checks/framework/expo.ts';
import { checkJscpd } from '#cli/checks/general/duplication.ts';
import { checkNextjsTsc } from '#cli/checks/framework/nextjs.ts';
import { checkPaths } from '#cli/checks/general/naming/paths.ts';
import { checkSyntax } from '#cli/checks/infrastructure/nginx.ts';
import { checkSafety } from '#cli/checks/language/bash/safety.ts';
import { checkSvelteCheck } from '#cli/checks/framework/svelte.ts';
import { checkTsconfig } from '#cli/checks/language/typescript.ts';
import { checkMessages } from '#cli/checks/library/translations.ts';
import { checkSiteBuild } from '#cli/checks/framework/site/build.ts';
import { checkGrants } from '#cli/checks/database/postgres/grants.ts';
import { checkHtmlInlineScripts } from '#cli/checks/language/html.ts';
import { checkSwiftBuild } from '#cli/checks/language/swift/build.ts';
import { checkCoverage } from '#cli/checks/language/swift/coverage.ts';
import { checkTsc } from '#cli/checks/cross-configuration/tsc/check.ts';
import { checkReactVersions } from '#cli/checks/framework/react-dom.ts';
import { checkJavascriptTsc } from '#cli/checks/language/javascript.ts';
import { MARKDOWNLINT_PATH_PREFIX } from '#cli/config/checks/checks.ts';
import { checkAnsibleLint } from '#cli/checks/infrastructure/ansible.ts';
import { checkPeriphery } from '#cli/checks/language/swift/periphery.ts';
import { checkShellcheck } from '#cli/checks/language/bash/shellcheck.ts';
import { checkIdentifiers } from '#cli/checks/general/naming/identifiers.ts';
import { checkLoneFiles } from '#cli/checks/general/structure/lone-files.ts';
import { checkLongFiles } from '#cli/checks/general/structure/long-files.ts';
import { checkSkipReasons } from '#cli/checks/language/swift/skip-reasons.ts';
import { checkBareBlocks } from '#cli/checks/general/structure/bare-blocks.ts';
import { checkActionlint } from '#cli/checks/infrastructure/github-actions.ts';
import { checkScriptLayout } from '#cli/checks/language/bash/script-layout.ts';
import { checkAllowedNames } from '#cli/checks/general/naming/allowed-names.ts';
import { checkImportRules } from '#cli/checks/general/structure/import-rules.ts';
import { checkBashDocComments } from '#cli/checks/language/bash/doc-comments.ts';
import { checkHeaders, checkRedirects } from '#cli/checks/platform/cloudflare.ts';
import { checkBashFunctionSize } from '#cli/checks/language/bash/function-size.ts';
import { checkSwiftDocComments } from '#cli/checks/language/swift/doc-comments.ts';
import { checkSiteUnusedAssets } from '#cli/checks/framework/site/unused-assets.ts';
import { checkMissingPaths, checkRequiredFiles } from '#cli/checks/general/docs.ts';
import { checkFunctionOrder } from '#cli/checks/general/structure/function-order.ts';
import { checkBashInlineScripts } from '#cli/checks/language/bash/inline-scripts.ts';
import { checkUnreadArguments } from '#cli/checks/language/bash/unread-arguments.ts';
import { checkUnusedFunctions } from '#cli/checks/language/bash/unused-functions.ts';
import { checkMigrationOrder } from '#cli/checks/database/postgres/migration-order.ts';
import { checkEnvExamples, checkGitleaksPushed } from '#cli/checks/general/secrets.ts';
import { checkSharedPrefixes } from '#cli/checks/general/structure/shared-prefixes.ts';
import { checkReferences, checkCommitlintPushed } from '#cli/checks/general/commits.ts';
import { checkEditedMigrations } from '#cli/checks/database/postgres/edited-migrations.ts';
import { checkTrivialFunctions } from '#cli/checks/general/structure/trivial-functions.ts';
import { checkRowLevelSecurity } from '#cli/checks/database/postgres/row-level-security.ts';
import { checkDefinerSearchPath } from '#cli/checks/database/postgres/definer-search-path.ts';
import { checkForeignKeyIndexes } from '#cli/checks/database/postgres/foreign-key-indexes.ts';
import { checkFileFolderClashes } from '#cli/checks/general/structure/file-folder-clashes.ts';
import { checkEnvironmentReaders } from '#cli/checks/general/structure/environment-readers.ts';
import { checkPassThroughFolders } from '#cli/checks/general/structure/pass-through-folders.ts';
import { checkEncoding, checkLargeFiles, checkLocalFiles } from '#cli/checks/general/repository.ts';
import { listSwiftlintConfigs, checkSwiftlintAnalyze } from '#cli/checks/language/swift/swiftlint.ts';
import { checkCompose, checkTrivyImage, checkDockerignore } from '#cli/checks/infrastructure/docker.ts';
import { checkLockfiles, checkStaleLockfile, checkPackageManagerPin } from '#cli/checks/general/dependencies.ts';

import {
    checkDenoLint,
    checkDenoCheck,
    checkServiceRoleKey,
    checkStoragePolicies,
} from '#cli/checks/platform/supabase.ts';
import {
    checkSize,
    checkLychee,
    checkSitemap,
    checkPurgecss,
    checkHtmlValidate,
} from '#cli/checks/framework/site/pages.ts';
import {
    checkSuppressions,
    checkGeneratedFiles,
    checkUnmatchedPaths,
    checkConflictingConfigs,
} from '#cli/checks/general/gspot.ts';
import {
    checkDeptry,
    checkVulture,
    checkPydoclint,
    checkPipInstalls,
    checkPythonFunctionSize,
    checkPlaceholderDocstrings,
} from '#cli/checks/language/python.ts';
import {
    checkAssets,
    checkXcstrings,
    checkEntitlements,
    checkXcodeUnusedAssets,
    checkFilesWithoutTarget,
    checkAppTransportSecurity,
} from '#cli/checks/infrastructure/xcode.ts';

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
    'site/size': { check: checkSize },
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
