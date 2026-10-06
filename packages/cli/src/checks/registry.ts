import { vale } from '#cli/checks/general/vale.ts';
import { locales } from '#cli/checks/library/i18n.ts';
import { nginxTest } from '#cli/checks/tool/nginx.ts';
import { jestCoverage } from '#cli/checks/tool/jest.ts';
import { actionlint } from '#cli/checks/tool/actions.ts';
import { ansibleLint } from '#cli/checks/tool/ansible.ts';
import { fences } from '#cli/checks/language/markdown.ts';
import { gspotDrift } from '#cli/checks/general/gspot.ts';
import { expoDoctor } from '#cli/checks/framework/expo.ts';
import { jscpd } from '#cli/checks/general/duplication.ts';
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
import { licensesPackages } from '#cli/checks/general/licenses.ts';
import { swiftlint } from '#cli/checks/language/swift/swiftlint.ts';
import type { CheckRegistry } from '#cli/types/execution/runtime.ts';
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
    'trpc/boundaries': { engine: trpcBoundaries },
    'expo/doctor': { engine: expoDoctor },
    'svelte/check': { engine: svelteCheck },
    'i18n/locales': { engine: locales },
    'css/module-classes': { engine: moduleClasses },
    'ansible/lint': { engine: ansibleLint },
    'nginx/test': { engine: nginxTest },
    'jest/coverage': { engine: jestCoverage },
    'gspot/drift': { engine: gspotDrift },
    'structure/config-logic': { engine: configurationLogic },
    'structure/suppressions': { engine: suppressions },
    'structure/stale-allowlists': { engine: staleAllowlists },
    'structure/large-files': { engine: largeFiles },
    'structure/tracked-dependencies': { engine: trackedDependencies },
    'typescript/tsconfig': { engine: tsconfig },
    'javascript/rules-off': { engine: rulesOff },
    'docs/headings': { engine: headings },
    'docs/stale-paths': { engine: stalePaths },
    'docs/readme-present': { engine: readmePresent },
    'docs/readme-shape': { engine: readmeShape },
    'markdown/fences': { engine: fences },
    'duplication/jscpd': { engine: jscpd },
    'secrets/env-template': { engine: envTemplate },
    'secrets/env-files': { engine: envFiles },
    'security/codeql': { engine: codeql },
    'secrets/gitleaks-baseline': { engine: gitleaksBaseline },
    'dependencies/manifests': { engine: manifests },
    'dependencies/lockfile-fresh': { engine: lockfileFresh },
    'licenses/packages': { engine: licensesPackages },
    'dependencies/bun-release-age': { engine: bunReleaseAge },
    'dependencies/lockfile-hosts': { engine: lockfileHosts },
    'drizzle/relations': { engine: drizzleRelations },
    'drizzle/migrations-fresh': { engine: drizzleMigrationsFresh },
    'nextjs/route-segments': { engine: routeSegments },
    'nextjs/config': { engine: nextConfiguration },
    'nextjs/tsc': { engine: nextTypes },
    'nextjs/build': { engine: nextBuild },
    'nextjs/version-pairs': { engine: versionPairs },
    'cloudflare/headers': { engine: cloudflareHeaders },
    'cloudflare/redirects': { engine: cloudflareRedirects },
    'cloudflare/wrangler': { engine: cloudflareWrangler },
    'cloudflare/types-fresh': { engine: cloudflareTypesFresh },
    'site/build': { engine: siteBuild },
    'site/build-reproducible': { engine: buildReproducible },
    'site/html-validate': { engine: htmlValidate },
    'site/purgecss': { engine: purgecss },
    'site/linkinator': { engine: (input) => brokenLinks(input, false) },
    'site/linkinator-external': { engine: (input) => brokenLinks(input, true) },
    'site/size': { engine: siteSize },
    'site/sitemap': { engine: sitemap },
    'site/dead-assets': { engine: deadAssets },
    'site/svgo': { engine: svgo },
    'site/webmanifest': { engine: webManifest },
    'site/security-headers': { engine: securityHeaders },
    'html/scripts': { engine: htmlScripts },
    'html/literals': { engine: htmlLiterals },
    'python/file-lines': { engine: pythonFileLines },
    'python/function-lines': { engine: pythonFunctionLines },
    'python/trivial-functions': { engine: pythonTrivialFunctions },
    'python/placeholder-docstrings': { engine: pythonPlaceholderDocstrings },
    'python/private-prefix': { engine: pythonPrivatePrefix },
    'python/private-before-public': { engine: pythonPrivateBeforePublic },
    'python/exports-at-bottom': { engine: pythonExportsAtBottom },
    'python/lazy-exports': { engine: pythonLazyExports },
    'python/package-exports': { engine: pythonPackageExports },
    'python/import-comments': { engine: pythonImportComments },
    'python/export-order': { engine: pythonExportOrder },
    'python/singletons': { engine: pythonSingletons },
    'python/import-linter': { engine: pythonImportLinter },
    'python/pip-installs': { engine: pythonPipInstalls },
    'python/stale-exclusions': { engine: pythonStaleExclusions },
    'xctest/disabled': { engine: disabled },
    'xctest/sleep': { engine: sleeps },
    'xctest/recording': { engine: recording },
    'xctest/references': { engine: xctestReferences },
    'xctest/coverage': { engine: xctestCoverage },
    'xcode/xcconfig': { engine: xcconfig },
    'xcode/entitlements': { engine: entitlements },
    'xcode/ats': { engine: ats },
    'xcode/xcstrings': { engine: xcstrings },
    'xcode/assets': { engine: xcodeAssets },
    'xcode/test-plans': { engine: testPlans },
    'xcode/orphan-sources': { engine: orphanSources },
    'xcode/symlinks': { engine: symlinks },
    'swift/trivial-functions': { engine: swiftTrivialFunctions },
    'swift/duplicate-functions': { engine: swiftDuplicateFunctions },
    'swift/private-before-public': { engine: swiftPrivateBeforePublic },
    'swift/env-owner': { engine: swiftEnvOwner },
    'swift/import-comments': { engine: swiftImportComments },
    'swift/build': { engine: swiftBuild },
    'swift/swiftlint-analyze': { engine: swiftlintAnalyze },
    'swift/periphery': { engine: swiftPeriphery },
    'openapi/spectral': { engine: spectral },
    'openapi/fresh': { engine: openapiFresh },
    'supabase/config': { engine: supabaseConfiguration },
    'supabase/storage-policies': { engine: storagePolicies },
    'supabase/migration-names': { engine: migrationNames },
    'supabase/deno-lint': { engine: denoLint },
    'supabase/deno-check': { engine: denoCheck },
    'supabase/admin-key': { engine: adminKey },
    'supabase/types-fresh': { engine: typesFresh },
    'postgres/rls': { engine: rls },
    'postgres/grants': { engine: grants },
    'postgres/definer-search-path': { engine: definerSearchPath },
    'postgres/foreign-key-indexes': { engine: foreignKeyIndexes },
    'postgres/migration-order': { engine: migrationOrder },
    'postgres/migrations-frozen': { engine: migrationsFrozen },
    'postgres/migration-docs': { engine: migrationDocs },
    'sql/trivial-functions': { engine: sqlTrivialFunctions },
    'sql/syntax': { engine: sqlSyntax },
    'sql/file-lines': { engine: sqlFileLines },
    'docker/dockerignore': { engine: dockerignore },
    'docker/trivy-image': { engine: trivyImage },
    'structure/lone-files': { engine: loneFiles },
    'structure/prefix-collisions': { engine: prefixCollisions },
    'structure/stem-collisions': { engine: stemCollisions },
    'structure/folder-names': { engine: folderNames },
    'bash/limits': { engine: bashLimits },
    'bash/doc-comments': { engine: docComments },
    'bash/duplicate-functions': { engine: duplicateFunctions },
    'bash/unused-functions': { engine: unusedFunctions },
    'bash/unread-arguments': { engine: unreadArguments },
    'bash/private-prefix': { engine: privatePrefix },
    'bash/private-before-public': { engine: privateBeforePublic },
    'bash/trivial-functions': { engine: trivialFunctions },
    'bash/env-owner': { engine: envOwner },
    'bash/contract': { engine: contract },
    'bash/wrappers': { engine: wrappers },
    'bash/embeds': { engine: embeds },
    'bash/ssh-blocks': { engine: sshBlocks },
    'bash/defaults': { engine: guardDefaults },
    'bash/guards': { engine: guards },
    'bash/boundaries': { engine: bashBoundaries },
    'bash/safety': { engine: safety },
    'bash/source-comments': { engine: sourceComments },
    'bash/source-order': { engine: sourceOrder },
    'prose/vale': { engine: vale },
    'naming/identifiers': { engine: namingIdentifiers },
    'naming/paths': { engine: namingPaths },
    'naming/policy': { engine: namingPolicy },
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
