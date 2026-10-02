// Every check gspot runs itself, keyed by check ID: the analyses of the kits, and the checks that drive their own tool.
import type { Engine } from '#cli/types/checks.ts';
import { generatedDrift } from '#cli/checks/drift.ts';
import { jestCoverage } from '#cli/checks/tool/jest.ts';
import { ansibleLint } from '#cli/checks/tool/ansible.ts';
import { fences } from '#cli/checks/language/markdown.ts';
import { localeFiles } from '#cli/checks/library/i18n.ts';
import { SQL_ANALYSES } from '#cli/checks/language/sql.ts';
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
import type { Executable } from '#cli/types/execution/execution.ts';
import { checkActions } from '#cli/checks/general/files/actions.ts';
import { docsHeadings } from '#cli/checks/general/docs/headings.ts';
import { envFiles } from '#cli/checks/general/secrets/env-files.ts';
import { trivyImage } from '#cli/checks/tool/docker/trivy-image.ts';
import { checkCommitMessages } from '#cli/checks/general/commits.ts';
import { scriptPolicy } from '#cli/checks/language/bash/wrappers.ts';
import { stalePaths } from '#cli/checks/general/docs/stale-paths.ts';
import { tsconfigOptions } from '#cli/checks/language/typescript.ts';
import { adminKey } from '#cli/checks/platform/supabase/admin-key.ts';
import { envExample } from '#cli/checks/general/files/env-example.ts';
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
import { folderNames } from '#cli/checks/general/structure/folder-names.ts';
import { installPolicy } from '#cli/checks/general/dependencies/install.ts';
import { requiredRules } from '#cli/checks/language/javascript/rules-off.ts';
import { suppressions } from '#cli/checks/general/structure/suppressions.ts';
import { fileIntegrity } from '#cli/checks/general/structure/config-logic.ts';
import { deadParameters } from '#cli/checks/language/bash/unread-arguments.ts';
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
import { lockfileFresh } from '#cli/checks/general/dependencies/lockfile/fresh.ts';
import { lockfileHosts } from '#cli/checks/general/dependencies/lockfile/hosts.ts';
import { allowlistsMatch } from '#cli/checks/general/structure/stale-allowlists.ts';
import { gitleaksBaseline } from '#cli/checks/general/secrets/gitleaks/baseline.ts';
import { checkSecretHistory } from '#cli/checks/general/secrets/gitleaks/history.ts';
import { duplicateFunctions } from '#cli/checks/language/bash/duplicate-functions.ts';
import { prefixCollisions } from '#cli/checks/general/structure/prefix-collisions.ts';
import { scriptGuards, scriptConfigDefaults } from '#cli/checks/language/bash/guards.ts';
import { siteBuilds, buildReproducible } from '#cli/checks/general/static-site/build.ts';
import { checkJavascript, checkTypescript } from '#cli/checks/language/javascript/tsc.ts';
import { fileDirectoryCollision } from '#cli/checks/general/structure/stem-collisions.ts';
import { noSleep, disabledTests, recordingMode } from '#cli/checks/tool/xctest/sources.ts';
import { migrationOrder, migrationsFrozen } from '#cli/checks/database/postgres/history.ts';
import { trackedDependencies } from '#cli/checks/general/structure/tracked-dependencies.ts';
import { privatePrefix, privateBeforePublic } from '#cli/checks/language/bash/visibility.ts';
import { testPlans, orphanSources, projectSymlinks } from '#cli/checks/tool/xcode/project.ts';
import { scriptSourceOrder, scriptSourceComments } from '#cli/checks/language/bash/sources.ts';
import { rlsPresent, explicitGrants, definerSearchPath } from '#cli/checks/database/postgres/access.ts';
import { projectValid, migrationNames, storagePolicies } from '#cli/checks/platform/supabase/project.ts';
import { xcconfigLines, transportSecurity, entitlementsPolicy } from '#cli/checks/tool/xcode/settings.ts';
import { routeSegments, dependencyAlignment, nextjsConfiguration } from '#cli/checks/framework/nextjs/source.ts';
import { deadAssets, webManifest, svgCompressed, securityHeaders } from '#cli/checks/general/static-site/source.ts';

import {
    sizeLimits,
    builtMarkup,
    deadSelectors,
    externalLinks,
    internalLinks,
    sitemapMatches,
} from '#cli/checks/general/static-site/output.ts';

/** The engine of each check gspot analyses itself, by check ID. */
export const ENGINES: Record<string, Engine> = {
    'trpc/router-boundaries': trpcBoundaries,
    'react-native/expo-doctor': expoDoctor,
    'svelte/check': svelteCheck,
    'i18n/locales': localeFiles,
    'integrity/css-usage': cssModuleUsage,
    'ansible/lint': ansibleLint,
    'nginx/config-test': nginxTest,
    'jest/coverage': jestCoverage,
    'integrity/generated-drift': generatedDrift,
    'integrity/files': fileIntegrity,
    'integrity/suppressions': suppressions,
    'integrity/allowlists-match': allowlistsMatch,
    'integrity/large-files': largeFiles,
    'integrity/tracked-dependencies': trackedDependencies,
    'integrity/tsconfig-options': tsconfigOptions,
    'integrity/required-rules': requiredRules,
    'integrity/docs-headings': docsHeadings,
    'integrity/stale-paths': stalePaths,
    'docs/readme-present': readmePresent,
    'docs/readme-shape': readmeShape,
    'markdown/fences': fences,
    'duplication/jscpd': copiedBlocks,
    'files/env-example': envExample,
    'integrity/env-files': envFiles,
    'security/codeql': codeql,
    'integrity/gitleaks-baseline': gitleaksBaseline,
    'integrity/manifest-policy': manifestPolicy,
    'integrity/lockfile-fresh': lockfileFresh,
    'licenses/packages': licensesPackages,
    'integrity/install-policy': installPolicy,
    'integrity/lockfile-hosts': lockfileHosts,
    ...DRIZZLE_ANALYSES,
    'integrity/route-segments': routeSegments,
    'integrity/next-config': nextjsConfiguration,
    'nextjs/typecheck': nextjsTypes,
    'nextjs/build': nextjsBuild,
    'integrity/dependency-alignment': dependencyAlignment,
    ...CLOUDFLARE_ANALYSES,
    'static-site/build': siteBuilds,
    'static-site/build-reproducible': buildReproducible,
    'static-site/html-validate-built': builtMarkup,
    'css/dead-selectors': deadSelectors,
    'static-site/links-internal': internalLinks,
    'static-site/links-external': externalLinks,
    'static-site/size': sizeLimits,
    'static-site/sitemap': sitemapMatches,
    'static-site/dead-assets': deadAssets,
    'static-site/svg-optimized': svgCompressed,
    'static-site/webmanifest': webManifest,
    'integrity/security-headers': securityHeaders,
    ...HTML_ANALYSES,
    ...PYTHON_ANALYSES,
    'xctest/disabled': disabledTests,
    'xctest/no-sleep': noSleep,
    'xctest/recording': recordingMode,
    'xctest/reference-images': referenceOwners,
    'xctest/coverage': testCoverage,
    'xcode/xcconfig': xcconfigLines,
    'xcode/entitlements-policy': entitlementsPolicy,
    'xcode/ats': transportSecurity,
    'xcode/xcstrings': stringFiles,
    'xcode/asset-catalogs': assetFolders,
    'xcode/test-plan': testPlans,
    'xcode/orphan-sources': orphanSources,
    'xcode/symlinks': projectSymlinks,
    ...SWIFT_ANALYSES,
    'express/routes-tested': routesTested,
    'openapi/lint': openapiLint,
    'openapi/fresh': openapiFresh,
    'supabase/config': projectValid,
    'supabase/storage-policies': storagePolicies,
    'supabase/migration-names': migrationNames,
    'supabase/deno-lint': denoLint,
    'supabase/deno-check': denoCheck,
    'supabase/admin-key-containment': adminKey,
    'supabase/types-fresh': typesFresh,
    'postgres/rls-present': rlsPresent,
    'postgres/explicit-grants': explicitGrants,
    'postgres/security-definer-search-path': definerSearchPath,
    'postgres/index-covers-foreign-key': foreignKeyIndexes,
    'postgres/migration-order': migrationOrder,
    'postgres/migrations-frozen': migrationsFrozen,
    'postgres/migration-docs': migrationDocs,
    ...SQL_ANALYSES,
    'docker/dockerignore': dockerignore,
    'docker/trivy-image': trivyImage,
    'structure/single-file-folder': structureEngine(singleFileFolder),
    'structure/prefix-collisions': structureEngine(prefixCollisions),
    'structure/file-directory-collision': structureEngine(fileDirectoryCollision),
    'structure/folder-names': structureEngine(folderNames),
    'structure/bash-limits': structureEngine(bashLimits),
    'structure/doc-comment': structureEngine(docComment),
    'structure/duplicate-functions': structureEngine(duplicateFunctions),
    'structure/unused-functions': structureEngine(unusedFunctions),
    'structure/dead-parameters': structureEngine(deadParameters),
    'structure/private-prefix': structureEngine(privatePrefix),
    'structure/private-before-public': structureEngine(privateBeforePublic),
    'structure/trivial-function': structureEngine(trivialFunction),
    'structure/env-access-owner': structureEngine(envAccessOwner),
    'structure/bash-interpreter': structureEngine(scriptInterpreter),
    'structure/bash-script-policy': structureEngine(scriptPolicy),
    'structure/inline': structureEngine(scriptInline),
    'structure/remote': structureEngine(scriptRemote),
    'structure/bash-config-defaults': structureEngine(scriptConfigDefaults),
    'structure/guards': structureEngine(scriptGuards),
    'structure/bash-boundaries': structureEngine(scriptBoundaries),
    'structure/bash-safety': structureEngine(scriptSafety),
    'structure/source-comments': structureEngine(scriptSourceComments),
    'structure/source-order': structureEngine(scriptSourceOrder),
    'prose/vale': valeFindings,
    'prose/banned': banned,
    ...NAMING_ENGINES,
};

/** The checks that run their own tool and read its output, by check ID. */
export const RUNNERS: Record<string, Executable['run']> = {
    'secrets/trufflehog': checkVerifiedSecrets,
    'secrets/gitleaks': checkSecretHistory,
    'commits/range': checkCommitMessages,
    'vue/typecheck': checkTypescript,
    'typescript/tsc': checkTypescript,
    'javascript/checkjs': checkJavascript,
    'swift/swiftlint': checkSwiftlint,
    'python/pydoclint': checkDocstrings,
    'python/deptry': checkDependencies,
    'files/actions': checkActions,
};
