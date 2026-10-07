import { vale } from '#cli/checks/general/prose.ts';
import { locales } from '#cli/checks/library/i18n.ts';
import { nginxTest } from '#cli/checks/tool/nginx.ts';
import { jestCoverage } from '#cli/checks/tool/jest.ts';
import { actionlint } from '#cli/checks/tool/actions.ts';
import { ansibleLint } from '#cli/checks/tool/ansible.ts';
import { fences } from '#cli/checks/language/markdown.ts';
import { gspotDrift } from '#cli/checks/general/gspot.ts';
import { expoDoctor } from '#cli/checks/framework/expo.ts';
import { jscpd } from '#cli/checks/general/duplication.ts';
import { runEngineCheck } from '#cli/execution/engines.ts';
import { moduleClasses } from '#cli/checks/language/css.ts';
import { embeds } from '#cli/checks/language/bash/embeds.ts';
import { safety } from '#cli/checks/language/bash/safety.ts';
import { sshBlocks } from '#cli/checks/language/bash/ssh.ts';
import { trpcBoundaries } from '#cli/checks/library/trpc.ts';
import { svelteCheck } from '#cli/checks/framework/svelte.ts';
import { tsconfig } from '#cli/checks/language/typescript.ts';
import { codeql } from '#cli/checks/general/security/codeql.ts';
import { bashLimits } from '#cli/checks/language/bash/limits.ts';
import { commitlintRange } from '#cli/checks/general/commits.ts';
import { contract } from '#cli/checks/language/bash/contract.ts';
import { wrappers } from '#cli/checks/language/bash/wrappers.ts';
import { envOwner } from '#cli/checks/language/bash/env-owner.ts';
import type { CheckRegistry } from '#cli/types/execution/check.ts';
import { licensesPackages } from '#cli/checks/general/licenses.ts';
import { swiftlint } from '#cli/checks/language/swift/swiftlint.ts';
import { pydoclint } from '#cli/checks/language/python/pydoclint.ts';
import { shellcheck } from '#cli/checks/language/bash/shellcheck.ts';
import { spectral, openapiFresh } from '#cli/checks/tool/openapi.ts';
import { trivyImage, dockerignore } from '#cli/checks/tool/docker.ts';
import { tsc, checkjs } from '#cli/checks/language/javascript/tsc.ts';
import { docComments } from '#cli/checks/language/bash/doc-comments.ts';
import { loneFiles } from '#cli/checks/general/structure/lone-files.ts';
import { rulesOff } from '#cli/checks/language/javascript/rules-off.ts';
import { bashBoundaries } from '#cli/checks/language/bash/boundaries.ts';
import { largeFiles } from '#cli/checks/general/structure/large-files.ts';
import { manifests } from '#cli/checks/general/dependencies/manifests.ts';
import { folderNames } from '#cli/checks/general/structure/folder-names.ts';
import { guards, guardDefaults } from '#cli/checks/language/bash/guards.ts';
import { suppressions } from '#cli/checks/general/structure/suppressions.ts';
import { xcstrings, xcodeAssets } from '#cli/checks/tool/xcode/resources.ts';
import { migrationDocs } from '#cli/checks/database/postgres/migration-docs.ts';
import { unreadArguments } from '#cli/checks/language/bash/unread-arguments.ts';
import { unusedFunctions } from '#cli/checks/language/bash/unused-functions.ts';
import { ats, xcconfig, entitlements } from '#cli/checks/tool/xcode/settings.ts';
import { siteBuild, buildReproducible } from '#cli/checks/general/site/build.ts';
import { foreignKeyIndexes } from '#cli/checks/database/postgres/foreign-keys.ts';
import { stemCollisions } from '#cli/checks/general/structure/stem-collisions.ts';
import { trivialFunctions } from '#cli/checks/language/bash/trivial-functions.ts';
import { configurationLogic } from '#cli/checks/general/structure/config-logic.ts';
import { lockfileFresh } from '#cli/checks/general/dependencies/lockfile/fresh.ts';
import { lockfileHosts } from '#cli/checks/general/dependencies/lockfile/hosts.ts';
import { sourceOrder, sourceComments } from '#cli/checks/language/bash/sources.ts';
import { bunReleaseAge } from '#cli/checks/general/dependencies/bun-release-age.ts';
import { envOwner as swiftEnvOwner } from '#cli/checks/language/swift/env-owner.ts';
import { staleAllowlists } from '#cli/checks/general/structure/stale-allowlists.ts';
import { duplicateFunctions } from '#cli/checks/language/bash/duplicate-functions.ts';
import { prefixCollisions } from '#cli/checks/general/structure/prefix-collisions.ts';
import { symlinks, testPlans, orphanSources } from '#cli/checks/tool/xcode/project.ts';
import { rls, grants, definerSearchPath } from '#cli/checks/database/postgres/access.ts';
import { singletons as pythonSingletons } from '#cli/checks/language/python/singletons.ts';
import { migrationOrder, migrationsFrozen } from '#cli/checks/database/postgres/history.ts';
import { trackedDependencies } from '#cli/checks/general/structure/tracked-dependencies.ts';
import { privatePrefix, privateBeforePublic } from '#cli/checks/language/bash/visibility.ts';
import { headings, stalePaths, readmeShape, readmePresent } from '#cli/checks/general/docs.ts';
import { lazyExports as pythonLazyExports } from '#cli/checks/language/python/lazy-exports.ts';
import { scripts as htmlScripts, literals as htmlLiterals } from '#cli/checks/language/html.ts';
import { deptry, pipInstalls as pythonPipInstalls } from '#cli/checks/language/python/deptry.ts';
import { importLinter as pythonImportLinter } from '#cli/checks/language/python/imports/linter.ts';
import { swiftBuild, swiftPeriphery, swiftlintAnalyze } from '#cli/checks/language/swift/build.ts';
import { svgo, deadAssets, webManifest, securityHeaders } from '#cli/checks/general/site/source.ts';
import { importComments as swiftImportComments } from '#cli/checks/language/swift/import-comments.ts';
import { staleExclusions as pythonStaleExclusions } from '#cli/checks/language/python/basedpyright.ts';
import { importComments as pythonImportComments } from '#cli/checks/language/python/imports/comments.ts';
import { namingPaths, namingPolicy, namingIdentifiers } from '#cli/checks/general/naming/identifiers.ts';
import { sleeps, disabled, recording, xctestCoverage, xctestReferences } from '#cli/checks/tool/xctest.ts';
import { sitemap, purgecss, siteSize, brokenLinks, htmlValidate } from '#cli/checks/general/site/output.ts';
import { relations as drizzleRelations, migrations as drizzleMigrationsFresh } from '#cli/checks/library/drizzle.ts';
import { envFiles, trufflehog, envTemplate, gitleaksHistory, gitleaksBaseline } from '#cli/checks/general/secrets.ts';
import { privateBeforePublic as swiftPrivateBeforePublic } from '#cli/checks/language/swift/private-before-public.ts';
import { nextBuild, nextTypes, versionPairs, routeSegments, nextConfiguration } from '#cli/checks/framework/nextjs.ts';

import {
    fileLines as pythonFileLines,
    functionLines as pythonFunctionLines,
} from '#cli/checks/language/python/limits.ts';
import {
    trivialFunctions as swiftTrivialFunctions,
    duplicateFunctions as swiftDuplicateFunctions,
} from '#cli/checks/language/swift/functions.ts';
import {
    trivialFunctions as pythonTrivialFunctions,
    placeholderDocstrings as pythonPlaceholderDocstrings,
} from '#cli/checks/language/python/functions.ts';
import {
    syntax as sqlSyntax,
    fileLines as sqlFileLines,
    trivialFunctions as sqlTrivialFunctions,
} from '#cli/checks/language/sql.ts';
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

/** Every built-in implementation, keyed by its public check name. */
export const CHECKS: CheckRegistry = {
    'trpc/boundaries': { run: runEngineCheck(trpcBoundaries) },
    'expo/doctor': { run: runEngineCheck(expoDoctor) },
    'svelte/check': { run: runEngineCheck(svelteCheck) },
    'i18n/locales': { run: runEngineCheck(locales) },
    'css/module-classes': { run: runEngineCheck(moduleClasses) },
    'ansible/lint': { run: runEngineCheck(ansibleLint) },
    'nginx/test': { run: runEngineCheck(nginxTest) },
    'jest/coverage': { run: runEngineCheck(jestCoverage) },
    'gspot/drift': { run: gspotDrift },
    'structure/config-logic': { run: runEngineCheck(configurationLogic) },
    'structure/suppressions': { run: runEngineCheck(suppressions) },
    'structure/stale-allowlists': { run: runEngineCheck(staleAllowlists) },
    'structure/large-files': { run: runEngineCheck(largeFiles) },
    'structure/tracked-dependencies': { run: runEngineCheck(trackedDependencies) },
    'typescript/tsconfig': { run: runEngineCheck(tsconfig) },
    'javascript/rules-off': { run: runEngineCheck(rulesOff) },
    'docs/headings': { run: runEngineCheck(headings) },
    'docs/stale-paths': { run: runEngineCheck(stalePaths) },
    'docs/readme-present': { run: runEngineCheck(readmePresent) },
    'docs/readme-shape': { run: runEngineCheck(readmeShape) },
    'markdown/fences': { run: runEngineCheck(fences) },
    'duplication/jscpd': { run: runEngineCheck(jscpd) },
    'secrets/env-template': { run: runEngineCheck(envTemplate) },
    'secrets/env-files': { run: runEngineCheck(envFiles) },
    'security/codeql': { run: runEngineCheck(codeql) },
    'secrets/gitleaks-baseline': { run: runEngineCheck(gitleaksBaseline) },
    'dependencies/manifests': { run: runEngineCheck(manifests) },
    'dependencies/lockfile-fresh': { run: runEngineCheck(lockfileFresh) },
    'licenses/packages': { run: runEngineCheck(licensesPackages) },
    'dependencies/bun-release-age': { run: runEngineCheck(bunReleaseAge) },
    'dependencies/lockfile-hosts': { run: runEngineCheck(lockfileHosts) },
    'drizzle/relations': { run: runEngineCheck(drizzleRelations) },
    'drizzle/migrations-fresh': { run: runEngineCheck(drizzleMigrationsFresh) },
    'nextjs/route-segments': { run: runEngineCheck(routeSegments) },
    'nextjs/config': { run: runEngineCheck(nextConfiguration) },
    'nextjs/tsc': { run: runEngineCheck(nextTypes) },
    'nextjs/build': { run: runEngineCheck(nextBuild) },
    'nextjs/version-pairs': { run: runEngineCheck(versionPairs) },
    'cloudflare/headers': { run: runEngineCheck(cloudflareHeaders) },
    'cloudflare/redirects': { run: runEngineCheck(cloudflareRedirects) },
    'cloudflare/wrangler': { run: runEngineCheck(cloudflareWrangler) },
    'cloudflare/types-fresh': { run: runEngineCheck(cloudflareTypesFresh) },
    'site/build': { run: runEngineCheck(siteBuild) },
    'site/build-reproducible': { run: runEngineCheck(buildReproducible) },
    'site/html-validate': { run: runEngineCheck(htmlValidate) },
    'site/purgecss': { run: runEngineCheck(purgecss) },
    'site/linkinator': { run: runEngineCheck((input) => brokenLinks(input, false)) },
    'site/linkinator-external': { run: runEngineCheck((input) => brokenLinks(input, true)) },
    'site/size': { run: runEngineCheck(siteSize) },
    'site/sitemap': { run: runEngineCheck(sitemap) },
    'site/dead-assets': { run: runEngineCheck(deadAssets) },
    'site/svgo': { run: runEngineCheck(svgo) },
    'site/webmanifest': { run: runEngineCheck(webManifest) },
    'site/security-headers': { run: runEngineCheck(securityHeaders) },
    'html/scripts': { run: runEngineCheck(htmlScripts) },
    'html/literals': { run: runEngineCheck(htmlLiterals) },
    'python/file-lines': { run: runEngineCheck(pythonFileLines) },
    'python/function-lines': { run: runEngineCheck(pythonFunctionLines) },
    'python/trivial-functions': { run: runEngineCheck(pythonTrivialFunctions) },
    'python/placeholder-docstrings': { run: runEngineCheck(pythonPlaceholderDocstrings) },
    'python/private-prefix': { run: runEngineCheck(pythonPrivatePrefix) },
    'python/private-before-public': { run: runEngineCheck(pythonPrivateBeforePublic) },
    'python/exports-at-bottom': { run: runEngineCheck(pythonExportsAtBottom) },
    'python/lazy-exports': { run: runEngineCheck(pythonLazyExports) },
    'python/package-exports': { run: runEngineCheck(pythonPackageExports) },
    'python/import-comments': { run: runEngineCheck(pythonImportComments) },
    'python/export-order': { run: runEngineCheck(pythonExportOrder) },
    'python/singletons': { run: runEngineCheck(pythonSingletons) },
    'python/import-linter': { run: runEngineCheck(pythonImportLinter) },
    'python/pip-installs': { run: runEngineCheck(pythonPipInstalls) },
    'python/stale-exclusions': { run: runEngineCheck(pythonStaleExclusions) },
    'xctest/disabled': { run: runEngineCheck(disabled) },
    'xctest/sleep': { run: runEngineCheck(sleeps) },
    'xctest/recording': { run: runEngineCheck(recording) },
    'xctest/references': { run: runEngineCheck(xctestReferences) },
    'xctest/coverage': { run: runEngineCheck(xctestCoverage) },
    'xcode/xcconfig': { run: runEngineCheck(xcconfig) },
    'xcode/entitlements': { run: runEngineCheck(entitlements) },
    'xcode/ats': { run: runEngineCheck(ats) },
    'xcode/xcstrings': { run: runEngineCheck(xcstrings) },
    'xcode/assets': { run: runEngineCheck(xcodeAssets) },
    'xcode/test-plans': { run: runEngineCheck(testPlans) },
    'xcode/orphan-sources': { run: runEngineCheck(orphanSources) },
    'xcode/symlinks': { run: runEngineCheck(symlinks) },
    'swift/trivial-functions': { run: runEngineCheck(swiftTrivialFunctions) },
    'swift/duplicate-functions': { run: runEngineCheck(swiftDuplicateFunctions) },
    'swift/private-before-public': { run: runEngineCheck(swiftPrivateBeforePublic) },
    'swift/env-owner': { run: runEngineCheck(swiftEnvOwner) },
    'swift/import-comments': { run: runEngineCheck(swiftImportComments) },
    'swift/build': { run: runEngineCheck(swiftBuild) },
    'swift/swiftlint-analyze': { run: runEngineCheck(swiftlintAnalyze) },
    'swift/periphery': { run: runEngineCheck(swiftPeriphery) },
    'openapi/spectral': { run: runEngineCheck(spectral) },
    'openapi/fresh': { run: runEngineCheck(openapiFresh) },
    'supabase/config': { run: runEngineCheck(supabaseConfiguration) },
    'supabase/storage-policies': { run: runEngineCheck(storagePolicies) },
    'supabase/migration-names': { run: runEngineCheck(migrationNames) },
    'supabase/deno-lint': { run: runEngineCheck(denoLint) },
    'supabase/deno-check': { run: runEngineCheck(denoCheck) },
    'supabase/admin-key': { run: runEngineCheck(adminKey) },
    'supabase/types-fresh': { run: runEngineCheck(typesFresh) },
    'postgres/rls': { run: runEngineCheck(rls) },
    'postgres/grants': { run: runEngineCheck(grants) },
    'postgres/definer-search-path': { run: runEngineCheck(definerSearchPath) },
    'postgres/foreign-key-indexes': { run: runEngineCheck(foreignKeyIndexes) },
    'postgres/migration-order': { run: runEngineCheck(migrationOrder) },
    'postgres/migrations-frozen': { run: runEngineCheck(migrationsFrozen) },
    'postgres/migration-docs': { run: runEngineCheck(migrationDocs) },
    'sql/trivial-functions': { run: runEngineCheck(sqlTrivialFunctions) },
    'sql/syntax': { run: runEngineCheck(sqlSyntax) },
    'sql/file-lines': { run: runEngineCheck(sqlFileLines) },
    'docker/dockerignore': { run: runEngineCheck(dockerignore) },
    'docker/trivy-image': { run: runEngineCheck(trivyImage) },
    'structure/lone-files': { run: runEngineCheck(loneFiles) },
    'structure/prefix-collisions': { run: runEngineCheck(prefixCollisions) },
    'structure/stem-collisions': { run: runEngineCheck(stemCollisions) },
    'structure/folder-names': { run: runEngineCheck(folderNames) },
    'bash/limits': { run: runEngineCheck(bashLimits) },
    'bash/doc-comments': { run: runEngineCheck(docComments) },
    'bash/duplicate-functions': { run: runEngineCheck(duplicateFunctions) },
    'bash/unused-functions': { run: runEngineCheck(unusedFunctions) },
    'bash/unread-arguments': { run: runEngineCheck(unreadArguments) },
    'bash/private-prefix': { run: runEngineCheck(privatePrefix) },
    'bash/private-before-public': { run: runEngineCheck(privateBeforePublic) },
    'bash/trivial-functions': { run: runEngineCheck(trivialFunctions) },
    'bash/env-owner': { run: runEngineCheck(envOwner) },
    'bash/contract': { run: runEngineCheck(contract) },
    'bash/wrappers': { run: runEngineCheck(wrappers) },
    'bash/embeds': { run: runEngineCheck(embeds) },
    'bash/ssh-blocks': { run: runEngineCheck(sshBlocks) },
    'bash/defaults': { run: runEngineCheck(guardDefaults) },
    'bash/guards': { run: runEngineCheck(guards) },
    'bash/boundaries': { run: runEngineCheck(bashBoundaries) },
    'bash/safety': { run: runEngineCheck(safety) },
    'bash/source-comments': { run: runEngineCheck(sourceComments) },
    'bash/source-order': { run: runEngineCheck(sourceOrder) },
    'prose/vale': { run: runEngineCheck(vale) },
    'naming/identifiers': { run: runEngineCheck(namingIdentifiers) },
    'naming/paths': { run: runEngineCheck(namingPaths) },
    'naming/policy': { run: runEngineCheck(namingPolicy) },
    'secrets/trufflehog': { run: trufflehog },
    'secrets/gitleaks-history': { run: gitleaksHistory },
    'commits/commitlint-range': { run: commitlintRange },
    'vue/tsc': { run: tsc },
    'typescript/tsc': { run: tsc },
    'javascript/tsc': { run: checkjs },
    'swift/swiftlint': { run: swiftlint },
    'bash/shellcheck': { run: shellcheck },
    'python/pydoclint': { run: pydoclint },
    'python/deptry': { run: deptry },
    'actions/actionlint': { run: actionlint },
};
