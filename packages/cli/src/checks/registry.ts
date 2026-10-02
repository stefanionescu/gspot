// Every check gspot runs itself, keyed by check ID: the analyses of the kits, and the checks that drive their own tool.
import { generatedDrift } from '#cli/checks/drift.ts';
import { jestCoverage } from '#cli/checks/tool/jest.ts';
import { ansibleLint } from '#cli/checks/tool/ansible.ts';
import { envExample } from '#cli/checks/general/files.ts';
import { fences } from '#cli/checks/language/markdown.ts';
import { localeFiles } from '#cli/checks/library/i18n.ts';
import { SQL_ANALYSES } from '#cli/checks/language/sql.ts';
import { checkActions } from '#cli/checks/tool/actions.ts';
import { nginxTest } from '#cli/checks/tool/nginx/test.ts';
import { HTML_ANALYSES } from '#cli/checks/language/html.ts';
import { banned } from '#cli/checks/general/prose/hidden.ts';
import { cssModuleUsage } from '#cli/checks/language/css.ts';
import { trpcBoundaries } from '#cli/checks/library/trpc.ts';
import { svelteCheck } from '#cli/checks/framework/svelte.ts';
import { codeql } from '#cli/checks/general/security/codeql.ts';
import { routesTested } from '#cli/checks/framework/express.ts';
import { scriptRemote } from '#cli/checks/language/bash/ssh.ts';
import { bashLimits } from '#cli/checks/language/bash/limits.ts';
import { valeFindings } from '#cli/checks/general/prose/vale.ts';
import { DRIZZLE_ANALYSES } from '#cli/checks/library/drizzle.ts';
import { copiedBlocks } from '#cli/checks/general/duplication.ts';
import { expoDoctor } from '#cli/checks/framework/react-native.ts';
import { licensesPackages } from '#cli/checks/general/licenses.ts';
import { scriptInline } from '#cli/checks/language/bash/embeds.ts';
import { scriptSafety } from '#cli/checks/language/bash/safety.ts';
import { testCoverage } from '#cli/checks/tool/xctest/coverage.ts';
import { docsHeadings } from '#cli/checks/general/docs/headings.ts';
import { envFiles } from '#cli/checks/general/secrets/env-files.ts';
import { trivyImage } from '#cli/checks/tool/docker/trivy-image.ts';
import { checkCommitMessages } from '#cli/checks/general/commits.ts';
import { scriptPolicy } from '#cli/checks/language/bash/wrappers.ts';
import { stalePaths } from '#cli/checks/general/docs/stale-paths.ts';
import { tsconfigOptions } from '#cli/checks/language/typescript.ts';
import { adminKey } from '#cli/checks/platform/supabase/admin-key.ts';
import { docComment } from '#cli/checks/language/bash/doc-comments.ts';
import { dockerignore } from '#cli/checks/tool/docker/dockerignore.ts';
import { envAccessOwner } from '#cli/checks/language/bash/env-owner.ts';
import { openapiLint, openapiFresh } from '#cli/checks/tool/openapi.ts';
import { referenceOwners } from '#cli/checks/tool/xctest/references.ts';
import { CLOUDFLARE_ANALYSES } from '#cli/checks/platform/cloudflare.ts';
import { SWIFT_ANALYSES } from '#cli/checks/language/swift/structure.ts';
import { checkSwiftlint } from '#cli/checks/language/swift/swiftlint.ts';
import { checkDependencies } from '#cli/checks/language/python/deptry.ts';
import { largeFiles } from '#cli/checks/general/structure/large-files.ts';
import { scriptInterpreter } from '#cli/checks/language/bash/contract.ts';
import { typesFresh } from '#cli/checks/platform/supabase/types-fresh.ts';
import { NAMING_ENGINES } from '#cli/checks/general/naming/identifiers.ts';
import { PYTHON_ANALYSES } from '#cli/checks/language/python/structure.ts';
import { checkDocstrings } from '#cli/checks/language/python/pydoclint.ts';
import { scriptBoundaries } from '#cli/checks/language/bash/boundaries.ts';
import { structureEngine } from '#cli/checks/general/structure/context.ts';
import { denoLint, denoCheck } from '#cli/checks/platform/supabase/deno.ts';
import { installPolicy } from '#cli/checks/general/dependencies/install.ts';
import { requiredRules } from '#cli/checks/language/javascript/rules-off.ts';
import { suppressions } from '#cli/checks/general/structure/suppressions.ts';
import { fileIntegrity } from '#cli/checks/general/structure/config-logic.ts';
import { deadParameters } from '#cli/checks/language/bash/unread-arguments.ts';
import { getDirectories } from '#cli/checks/general/structure/folder-names.ts';
import { manifestPolicy } from '#cli/checks/general/dependencies/manifests.ts';
import { singleFileFolder } from '#cli/checks/general/structure/lone-files.ts';
import { migrationDocs } from '#cli/checks/database/postgres/migration-docs.ts';
import { readmeShape, readmePresent } from '#cli/checks/general/docs/readme.ts';
import { stringFiles, assetFolders } from '#cli/checks/tool/xcode/resources.ts';
import { unusedFunctions } from '#cli/checks/language/bash/unused-functions.ts';
import { checkVerifiedSecrets } from '#cli/checks/general/secrets/trufflehog.ts';
import { nextjsBuild, nextjsTypes } from '#cli/checks/framework/nextjs/build.ts';
import { trivialFunction } from '#cli/checks/language/bash/trivial-functions.ts';
import { foreignKeyIndexes } from '#cli/checks/database/postgres/foreign-keys.ts';
import { siteBuilds, buildReproducible } from '#cli/checks/general/site/build.ts';
import { lockfileFresh } from '#cli/checks/general/dependencies/lockfile/fresh.ts';
import { lockfileHosts } from '#cli/checks/general/dependencies/lockfile/hosts.ts';
import { allowlistsMatch } from '#cli/checks/general/structure/stale-allowlists.ts';
import { gitleaksBaseline } from '#cli/checks/general/secrets/gitleaks/baseline.ts';
import { checkSecretHistory } from '#cli/checks/general/secrets/gitleaks/history.ts';
import { duplicateFunctions } from '#cli/checks/language/bash/duplicate-functions.ts';
import { prefixCollisions } from '#cli/checks/general/structure/prefix-collisions.ts';
import { scriptGuards, scriptConfigDefaults } from '#cli/checks/language/bash/guards.ts';
import { checkJavascript, checkTypescript } from '#cli/checks/language/javascript/tsc.ts';
import { fileDirectoryCollision } from '#cli/checks/general/structure/stem-collisions.ts';
import type { Engine, Executable, CheckRegistry } from '#cli/types/execution/execution.ts';
import { noSleep, disabledTests, recordingMode } from '#cli/checks/tool/xctest/sources.ts';
import { migrationOrder, migrationsFrozen } from '#cli/checks/database/postgres/history.ts';
import { trackedDependencies } from '#cli/checks/general/structure/tracked-dependencies.ts';
import { privatePrefix, privateBeforePublic } from '#cli/checks/language/bash/visibility.ts';
import { testPlans, orphanSources, projectSymlinks } from '#cli/checks/tool/xcode/project.ts';
import { scriptSourceOrder, scriptSourceComments } from '#cli/checks/language/bash/sources.ts';
import { rlsPresent, explicitGrants, definerSearchPath } from '#cli/checks/database/postgres/access.ts';
import { projectValid, migrationNames, storagePolicies } from '#cli/checks/platform/supabase/project.ts';
import { xcconfigLines, transportSecurity, entitlementsPolicy } from '#cli/checks/tool/xcode/settings.ts';
import { deadAssets, webManifest, svgCompressed, securityHeaders } from '#cli/checks/general/site/source.ts';
import { routeSegments, dependencyAlignment, nextjsConfiguration } from '#cli/checks/framework/nextjs/source.ts';

import {
    sizeLimits,
    brokenLinks,
    builtMarkup,
    deadSelectors,
    sitemapMatches,
} from '#cli/checks/general/site/output.ts';

/** The engine of each check gspot analyses itself, by check ID. */
export const ENGINES: Record<string, Engine> = {
    'trpc/boundaries': trpcBoundaries,
    'react-native/expo-doctor': expoDoctor,
    'svelte/check': svelteCheck,
    'i18n/locales': localeFiles,
    'css/module-classes': cssModuleUsage,
    'ansible/lint': ansibleLint,
    'nginx/test': nginxTest,
    'jest/coverage': jestCoverage,
    'gspot/drift': generatedDrift,
    'structure/config-logic': fileIntegrity,
    'structure/suppressions': suppressions,
    'structure/stale-allowlists': allowlistsMatch,
    'structure/large-files': largeFiles,
    'structure/tracked-dependencies': trackedDependencies,
    'typescript/tsconfig': tsconfigOptions,
    'javascript/rules-off': requiredRules,
    'docs/headings': docsHeadings,
    'docs/stale-paths': stalePaths,
    'docs/readme-present': readmePresent,
    'docs/readme-shape': readmeShape,
    'markdown/fences': fences,
    'duplication/jscpd': copiedBlocks,
    'files/env-example': envExample,
    'secrets/env-files': envFiles,
    'security/codeql': codeql,
    'secrets/gitleaks-baseline': gitleaksBaseline,
    'dependencies/manifests': manifestPolicy,
    'dependencies/lockfile-fresh': lockfileFresh,
    'licenses/packages': licensesPackages,
    'dependencies/install': installPolicy,
    'dependencies/lockfile-hosts': lockfileHosts,
    ...DRIZZLE_ANALYSES,
    'nextjs/route-segments': routeSegments,
    'nextjs/config': nextjsConfiguration,
    'nextjs/tsc': nextjsTypes,
    'nextjs/build': nextjsBuild,
    'nextjs/version-pairs': dependencyAlignment,
    ...CLOUDFLARE_ANALYSES,
    'site/build': siteBuilds,
    'site/build-reproducible': buildReproducible,
    'site/html-validate': builtMarkup,
    'site/purgecss': deadSelectors,
    'site/linkinator': (input) => brokenLinks(input, false),
    'site/linkinator-external': (input) => brokenLinks(input, true),
    'site/size': sizeLimits,
    'site/sitemap': sitemapMatches,
    'site/dead-assets': deadAssets,
    'site/svgo': svgCompressed,
    'site/webmanifest': webManifest,
    'site/security-headers': securityHeaders,
    ...HTML_ANALYSES,
    ...PYTHON_ANALYSES,
    'xctest/disabled': disabledTests,
    'xctest/sleep': noSleep,
    'xctest/recording': recordingMode,
    'xctest/references': referenceOwners,
    'xctest/coverage': testCoverage,
    'xcode/xcconfig': xcconfigLines,
    'xcode/entitlements': entitlementsPolicy,
    'xcode/ats': transportSecurity,
    'xcode/xcstrings': stringFiles,
    'xcode/assets': assetFolders,
    'xcode/test-plans': testPlans,
    'xcode/orphan-sources': orphanSources,
    'xcode/symlinks': projectSymlinks,
    ...SWIFT_ANALYSES,
    'express/untested-routes': routesTested,
    'openapi/spectral': openapiLint,
    'openapi/fresh': openapiFresh,
    'supabase/config': projectValid,
    'supabase/storage-policies': storagePolicies,
    'supabase/migration-names': migrationNames,
    'supabase/deno-lint': denoLint,
    'supabase/deno-check': denoCheck,
    'supabase/admin-key': adminKey,
    'supabase/types-fresh': typesFresh,
    'postgres/rls': rlsPresent,
    'postgres/grants': explicitGrants,
    'postgres/definer-search-path': definerSearchPath,
    'postgres/foreign-key-indexes': foreignKeyIndexes,
    'postgres/migration-order': migrationOrder,
    'postgres/migrations-frozen': migrationsFrozen,
    'postgres/migration-docs': migrationDocs,
    ...SQL_ANALYSES,
    'docker/dockerignore': dockerignore,
    'docker/trivy-image': trivyImage,
    'structure/lone-files': structureEngine(singleFileFolder),
    'structure/prefix-collisions': structureEngine(prefixCollisions),
    'structure/stem-collisions': structureEngine(fileDirectoryCollision),
    'structure/folder-names': structureEngine(getDirectories),
    'bash/limits': structureEngine(bashLimits),
    'bash/doc-comments': structureEngine(docComment),
    'bash/duplicate-functions': structureEngine(duplicateFunctions),
    'bash/unused-functions': structureEngine(unusedFunctions),
    'bash/unread-arguments': structureEngine(deadParameters),
    'bash/private-prefix': structureEngine(privatePrefix),
    'bash/private-before-public': structureEngine(privateBeforePublic),
    'bash/trivial-functions': structureEngine(trivialFunction),
    'bash/env-owner': structureEngine(envAccessOwner),
    'bash/contract': structureEngine(scriptInterpreter),
    'bash/wrappers': structureEngine(scriptPolicy),
    'bash/embeds': structureEngine(scriptInline),
    'bash/ssh-blocks': structureEngine(scriptRemote),
    'bash/defaults': structureEngine(scriptConfigDefaults),
    'bash/guards': structureEngine(scriptGuards),
    'bash/boundaries': structureEngine(scriptBoundaries),
    'bash/safety': structureEngine(scriptSafety),
    'bash/source-comments': structureEngine(scriptSourceComments),
    'bash/source-order': structureEngine(scriptSourceOrder),
    'prose/vale': valeFindings,
    'prose/hidden': banned,
    ...NAMING_ENGINES,
};

/** The checks that run their own tool and read its output, by check ID. */
export const RUNNERS: Record<string, Executable['run']> = {
    'secrets/trufflehog': checkVerifiedSecrets,
    'secrets/gitleaks-history': checkSecretHistory,
    'commits/commitlint-range': checkCommitMessages,
    'vue/tsc': checkTypescript,
    'typescript/tsc': checkTypescript,
    'javascript/tsc': checkJavascript,
    'swift/swiftlint': checkSwiftlint,
    'python/pydoclint': checkDocstrings,
    'python/deptry': checkDependencies,
    'actions/actionlint': checkActions,
};

/** The registry the check command hands to the run. */
export const CHECKS: CheckRegistry = { engines: ENGINES, runners: RUNNERS };
