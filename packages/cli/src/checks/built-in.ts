import { vale } from '#cli/checks/general/prose.ts';
import { expoDoctor } from '#cli/checks/framework/expo.ts';
import { jscpd } from '#cli/checks/general/duplication.ts';
import { sqlFunctions } from '#cli/checks/language/sql.ts';
import { runBuiltInCheck } from '#cli/execution/built-in.ts';
import { svelteCheck } from '#cli/checks/framework/svelte.ts';
import { deptry } from '#cli/checks/language/python/deptry.ts';
import { settings } from '#cli/checks/general/gspot/settings.ts';
import { bashSafety } from '#cli/checks/language/bash/safety.ts';
import { commitlintPushed } from '#cli/checks/general/commits.ts';
import { allowedLicenses } from '#cli/checks/general/licenses.ts';
import { codeql, semgrep } from '#cli/checks/general/security.ts';
import { drizzleRelations } from '#cli/checks/library/drizzle.ts';
import { runCheckCommand } from '#cli/execution/command/check.ts';
import { ansibleLint } from '#cli/checks/infrastructure/ansible.ts';
import { shellcheck } from '#cli/checks/language/bash/shellcheck.ts';
import { bashWrappers } from '#cli/checks/language/bash/wrappers.ts';
import { pydoclint } from '#cli/checks/language/python/pydoclint.ts';
import { versionPairs } from '#cli/checks/framework/version-pairs.ts';
import { envReads } from '#cli/checks/general/structure/env-reads.ts';
import { nginxConfigTest } from '#cli/checks/infrastructure/nginx.ts';
import { fileLines } from '#cli/checks/general/structure/file-lines.ts';
import { loneFiles } from '#cli/checks/general/structure/lone-files.ts';
import { bashSshBlocks } from '#cli/checks/language/bash/ssh-blocks.ts';
import { suppressions } from '#cli/checks/general/gspot/suppressions.ts';
import { actionlint } from '#cli/checks/infrastructure/github-actions.ts';
import { translationsMessages } from '#cli/checks/library/translations.ts';
import { staleGeneratedFiles } from '#cli/checks/stale-generated-files.ts';
import { unusedEntries } from '#cli/checks/general/gspot/unused-entries.ts';
import { bashDocComments } from '#cli/checks/language/bash/doc-comments.ts';
import { bashSourceOrder } from '#cli/checks/language/bash/source-order.ts';
import { importLinter } from '#cli/checks/language/python/import-linter.ts';
import { tsc, javascriptTsc } from '#cli/checks/language/typescript/tsc.ts';
import { largeFiles, trackedFiles } from '#cli/checks/general/repository.ts';
import { htmlScripts, htmlTemplateText } from '#cli/checks/language/html.ts';
import { generatedFiles } from '#cli/checks/general/gspot/generated-files.ts';
import { bashFunctionSize } from '#cli/checks/language/bash/function-size.ts';
import { bashScriptLayout } from '#cli/checks/language/bash/script-layout.ts';
import { packageJson } from '#cli/checks/general/dependencies/package-json.ts';
import { bashIncludeGuards } from '#cli/checks/language/bash/include-guards.ts';
import { bashInlineScripts } from '#cli/checks/language/bash/inline-scripts.ts';
import { bashPrivatePrefix } from '#cli/checks/language/bash/private-prefix.ts';
import { pythonPipInstalls } from '#cli/checks/language/python/pip-installs.ts';
import { typescriptTsconfig } from '#cli/checks/language/typescript/tsconfig.ts';
import { sharedPrefixes } from '#cli/checks/general/structure/shared-prefixes.ts';
import { siteBuild, buildReproducible } from '#cli/checks/framework/site/build.ts';
import { lockfileHosts } from '#cli/checks/general/dependencies/lockfile-hosts.ts';
import { staleLockfile } from '#cli/checks/general/dependencies/stale-lockfile.ts';
import { bunReleaseAge } from '#cli/checks/general/dependencies/bun-release-age.ts';
import { bashUnreadArguments } from '#cli/checks/language/bash/unread-arguments.ts';
import { bashUnusedFunctions } from '#cli/checks/language/bash/unused-functions.ts';
import { trivialFunctions } from '#cli/checks/general/structure/trivial-functions.ts';
import { bashVariableDefaults } from '#cli/checks/language/bash/variable-defaults.ts';
import { recording, references } from '#cli/checks/library/swift-snapshot-testing.ts';
import { type BuiltInCheck, type BuiltInChecks } from '#cli/types/execution/check.ts';
import { readmeShape, missingPaths, requiredFiles } from '#cli/checks/general/docs.ts';
import { trufflehog, envExamples, gitleaksPushed } from '#cli/checks/general/secrets.ts';
import { fileFolderClashes } from '#cli/checks/general/structure/file-folder-clashes.ts';
import { markdownFences, markdownlintArguments } from '#cli/checks/language/markdown.ts';
import { postgresForeignKeyIndexes } from '#cli/checks/database/postgres/foreign-keys.ts';
import { svgo, webManifest, unusedAssets } from '#cli/checks/framework/site/source-files.ts';
import { trivyImage, dockerignore, dockerCompose } from '#cli/checks/infrastructure/docker.ts';
import { settingsFormat, fixSettingsFormat } from '#cli/checks/general/gspot/settings-format.ts';
import { namingPaths, namingSettings, namingIdentifiers } from '#cli/checks/general/naming/checks.ts';
import { NEXT_VERSION_PAIRS, REACT_VERSION_PAIRS } from '#cli/config/checks/framework/version-pairs.ts';
import { nextjsTsc, nextConfig, nextjsBuild, nextjsRouteSegments } from '#cli/checks/framework/nextjs.ts';
import { xcstrings, xcodeAssets, xcodeUnusedAssets } from '#cli/checks/infrastructure/xcode/resources.ts';
import { postgresMigrationOrder, postgresEditedMigrations } from '#cli/checks/database/postgres/history.ts';
import { swiftTestsSleep, swiftTestsCoverage, swiftTestsSkipReasons } from '#cli/checks/testing/swift-tests.ts';
import { sitemap, purgecss, siteSize, linkinator, htmlValidate } from '#cli/checks/framework/site/built-pages.ts';
import { xcodeSymlinks, xcodeTestPlans, xcodeFilesWithoutTarget } from '#cli/checks/infrastructure/xcode/project.ts';
import { xcconfig, xcodeEntitlements, xcodeAppTransportSecurity } from '#cli/checks/infrastructure/xcode/settings.ts';

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
    cloudflareHeaders,
    cloudflareWrangler,
    cloudflareRedirects,
    cloudflareSecurityHeaders,
} from '#cli/checks/platform/cloudflare.ts';
import {
    pythonExportOrder,
    pythonPrivatePrefix,
    pythonPackageExports,
    pythonExportsAtBottom,
} from '#cli/checks/language/python/exports.ts';
import {
    pythonSingletons,
    pythonFunctionSize,
    pythonModuleGetattr,
    pythonPlaceholderDocstrings,
} from '#cli/checks/language/python/modules.ts';
import {
    supabaseDenoLint,
    supabaseDenoCheck,
    supabaseProjectFile,
    supabaseMigrationNames,
    supabaseServiceRoleKey,
    supabaseStoragePolicies,
} from '#cli/checks/platform/supabase.ts';

/** Native input calculations, keyed by their check IDs. */
export const CHECK_FUNCTIONS = {
    'gspot/settings': settings,
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
    'docs/readme-shape': readmeShape,
    'markdown/fences': markdownFences,
    'duplication/jscpd': jscpd,
    'secrets/env-examples': envExamples,
    'repository/tracked-files': trackedFiles,
    'security/codeql': codeql,
    'dependencies/package-json': packageJson,
    'dependencies/stale-lockfile': staleLockfile,
    'licenses/allowed': allowedLicenses,
    'dependencies/bun-release-age': bunReleaseAge,
    'dependencies/lockfile-hosts': lockfileHosts,
    'drizzle/relations': drizzleRelations,
    'drizzle/stale-migrations': staleGeneratedFiles,
    'nextjs/route-segments': nextjsRouteSegments,
    'nextjs/next-config': nextConfig,
    'nextjs/build': nextjsBuild,
    'nextjs/version-pairs': (input) => versionPairs(input, NEXT_VERSION_PAIRS),
    'react/version-pairs': (input) => versionPairs(input, REACT_VERSION_PAIRS),
    'cloudflare/headers': cloudflareHeaders,
    'cloudflare/redirects': cloudflareRedirects,
    'cloudflare/wrangler': cloudflareWrangler,
    'cloudflare/stale-types': staleGeneratedFiles,
    'site/build': siteBuild,
    'site/build-reproducible': buildReproducible,
    'site/html-validate': htmlValidate,
    'site/purgecss': purgecss,
    'site/linkinator': (input) => linkinator(input, false),
    'site/linkinator-external': (input) => linkinator(input, true),
    'site/size': siteSize,
    'site/sitemap': sitemap,
    'site/unused-assets': unusedAssets,
    'site/svgo': svgo,
    'site/webmanifest': webManifest,
    'cloudflare/security-headers': cloudflareSecurityHeaders,
    'html/scripts': htmlScripts,
    'html/template-text': htmlTemplateText,
    'python/function-size': pythonFunctionSize,
    'python/placeholder-docstrings': pythonPlaceholderDocstrings,
    'python/private-prefix': pythonPrivatePrefix,
    'python/exports-at-bottom': pythonExportsAtBottom,
    'python/module-getattr': pythonModuleGetattr,
    'python/package-exports': pythonPackageExports,
    'python/export-order': pythonExportOrder,
    'python/singletons': pythonSingletons,
    'python/import-linter': importLinter,
    'python/pip-installs': pythonPipInstalls,
    'swift-tests/skip-reasons': swiftTestsSkipReasons,
    'swift-tests/sleep': swiftTestsSleep,
    'swift-snapshot-testing/recording': recording,
    'swift-snapshot-testing/references': references,
    'swift-tests/coverage': swiftTestsCoverage,
    'xcode/xcconfig': xcconfig,
    'xcode/entitlements': xcodeEntitlements,
    'xcode/app-transport-security': xcodeAppTransportSecurity,
    'xcode/xcstrings': xcstrings,
    'xcode/assets': xcodeAssets,
    'xcode/unused-assets': xcodeUnusedAssets,
    'xcode/test-plans': xcodeTestPlans,
    'xcode/files-without-target': xcodeFilesWithoutTarget,
    'xcode/symlinks': xcodeSymlinks,
    'swift/build': swiftBuild,
    'swift/swiftlint-analyze': swiftlintAnalyze,
    'swift/periphery': swiftPeriphery,
    'openapi/stale-document': staleGeneratedFiles,
    'supabase/project-file': supabaseProjectFile,
    'supabase/storage-policies': supabaseStoragePolicies,
    'supabase/migration-names': supabaseMigrationNames,
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
    'sql/functions': sqlFunctions,
    'docker/dockerignore': dockerignore,
    'docker/trivy-image': trivyImage,
    'structure/lone-files': loneFiles,
    'structure/shared-prefixes': sharedPrefixes,
    'structure/file-folder-clashes': fileFolderClashes,
    'bash/function-size': bashFunctionSize,
    'bash/doc-comments': bashDocComments,
    'bash/unused-functions': bashUnusedFunctions,
    'bash/unread-arguments': bashUnreadArguments,
    'bash/private-prefix': bashPrivatePrefix,
    'bash/script-layout': bashScriptLayout,
    'bash/wrappers': bashWrappers,
    'bash/inline-scripts': bashInlineScripts,
    'bash/ssh-blocks': bashSshBlocks,
    'bash/variable-defaults': bashVariableDefaults,
    'bash/include-guards': bashIncludeGuards,
    'bash/safety': bashSafety,
    'bash/source-order': bashSourceOrder,
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
    'gspot/settings-format': { run: settingsFormat, fix: fixSettingsFormat },
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
