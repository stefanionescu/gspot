import { vale } from '#cli/checks/general/prose.ts';
import { semgrep } from '#cli/checks/general/security.ts';
import { expoDoctor } from '#cli/checks/framework/expo.ts';
import { jscpd } from '#cli/checks/general/duplication.ts';
import { htmlScripts } from '#cli/checks/language/html.ts';
import { runBuiltInCheck } from '#cli/execution/built-in.ts';
import { svelteCheck } from '#cli/checks/framework/svelte.ts';
import { deptry } from '#cli/checks/language/python/deptry.ts';
import { siteBuild } from '#cli/checks/framework/site/build.ts';
import { bashSafety } from '#cli/checks/language/bash/safety.ts';
import { commitlintPushed } from '#cli/checks/general/commits.ts';
import { allowedLicenses } from '#cli/checks/general/licenses.ts';
import { runCheckCommand } from '#cli/execution/command/check.ts';
import { translationsMessages } from '#cli/checks/translations.ts';
import { ansibleLint } from '#cli/checks/infrastructure/ansible.ts';
import { shellcheck } from '#cli/checks/language/bash/shellcheck.ts';
import { bashWrappers } from '#cli/checks/language/bash/wrappers.ts';
import { pydoclint } from '#cli/checks/language/python/pydoclint.ts';
import { envReads } from '#cli/checks/general/structure/env-reads.ts';
import { nginxConfigTest } from '#cli/checks/infrastructure/nginx.ts';
import { nextjsTsc, nextConfig } from '#cli/checks/framework/nextjs.ts';
import { fileLines } from '#cli/checks/general/structure/file-lines.ts';
import { loneFiles } from '#cli/checks/general/structure/lone-files.ts';
import { suppressions } from '#cli/checks/general/gspot/suppressions.ts';
import { unusedAssets } from '#cli/checks/framework/site/source-files.ts';
import { missingPaths, requiredFiles } from '#cli/checks/general/docs.ts';
import { actionlint } from '#cli/checks/infrastructure/github-actions.ts';
import { staleGeneratedFiles } from '#cli/checks/stale-generated-files.ts';
import { unusedEntries } from '#cli/checks/general/gspot/unused-entries.ts';
import { bashDocComments } from '#cli/checks/language/bash/doc-comments.ts';
import { importLinter } from '#cli/checks/language/python/import-linter.ts';
import { tsc, javascriptTsc } from '#cli/checks/language/typescript/tsc.ts';
import { largeFiles, trackedFiles } from '#cli/checks/general/repository.ts';
import { generatedFiles } from '#cli/checks/general/gspot/generated-files.ts';
import { bashFunctionSize } from '#cli/checks/language/bash/function-size.ts';
import { bashScriptLayout } from '#cli/checks/language/bash/script-layout.ts';
import { packageJson } from '#cli/checks/general/dependencies/package-json.ts';
import { bashInlineScripts } from '#cli/checks/language/bash/inline-scripts.ts';
import { pythonPipInstalls } from '#cli/checks/language/python/pip-installs.ts';
import { typescriptTsconfig } from '#cli/checks/language/typescript/tsconfig.ts';
import { sharedPrefixes } from '#cli/checks/general/structure/shared-prefixes.ts';
import { lockfileHosts } from '#cli/checks/general/dependencies/lockfile-hosts.ts';
import { bashUnreadArguments } from '#cli/checks/language/bash/unread-arguments.ts';
import { bashUnusedFunctions } from '#cli/checks/language/bash/unused-functions.ts';
import { pythonPlaceholderDocstrings } from '#cli/checks/language/python/modules.ts';
import { trivialFunctions } from '#cli/checks/general/structure/trivial-functions.ts';
import { xcodeFilesWithoutTarget } from '#cli/checks/infrastructure/xcode/project.ts';
import { type BuiltInCheck, type BuiltInChecks } from '#cli/types/execution/check.ts';
import { trufflehog, envExamples, gitleaksPushed } from '#cli/checks/general/secrets.ts';
import { fileFolderClashes } from '#cli/checks/general/structure/file-folder-clashes.ts';
import { markdownFences, markdownlintArguments } from '#cli/checks/language/markdown.ts';
import { postgresForeignKeyIndexes } from '#cli/checks/database/postgres/foreign-keys.ts';
import { trivyImage, dockerignore, dockerCompose } from '#cli/checks/infrastructure/docker.ts';
import { swiftTestsCoverage, swiftTestsSkipReasons } from '#cli/checks/testing/swift-tests.ts';
import { namingPaths, namingSettings, namingIdentifiers } from '#cli/checks/general/naming/checks.ts';
import { xcstrings, xcodeAssets, xcodeUnusedAssets } from '#cli/checks/infrastructure/xcode/resources.ts';
import { postgresMigrationOrder, postgresEditedMigrations } from '#cli/checks/database/postgres/history.ts';
import { sitemap, purgecss, siteSize, linkinator, htmlValidate } from '#cli/checks/framework/site/built-pages.ts';
import { xcconfig, xcodeEntitlements, xcodeAppTransportSecurity } from '#cli/checks/infrastructure/xcode/settings.ts';
import { cloudflareHeaders, cloudflareRedirects, cloudflareSecurityHeaders } from '#cli/checks/platform/cloudflare.ts';

import {
    postgresGrants,
    postgresRowLevelSecurity,
    postgresDefinerSearchPath,
} from '#cli/checks/database/postgres/access.ts';
import {
    swiftBuild,
    swiftPeriphery,
    swiftlintAnalyze,
    swiftlintConfigurationFiles,
} from '#cli/checks/language/swift/build.ts';
import {
    supabaseDenoLint,
    supabaseDenoCheck,
    supabaseServiceRoleKey,
    supabaseStoragePolicies,
} from '#cli/checks/platform/supabase.ts';

/** Native input calculations, keyed by their check IDs. */
export const CHECK_FUNCTIONS = {
    'gspot/unused-entries': unusedEntries,
    'expo/doctor': expoDoctor,
    'svelte/svelte-check': svelteCheck,
    'translations/messages': translationsMessages,
    'ansible/ansible-lint': ansibleLint,
    'nginx/config-test': nginxConfigTest,
    'structure/trivial-functions': trivialFunctions,
    'structure/env-reads': envReads,
    'structure/file-lines': fileLines,
    'gspot/suppressions': suppressions,
    'repository/large-files': largeFiles,
    'typescript/tsconfig': typescriptTsconfig,
    'docs/missing-paths': missingPaths,
    'docs/required-files': requiredFiles,
    'markdown/fences': markdownFences,
    'duplication/jscpd': jscpd,
    'secrets/env-examples': envExamples,
    'repository/tracked-files': trackedFiles,
    'dependencies/package-json': packageJson,
    'licenses/allowed': allowedLicenses,
    'dependencies/lockfile-hosts': lockfileHosts,
    'drizzle/stale-migrations': staleGeneratedFiles,
    'nextjs/next-config': nextConfig,
    'cloudflare/headers': cloudflareHeaders,
    'cloudflare/redirects': cloudflareRedirects,
    'cloudflare/stale-types': staleGeneratedFiles,
    'site/build': siteBuild,
    'site/html-validate': htmlValidate,
    'site/purgecss': purgecss,
    'site/linkinator': linkinator,
    'site/size': siteSize,
    'site/sitemap': sitemap,
    'site/unused-assets': unusedAssets,
    'cloudflare/security-headers': cloudflareSecurityHeaders,
    'html/scripts': htmlScripts,
    'python/placeholder-docstrings': pythonPlaceholderDocstrings,
    'python/import-linter': importLinter,
    'python/pip-installs': pythonPipInstalls,
    'swift-tests/skip-reasons': swiftTestsSkipReasons,
    'swift-tests/coverage': swiftTestsCoverage,
    'xcode/xcconfig': xcconfig,
    'xcode/entitlements': xcodeEntitlements,
    'xcode/app-transport-security': xcodeAppTransportSecurity,
    'xcode/xcstrings': xcstrings,
    'xcode/assets': xcodeAssets,
    'xcode/unused-assets': xcodeUnusedAssets,
    'xcode/files-without-target': xcodeFilesWithoutTarget,
    'swift/build': swiftBuild,
    'swift/swiftlint-analyze': swiftlintAnalyze,
    'swift/periphery': swiftPeriphery,
    'openapi/stale-document': staleGeneratedFiles,
    'supabase/storage-policies': supabaseStoragePolicies,
    'supabase/deno-lint': supabaseDenoLint,
    'supabase/deno-check': supabaseDenoCheck,
    'supabase/service-role-key': supabaseServiceRoleKey,
    'supabase/stale-types': staleGeneratedFiles,
    'postgres/row-level-security': postgresRowLevelSecurity,
    'postgres/grants': postgresGrants,
    'postgres/definer-search-path': postgresDefinerSearchPath,
    'postgres/foreign-key-indexes': postgresForeignKeyIndexes,
    'postgres/migration-order': postgresMigrationOrder,
    'postgres/edited-migrations': postgresEditedMigrations,
    'docker/dockerignore': dockerignore,
    'docker/trivy-image': trivyImage,
    'structure/lone-files': loneFiles,
    'structure/shared-prefixes': sharedPrefixes,
    'structure/file-folder-clashes': fileFolderClashes,
    'bash/function-size': bashFunctionSize,
    'bash/doc-comments': bashDocComments,
    'bash/unused-functions': bashUnusedFunctions,
    'bash/unread-arguments': bashUnreadArguments,
    'bash/script-layout': bashScriptLayout,
    'bash/wrappers': bashWrappers,
    'bash/inline-scripts': bashInlineScripts,
    'bash/safety': bashSafety,
    'prose/vale': vale,
    'naming/identifiers': namingIdentifiers,
    'naming/paths': namingPaths,
    'naming/settings': namingSettings,
} satisfies Record<string, BuiltInCheck>;

/** Every execution callback, keyed by its check ID. */
export const BUILT_IN_CHECKS = {
    ...Object.fromEntries(
        Object.entries(CHECK_FUNCTIONS).map(([name, input]): [string, BuiltInChecks[string]] => [
            name,
            { run: runBuiltInCheck(input) },
        ]),
    ),
    'markdown/markdownlint': { run: runCheckCommand, arguments: markdownlintArguments },
    'swift/swiftlint': { run: runCheckCommand, configurationFiles: swiftlintConfigurationFiles },
    'gspot/generated-files': { run: generatedFiles },
    'security/semgrep': { run: semgrep },
    'nextjs/tsc': { run: nextjsTsc },
    'docker/compose': { run: dockerCompose },
    'secrets/trufflehog': { run: trufflehog },
    'secrets/gitleaks-pushed': { run: gitleaksPushed },
    'commits/commitlint-pushed': { run: commitlintPushed },
    'vue/vue-tsc': { run: tsc },
    'typescript/tsc': { run: tsc },
    'javascript/tsc': { run: javascriptTsc },
    'bash/shellcheck': { run: shellcheck },
    'python/pydoclint': { run: pydoclint },
    'python/deptry': { run: deptry },
    'github-actions/actionlint': { run: actionlint },
} satisfies BuiltInChecks;
