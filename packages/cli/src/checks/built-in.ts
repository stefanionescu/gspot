import { vale } from '#cli/checks/general/prose.ts';
import { locales } from '#cli/checks/library/i18n.ts';
import { nginxTest } from '#cli/checks/tool/nginx.ts';
import { jestCoverage } from '#cli/checks/tool/jest.ts';
import { actionlint } from '#cli/checks/tool/actions.ts';
import { ansibleLint } from '#cli/checks/tool/ansible.ts';
import { fences } from '#cli/checks/language/markdown.ts';
import { expoDoctor } from '#cli/checks/framework/expo.ts';
import { jscpd } from '#cli/checks/general/duplication.ts';
import { openapiFresh } from '#cli/checks/tool/openapi.ts';
import { moduleClasses } from '#cli/checks/language/css.ts';
import { embeds } from '#cli/checks/language/bash/embeds.ts';
import { runBuiltInCheck } from '#cli/execution/built-in.ts';
import { safety } from '#cli/checks/language/bash/safety.ts';
import { sshBlocks } from '#cli/checks/language/bash/ssh.ts';
import { svelteCheck } from '#cli/checks/framework/svelte.ts';
import { commitlintRange } from '#cli/checks/general/commits.ts';
import { contract } from '#cli/checks/language/bash/contract.ts';
import { wrappers } from '#cli/checks/language/bash/wrappers.ts';
import { codeql, semgrep } from '#cli/checks/general/security.ts';
import { envOwner } from '#cli/checks/language/bash/env-owner.ts';
import type { BuiltInChecks } from '#cli/types/execution/check.ts';
import { licensesPackages } from '#cli/checks/general/licenses.ts';
import { pydoclint } from '#cli/checks/language/python/pydoclint.ts';
import { shellcheck } from '#cli/checks/language/bash/shellcheck.ts';
import { trivyImage, dockerignore } from '#cli/checks/tool/docker.ts';
import { docComments } from '#cli/checks/language/bash/doc-comments.ts';
import { fileLines } from '#cli/checks/general/structure/file-lines.ts';
import { loneFiles } from '#cli/checks/general/structure/lone-files.ts';
import { largeFiles } from '#cli/checks/general/structure/large-files.ts';
import { manifests } from '#cli/checks/general/dependencies/manifests.ts';
import { folderNames } from '#cli/checks/general/structure/folder-names.ts';
import { guards, guardDefaults } from '#cli/checks/language/bash/guards.ts';
import { tsc, checkjs, tsconfig } from '#cli/checks/language/typescript.ts';
import { suppressions } from '#cli/checks/general/structure/suppressions.ts';
import { sleeps, disabled, xctestCoverage } from '#cli/checks/tool/xctest.ts';
import { unmatchedPaths } from '#cli/checks/general/gspot/unmatched-paths.ts';
import { migrationDocs } from '#cli/checks/database/postgres/migration-docs.ts';
import { testPlacement } from '#cli/checks/general/structure/test-placement.ts';
import { unreadArguments } from '#cli/checks/language/bash/unread-arguments.ts';
import { unusedFunctions } from '#cli/checks/language/bash/unused-functions.ts';
import { ats, xcconfig, entitlements } from '#cli/checks/tool/xcode/settings.ts';
import { siteBuild, buildReproducible } from '#cli/checks/general/site/build.ts';
import { versionPairs } from '#cli/checks/general/dependencies/version-pairs.ts';
import { foreignKeyIndexes } from '#cli/checks/database/postgres/foreign-keys.ts';
import { stemCollisions } from '#cli/checks/general/structure/stem-collisions.ts';
import { trivialFunctions } from '#cli/checks/language/bash/trivial-functions.ts';
import { configurationLogic } from '#cli/checks/general/structure/config-logic.ts';
import { lockfileFresh } from '#cli/checks/general/dependencies/lockfile/fresh.ts';
import { lockfileHosts } from '#cli/checks/general/dependencies/lockfile/hosts.ts';
import { sourceOrder, sourceComments } from '#cli/checks/language/bash/sources.ts';
import { bunReleaseAge } from '#cli/checks/general/dependencies/bun-release-age.ts';
import { envOwner as swiftEnvOwner } from '#cli/checks/language/swift/env-owner.ts';
import { prefixCollisions } from '#cli/checks/general/structure/prefix-collisions.ts';
import { recording, references } from '#cli/checks/library/swift-snapshot-testing.ts';
import { trivialFunctions as sqlTrivialFunctions } from '#cli/checks/language/sql.ts';
import { symlinks, testPlans, orphanSources } from '#cli/checks/tool/xcode/project.ts';
import { rls, grants, definerSearchPath } from '#cli/checks/database/postgres/access.ts';
import { singletons as pythonSingletons } from '#cli/checks/language/python/singletons.ts';
import { migrationOrder, migrationsFrozen } from '#cli/checks/database/postgres/history.ts';
import { trackedDependencies } from '#cli/checks/general/structure/tracked-dependencies.ts';
import { privatePrefix, privateBeforePublic } from '#cli/checks/language/bash/visibility.ts';
import { functionSize as bashFunctionSize } from '#cli/checks/language/bash/function-size.ts';
import { headings, stalePaths, readmeShape, readmePresent } from '#cli/checks/general/docs.ts';
import { lazyExports as pythonLazyExports } from '#cli/checks/language/python/lazy-exports.ts';
import { scripts as htmlScripts, literals as htmlLiterals } from '#cli/checks/language/html.ts';
import { xcstrings, orphanAssets, contentsFindings } from '#cli/checks/tool/xcode/resources.ts';
import { deptry, pipInstalls as pythonPipInstalls } from '#cli/checks/language/python/deptry.ts';
import { functionSize as pythonFunctionSize } from '#cli/checks/language/python/function-size.ts';
import { importLinter as pythonImportLinter } from '#cli/checks/language/python/imports/linter.ts';
import { swiftBuild, swiftPeriphery, swiftlintAnalyze } from '#cli/checks/language/swift/build.ts';
import { envFiles, trufflehog, envTemplate, gitleaksHistory } from '#cli/checks/general/secrets.ts';
import { gspotDrift, fixPolicyLayout, gspotPolicyLayout } from '#cli/checks/general/gspot/drift.ts';
import { svgo, deadAssets, webManifest, securityHeaders } from '#cli/checks/general/site/source.ts';
import { trivialFunctions as swiftTrivialFunctions } from '#cli/checks/language/swift/functions.ts';
import { NEXT_VERSION_PAIRS, REACT_VERSION_PAIRS } from '#cli/config/checks/general/dependencies.ts';
import { importComments as swiftImportComments } from '#cli/checks/language/swift/import-comments.ts';
import { importComments as pythonImportComments } from '#cli/checks/language/python/imports/comments.ts';
import { namingPaths, namingPolicy, namingIdentifiers } from '#cli/checks/general/naming/identifiers.ts';
import { nextBuild, nextjsTsc, routeSegments, nextConfiguration } from '#cli/checks/framework/nextjs.ts';
import { sitemap, purgecss, siteSize, linkinator, htmlValidate } from '#cli/checks/general/site/output.ts';
import { relations as drizzleRelations, migrations as drizzleMigrationsFresh } from '#cli/checks/library/drizzle.ts';
import { privateBeforePublic as swiftPrivateBeforePublic } from '#cli/checks/language/swift/private-before-public.ts';

import {
    trivialFunctions as pythonTrivialFunctions,
    placeholderDocstrings as pythonPlaceholderDocstrings,
} from '#cli/checks/language/python/functions.ts';
import {
    headers as cloudflareHeaders,
    wrangler as cloudflareWrangler,
    redirects as cloudflareRedirects,
    typesFresh as cloudflareTypesFresh,
} from '#cli/checks/platform/cloudflare.ts';
import {
    exportOrder as pythonExportOrder,
    privatePrefix as pythonPrivatePrefix,
    packageExports as pythonPackageExports,
    exportsAtBottom as pythonExportsAtBottom,
    privateBeforePublic as pythonPrivateBeforePublic,
} from '#cli/checks/language/python/exports.ts';
import {
    adminKey,
    denoLint,
    denoCheck,
    typesFresh,
    migrationNames,
    storagePolicies,
    supabaseConfiguration,
} from '#cli/checks/platform/supabase.ts';

/** Every built-in implementation, keyed by its check ID. */
export const BUILT_IN_CHECKS: BuiltInChecks = {
    'expo/doctor': { run: runBuiltInCheck(expoDoctor) },
    'svelte/svelte-check': { run: runBuiltInCheck(svelteCheck) },
    'i18n/locales': { run: runBuiltInCheck(locales) },
    'css/module-classes': { run: runBuiltInCheck(moduleClasses) },
    'ansible/lint': { run: runBuiltInCheck(ansibleLint) },
    'nginx/test': { run: runBuiltInCheck(nginxTest) },
    'jest/coverage': { run: runBuiltInCheck(jestCoverage) },
    'gspot/drift': { run: gspotDrift },
    'gspot/policy-layout': { run: gspotPolicyLayout, fix: fixPolicyLayout },
    'structure/file-lines': { run: runBuiltInCheck(fileLines) },
    'structure/config-logic': { run: runBuiltInCheck(configurationLogic) },
    'structure/suppressions': { run: runBuiltInCheck(suppressions) },
    'gspot/unmatched-paths': { run: runBuiltInCheck(unmatchedPaths) },
    'structure/large-files': { run: runBuiltInCheck(largeFiles) },
    'structure/tracked-dependencies': { run: runBuiltInCheck(trackedDependencies) },
    'typescript/tsconfig': { run: runBuiltInCheck(tsconfig) },
    'docs/headings': { run: runBuiltInCheck(headings) },
    'docs/stale-paths': { run: runBuiltInCheck(stalePaths) },
    'docs/readme-present': { run: runBuiltInCheck(readmePresent) },
    'docs/readme-shape': { run: runBuiltInCheck(readmeShape) },
    'markdown/fences': { run: runBuiltInCheck(fences) },
    'duplication/jscpd': { run: runBuiltInCheck(jscpd) },
    'secrets/env-template': { run: runBuiltInCheck(envTemplate) },
    'secrets/env-files': { run: runBuiltInCheck(envFiles) },
    'security/codeql': { run: runBuiltInCheck(codeql) },
    'security/semgrep': { run: semgrep },
    'dependencies/manifests': { run: runBuiltInCheck(manifests) },
    'dependencies/lockfile-fresh': { run: runBuiltInCheck(lockfileFresh) },
    'licenses/packages': { run: runBuiltInCheck(licensesPackages) },
    'dependencies/bun-release-age': { run: runBuiltInCheck(bunReleaseAge) },
    'dependencies/lockfile-hosts': { run: runBuiltInCheck(lockfileHosts) },
    'drizzle/relations': { run: runBuiltInCheck(drizzleRelations) },
    'drizzle/migrations-fresh': { run: runBuiltInCheck(drizzleMigrationsFresh) },
    'nextjs/route-segments': { run: runBuiltInCheck(routeSegments) },
    'nextjs/next-config': { run: runBuiltInCheck(nextConfiguration) },
    'nextjs/tsc': { run: nextjsTsc },
    'nextjs/build': { run: runBuiltInCheck(nextBuild) },
    'nextjs/version-pairs': { run: runBuiltInCheck((input) => versionPairs(input, NEXT_VERSION_PAIRS)) },
    'react/version-pairs': { run: runBuiltInCheck((input) => versionPairs(input, REACT_VERSION_PAIRS)) },
    'cloudflare/headers': { run: runBuiltInCheck(cloudflareHeaders) },
    'cloudflare/redirects': { run: runBuiltInCheck(cloudflareRedirects) },
    'cloudflare/wrangler': { run: runBuiltInCheck(cloudflareWrangler) },
    'cloudflare/types-fresh': { run: runBuiltInCheck(cloudflareTypesFresh) },
    'site/build': { run: runBuiltInCheck(siteBuild) },
    'site/build-reproducible': { run: runBuiltInCheck(buildReproducible) },
    'site/html-validate': { run: runBuiltInCheck(htmlValidate) },
    'site/purgecss': { run: runBuiltInCheck(purgecss) },
    'site/linkinator': { run: runBuiltInCheck((input) => linkinator(input, false)) },
    'site/linkinator-external': { run: runBuiltInCheck((input) => linkinator(input, true)) },
    'site/size': { run: runBuiltInCheck(siteSize) },
    'site/sitemap': { run: runBuiltInCheck(sitemap) },
    'site/dead-assets': { run: runBuiltInCheck(deadAssets) },
    'site/svgo': { run: runBuiltInCheck(svgo) },
    'site/webmanifest': { run: runBuiltInCheck(webManifest) },
    'site/security-headers': { run: runBuiltInCheck(securityHeaders) },
    'html/scripts': { run: runBuiltInCheck(htmlScripts) },
    'html/literals': { run: runBuiltInCheck(htmlLiterals) },
    'python/function-size': { run: runBuiltInCheck(pythonFunctionSize) },
    'python/trivial-functions': { run: runBuiltInCheck(pythonTrivialFunctions) },
    'python/placeholder-docstrings': { run: runBuiltInCheck(pythonPlaceholderDocstrings) },
    'python/private-prefix': { run: runBuiltInCheck(pythonPrivatePrefix) },
    'python/private-before-public': { run: runBuiltInCheck(pythonPrivateBeforePublic) },
    'python/exports-at-bottom': { run: runBuiltInCheck(pythonExportsAtBottom) },
    'python/lazy-exports': { run: runBuiltInCheck(pythonLazyExports) },
    'python/package-exports': { run: runBuiltInCheck(pythonPackageExports) },
    'python/import-comments': { run: runBuiltInCheck(pythonImportComments) },
    'python/export-order': { run: runBuiltInCheck(pythonExportOrder) },
    'python/singletons': { run: runBuiltInCheck(pythonSingletons) },
    'python/import-linter': { run: runBuiltInCheck(pythonImportLinter) },
    'python/pip-installs': { run: runBuiltInCheck(pythonPipInstalls) },
    'xctest/disabled': { run: runBuiltInCheck(disabled) },
    'xctest/sleep': { run: runBuiltInCheck(sleeps) },
    'swift-snapshot-testing/recording': { run: runBuiltInCheck(recording) },
    'swift-snapshot-testing/references': { run: runBuiltInCheck(references) },
    'xctest/coverage': { run: runBuiltInCheck(xctestCoverage) },
    'xcode/xcconfig': { run: runBuiltInCheck(xcconfig) },
    'xcode/entitlements': { run: runBuiltInCheck(entitlements) },
    'xcode/ats': { run: runBuiltInCheck(ats) },
    'xcode/xcstrings': { run: runBuiltInCheck(xcstrings) },
    'xcode/assets': { run: runBuiltInCheck(contentsFindings) },
    'xcode/orphan-assets': { run: runBuiltInCheck(orphanAssets) },
    'xcode/test-plans': { run: runBuiltInCheck(testPlans) },
    'xcode/orphan-sources': { run: runBuiltInCheck(orphanSources) },
    'xcode/symlinks': { run: runBuiltInCheck(symlinks) },
    'swift/trivial-functions': { run: runBuiltInCheck(swiftTrivialFunctions) },
    'swift/private-before-public': { run: runBuiltInCheck(swiftPrivateBeforePublic) },
    'swift/env-owner': { run: runBuiltInCheck(swiftEnvOwner) },
    'swift/import-comments': { run: runBuiltInCheck(swiftImportComments) },
    'swift/build': { run: runBuiltInCheck(swiftBuild) },
    'swift/swiftlint-analyze': { run: runBuiltInCheck(swiftlintAnalyze) },
    'swift/periphery': { run: runBuiltInCheck(swiftPeriphery) },
    'openapi/fresh': { run: runBuiltInCheck(openapiFresh) },
    'supabase/project-file': { run: runBuiltInCheck(supabaseConfiguration) },
    'supabase/storage-policies': { run: runBuiltInCheck(storagePolicies) },
    'supabase/migration-names': { run: runBuiltInCheck(migrationNames) },
    'supabase/deno-lint': { run: runBuiltInCheck(denoLint) },
    'supabase/deno-check': { run: runBuiltInCheck(denoCheck) },
    'supabase/service-role-key': { run: runBuiltInCheck(adminKey) },
    'supabase/types-fresh': { run: runBuiltInCheck(typesFresh) },
    'postgres/rls': { run: runBuiltInCheck(rls) },
    'postgres/grants': { run: runBuiltInCheck(grants) },
    'postgres/definer-search-path': { run: runBuiltInCheck(definerSearchPath) },
    'postgres/foreign-key-indexes': { run: runBuiltInCheck(foreignKeyIndexes) },
    'postgres/migration-order': { run: runBuiltInCheck(migrationOrder) },
    'postgres/migrations-frozen': { run: runBuiltInCheck(migrationsFrozen) },
    'postgres/migration-docs': { run: runBuiltInCheck(migrationDocs) },
    'sql/trivial-functions': { run: runBuiltInCheck(sqlTrivialFunctions) },
    'docker/dockerignore': { run: runBuiltInCheck(dockerignore) },
    'docker/trivy-image': { run: runBuiltInCheck(trivyImage) },
    'structure/lone-files': { run: runBuiltInCheck(loneFiles) },
    'structure/prefix-collisions': { run: runBuiltInCheck(prefixCollisions) },
    'structure/stem-collisions': { run: runBuiltInCheck(stemCollisions) },
    'structure/folder-names': { run: runBuiltInCheck(folderNames) },
    'structure/test-placement': { run: runBuiltInCheck(testPlacement) },
    'bash/function-size': { run: runBuiltInCheck(bashFunctionSize) },
    'bash/doc-comments': { run: runBuiltInCheck(docComments) },
    'bash/unused-functions': { run: runBuiltInCheck(unusedFunctions) },
    'bash/unread-arguments': { run: runBuiltInCheck(unreadArguments) },
    'bash/private-prefix': { run: runBuiltInCheck(privatePrefix) },
    'bash/private-before-public': { run: runBuiltInCheck(privateBeforePublic) },
    'bash/trivial-functions': { run: runBuiltInCheck(trivialFunctions) },
    'bash/env-owner': { run: runBuiltInCheck(envOwner) },
    'bash/contract': { run: runBuiltInCheck(contract) },
    'bash/wrappers': { run: runBuiltInCheck(wrappers) },
    'bash/embeds': { run: runBuiltInCheck(embeds) },
    'bash/ssh-blocks': { run: runBuiltInCheck(sshBlocks) },
    'bash/defaults': { run: runBuiltInCheck(guardDefaults) },
    'bash/guards': { run: runBuiltInCheck(guards) },
    'bash/safety': { run: runBuiltInCheck(safety) },
    'bash/source-comments': { run: runBuiltInCheck(sourceComments) },
    'bash/source-order': { run: runBuiltInCheck(sourceOrder) },
    'prose/vale': { run: runBuiltInCheck(vale) },
    'naming/identifiers': { run: runBuiltInCheck(namingIdentifiers) },
    'naming/paths': { run: runBuiltInCheck(namingPaths) },
    'naming/policy': { run: runBuiltInCheck(namingPolicy) },
    'secrets/trufflehog': { run: trufflehog },
    'secrets/gitleaks-history': { run: gitleaksHistory },
    'commits/commitlint-range': { run: commitlintRange },
    'vue/vue-tsc': { run: tsc },
    'typescript/tsc': { run: tsc },
    'javascript/tsc': { run: checkjs },
    'bash/shellcheck': { run: shellcheck },
    'python/pydoclint': { run: pydoclint },
    'python/deptry': { run: deptry },
    'actions/actionlint': { run: actionlint },
};
