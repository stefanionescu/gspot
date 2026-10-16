import { vale } from '#cli/checks/general/prose.ts';
import { semgrep } from '#cli/checks/general/security.ts';
import { expoDoctor } from '#cli/checks/framework/expo.ts';
import { jscpd } from '#cli/checks/general/duplication.ts';
import { htmlScripts } from '#cli/checks/language/html.ts';
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
import { pydoclint } from '#cli/checks/language/python/pydoclint.ts';
import { swiftTestsCoverage } from '#cli/checks/testing/coverage.ts';
import { nginxConfigTest } from '#cli/checks/infrastructure/nginx.ts';
import { bashWrappers } from '#cli/checks/language/bash/forwarders.ts';
import { nextjsTsc, nextConfig } from '#cli/checks/framework/nextjs.ts';
import { fileLines } from '#cli/checks/general/structure/file-lines.ts';
import { loneFiles } from '#cli/checks/general/structure/lone-files.ts';
import { suppressions } from '#cli/checks/general/gspot/suppressions.ts';
import { missingPaths, requiredFiles } from '#cli/checks/general/docs.ts';
import { dockerignore } from '#cli/checks/infrastructure/dockerignore.ts';
import { actionlint } from '#cli/checks/infrastructure/github-actions.ts';
import { type CheckImplementations } from '#cli/types/execution/check.ts';
import { unusedAssets } from '#cli/checks/framework/site/unused-assets.ts';
import { swiftTestsSkipReasons } from '#cli/checks/testing/swift-tests.ts';
import { unusedEntries } from '#cli/checks/general/gspot/unused-entries.ts';
import { bashDocComments } from '#cli/checks/language/bash/doc-comments.ts';
import { importLinter } from '#cli/checks/language/python/import-linter.ts';
import { tsc, javascriptTsc } from '#cli/checks/language/typescript/tsc.ts';
import { largeFiles, trackedFiles } from '#cli/checks/general/repository.ts';
import { lockfileHosts } from '#cli/checks/general/dependencies/lockfiles.ts';
import { generatedFiles } from '#cli/checks/general/gspot/generated-files.ts';
import { bashFunctionSize } from '#cli/checks/language/bash/function-size.ts';
import { bashScriptLayout } from '#cli/checks/language/bash/script-layout.ts';
import { packageJson } from '#cli/checks/general/dependencies/package-json.ts';
import { envReads } from '#cli/checks/general/structure/environment-readers.ts';
import { bashInlineScripts } from '#cli/checks/language/bash/inline-scripts.ts';
import { pythonPipInstalls } from '#cli/checks/language/python/pip-installs.ts';
import { trivyImage, dockerCompose } from '#cli/checks/infrastructure/docker.ts';
import { typescriptTsconfig } from '#cli/checks/language/typescript/tsconfig.ts';
import { sharedPrefixes } from '#cli/checks/general/structure/shared-prefixes.ts';
import { bashUnreadArguments } from '#cli/checks/language/bash/unread-arguments.ts';
import { bashUnusedFunctions } from '#cli/checks/language/bash/unused-functions.ts';
import { trivialFunctions } from '#cli/checks/general/structure/trivial-functions.ts';
import { xcodeFilesWithoutTarget } from '#cli/checks/infrastructure/xcode/project.ts';
import { trufflehog, envExamples, gitleaksPushed } from '#cli/checks/general/secrets.ts';
import { fileFolderClashes } from '#cli/checks/general/structure/file-folder-clashes.ts';
import { markdownFences, markdownlintArguments } from '#cli/checks/language/markdown.ts';
import { postgresForeignKeyIndexes } from '#cli/checks/database/postgres/foreign-keys.ts';
import { pythonPlaceholderDocstrings } from '#cli/checks/language/python/placeholder-docstrings.ts';
import { namingPaths, namingSettings, namingIdentifiers } from '#cli/checks/general/naming/checks.ts';
import { xcstrings, xcodeAssets, xcodeUnusedAssets } from '#cli/checks/infrastructure/xcode/resources.ts';
import { postgresMigrationOrder, postgresEditedMigrations } from '#cli/checks/database/postgres/history.ts';
import { sitemap, purgecss, siteSize, htmlValidate, checkSiteLinkinator } from '#cli/checks/framework/site/pages.ts';
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

/** Every execution callback, keyed by its check ID. */
export const CHECK_IMPLEMENTATIONS = {
    'gspot/unused-entries': { check: unusedEntries },
    'expo/doctor': { check: expoDoctor },
    'svelte/svelte-check': { check: svelteCheck },
    'translations/messages': { check: translationsMessages },
    'ansible/ansible-lint': { check: ansibleLint },
    'nginx/config-test': { check: nginxConfigTest },
    'structure/trivial-functions': { check: trivialFunctions },
    'structure/env-reads': { check: envReads },
    'structure/file-lines': { check: fileLines },
    'gspot/suppressions': { check: suppressions },
    'repository/large-files': { check: largeFiles },
    'typescript/tsconfig': { check: typescriptTsconfig },
    'docs/missing-paths': { check: missingPaths },
    'docs/required-files': { check: requiredFiles },
    'markdown/fences': { check: markdownFences },
    'duplication/jscpd': { check: jscpd },
    'secrets/env-examples': { check: envExamples },
    'repository/tracked-files': { check: trackedFiles },
    'dependencies/package-json': { check: packageJson },
    'licenses/allowed': { check: allowedLicenses },
    'dependencies/lockfile-hosts': { check: lockfileHosts },
    'nextjs/next-config': { check: nextConfig },
    'cloudflare/headers': { check: cloudflareHeaders },
    'cloudflare/redirects': { check: cloudflareRedirects },
    'site/build': { check: siteBuild },
    'site/html-validate': { check: htmlValidate },
    'site/purgecss': { check: purgecss },
    'site/linkinator': { check: checkSiteLinkinator },
    'site/size': { check: siteSize },
    'site/sitemap': { check: sitemap },
    'site/unused-assets': { check: unusedAssets },
    'cloudflare/security-headers': { check: cloudflareSecurityHeaders },
    'html/scripts': { check: htmlScripts },
    'python/placeholder-docstrings': { check: pythonPlaceholderDocstrings },
    'python/import-linter': { check: importLinter },
    'python/pip-installs': { check: pythonPipInstalls },
    'swift-tests/skip-reasons': { check: swiftTestsSkipReasons },
    'swift-tests/coverage': { check: swiftTestsCoverage },
    'xcode/xcconfig': { check: xcconfig },
    'xcode/entitlements': { check: xcodeEntitlements },
    'xcode/app-transport-security': { check: xcodeAppTransportSecurity },
    'xcode/xcstrings': { check: xcstrings },
    'xcode/assets': { check: xcodeAssets },
    'xcode/unused-assets': { check: xcodeUnusedAssets },
    'xcode/files-without-target': { check: xcodeFilesWithoutTarget },
    'swift/build': { check: swiftBuild },
    'swift/swiftlint-analyze': { check: swiftlintAnalyze },
    'swift/periphery': { check: swiftPeriphery },
    'supabase/storage-policies': { check: supabaseStoragePolicies },
    'supabase/deno-lint': { check: supabaseDenoLint },
    'supabase/deno-check': { check: supabaseDenoCheck },
    'supabase/service-role-key': { check: supabaseServiceRoleKey },
    'postgres/row-level-security': { check: postgresRowLevelSecurity },
    'postgres/grants': { check: postgresGrants },
    'postgres/definer-search-path': { check: postgresDefinerSearchPath },
    'postgres/foreign-key-indexes': { check: postgresForeignKeyIndexes },
    'postgres/migration-order': { check: postgresMigrationOrder },
    'postgres/edited-migrations': { check: postgresEditedMigrations },
    'docker/dockerignore': { check: dockerignore },
    'docker/trivy-image': { check: trivyImage },
    'structure/lone-files': { check: loneFiles },
    'structure/shared-prefixes': { check: sharedPrefixes },
    'structure/file-folder-clashes': { check: fileFolderClashes },
    'bash/function-size': { check: bashFunctionSize },
    'bash/doc-comments': { check: bashDocComments },
    'bash/unused-functions': { check: bashUnusedFunctions },
    'bash/unread-arguments': { check: bashUnreadArguments },
    'bash/script-layout': { check: bashScriptLayout },
    'bash/wrappers': { check: bashWrappers },
    'bash/inline-scripts': { check: bashInlineScripts },
    'bash/safety': { check: bashSafety },
    'prose/vale': { check: vale },
    'naming/identifiers': { check: namingIdentifiers },
    'naming/paths': { check: namingPaths },
    'naming/settings': { check: namingSettings },
    'markdown/markdownlint': { run: runCheckCommand, arguments: markdownlintArguments },
    'swift/swiftlint': { run: runCheckCommand, toolFiles: swiftlintConfigurationFiles },
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
} satisfies CheckImplementations;
