// Every check gspot runs itself, keyed by check ID: the analyses of the kits, and the checks that drive their own tool.
import { drift } from '#cli/checks/drift.ts';
import { lint } from '#cli/checks/tool/ansible.ts';
import { locales } from '#cli/checks/library/i18n.ts';
import { test } from '#cli/checks/tool/nginx/test.ts';
import { jestCoverage } from '#cli/checks/tool/jest.ts';
import { actionlint } from '#cli/checks/tool/actions.ts';
import { boundaries } from '#cli/checks/library/trpc.ts';
import { vale } from '#cli/checks/general/prose/vale.ts';
import { envExample } from '#cli/checks/general/files.ts';
import { fences } from '#cli/checks/language/markdown.ts';
import { SQL_ANALYSES } from '#cli/checks/language/sql.ts';
import { moduleClasses } from '#cli/checks/language/css.ts';
import { HTML_ANALYSES } from '#cli/checks/language/html.ts';
import { banned } from '#cli/checks/general/prose/hidden.ts';
import { embeds } from '#cli/checks/language/bash/embeds.ts';
import { safety } from '#cli/checks/language/bash/safety.ts';
import { sshBlocks } from '#cli/checks/language/bash/ssh.ts';
import { ANALYSES } from '#cli/checks/platform/cloudflare.ts';
import { fresh, spectral } from '#cli/checks/tool/openapi.ts';
import { svelteCheck } from '#cli/checks/framework/svelte.ts';
import { coverage } from '#cli/checks/tool/xctest/coverage.ts';
import { codeql } from '#cli/checks/general/security/codeql.ts';
import { headings } from '#cli/checks/general/docs/headings.ts';
import { bashLimits } from '#cli/checks/language/bash/limits.ts';
import { commitlintRange } from '#cli/checks/general/commits.ts';
import { contract } from '#cli/checks/language/bash/contract.ts';
import { wrappers } from '#cli/checks/language/bash/wrappers.ts';
import { DRIZZLE_ANALYSES } from '#cli/checks/library/drizzle.ts';
import { copiedBlocks } from '#cli/checks/general/duplication.ts';
import { envOwner } from '#cli/checks/language/bash/env-owner.ts';
import { untestedRoutes } from '#cli/checks/framework/express.ts';
import { expoDoctor } from '#cli/checks/framework/react-native.ts';
import { licensesPackages } from '#cli/checks/general/licenses.ts';
import { references } from '#cli/checks/tool/xctest/references.ts';
import { envFiles } from '#cli/checks/general/secrets/env-files.ts';
import { swiftlint } from '#cli/checks/language/swift/swiftlint.ts';
import { trivyImage } from '#cli/checks/tool/docker/trivy-image.ts';
import { build, types } from '#cli/checks/framework/nextjs/build.ts';
import { stalePaths } from '#cli/checks/general/docs/stale-paths.ts';
import { tsconfigOptions } from '#cli/checks/language/typescript.ts';
import { adminKey } from '#cli/checks/platform/supabase/admin-key.ts';
import { tsc, checkjs } from '#cli/checks/language/javascript/tsc.ts';
import { docComment } from '#cli/checks/language/bash/doc-comments.ts';
import { dockerignore } from '#cli/checks/tool/docker/dockerignore.ts';
import { guards, defaults } from '#cli/checks/language/bash/guards.ts';
import { trufflehog } from '#cli/checks/general/secrets/trufflehog.ts';
import { assets, xcstrings } from '#cli/checks/tool/xcode/resources.ts';
import { check, denoLint } from '#cli/checks/platform/supabase/deno.ts';
import { loneFiles } from '#cli/checks/general/structure/lone-files.ts';
import { SWIFT_ANALYSES } from '#cli/checks/language/swift/structure.ts';
import { checkDependencies } from '#cli/checks/language/python/deptry.ts';
import { largeFiles } from '#cli/checks/general/structure/large-files.ts';
import { typesFresh } from '#cli/checks/platform/supabase/types-fresh.ts';
import { NAMING_ENGINES } from '#cli/checks/general/naming/identifiers.ts';
import { PYTHON_ANALYSES } from '#cli/checks/language/python/structure.ts';
import { checkDocstrings } from '#cli/checks/language/python/pydoclint.ts';
import { scriptBoundaries } from '#cli/checks/language/bash/boundaries.ts';
import { structureEngine } from '#cli/checks/general/structure/context.ts';
import { installPolicy } from '#cli/checks/general/dependencies/install.ts';
import { moduleLogic } from '#cli/checks/general/structure/config-logic.ts';
import { requiredRules } from '#cli/checks/language/javascript/rules-off.ts';
import { suppressions } from '#cli/checks/general/structure/suppressions.ts';
import { getDirectories } from '#cli/checks/general/structure/folder-names.ts';
import { manifestPolicy } from '#cli/checks/general/dependencies/manifests.ts';
import { migrationDocs } from '#cli/checks/database/postgres/migration-docs.ts';
import { readmeShape, readmePresent } from '#cli/checks/general/docs/readme.ts';
import { unreadArguments } from '#cli/checks/language/bash/unread-arguments.ts';
import { unusedFunctions } from '#cli/checks/language/bash/unused-functions.ts';
import { ats, xcconfig, entitlements } from '#cli/checks/tool/xcode/settings.ts';
import { sleeps, disabled, recording } from '#cli/checks/tool/xctest/sources.ts';
import { foreignKeyIndexes } from '#cli/checks/database/postgres/foreign-keys.ts';
import { gitleaksHistory } from '#cli/checks/general/secrets/gitleaks/history.ts';
import { siteBuilds, buildReproducible } from '#cli/checks/general/site/build.ts';
import { stemCollisions } from '#cli/checks/general/structure/stem-collisions.ts';
import { trivialFunctions } from '#cli/checks/language/bash/trivial-functions.ts';
import { lockfileFresh } from '#cli/checks/general/dependencies/lockfile/fresh.ts';
import { lockfileHosts } from '#cli/checks/general/dependencies/lockfile/hosts.ts';
import { sourceOrder, sourceComments } from '#cli/checks/language/bash/sources.ts';
import { gitleaksBaseline } from '#cli/checks/general/secrets/gitleaks/baseline.ts';
import { staleAllowlists } from '#cli/checks/general/structure/stale-allowlists.ts';
import { duplicateFunctions } from '#cli/checks/language/bash/duplicate-functions.ts';
import { prefixCollisions } from '#cli/checks/general/structure/prefix-collisions.ts';
import { symlinks, testPlans, orphanSources } from '#cli/checks/tool/xcode/project.ts';
import { rls, grants, definerSearchPath } from '#cli/checks/database/postgres/access.ts';
import type { Engine, Executable, CheckRegistry } from '#cli/types/execution/execution.ts';
import { migrationOrder, migrationsFrozen } from '#cli/checks/database/postgres/history.ts';
import { trackedDependencies } from '#cli/checks/general/structure/tracked-dependencies.ts';
import { privatePrefix, privateBeforePublic } from '#cli/checks/language/bash/visibility.ts';
import { nextOptions, versionPairs, routeSegments } from '#cli/checks/framework/nextjs/source.ts';
import { svgo, deadAssets, webManifest, securityHeaders } from '#cli/checks/general/site/source.ts';
import { projectValid, migrationNames, storagePolicies } from '#cli/checks/platform/supabase/project.ts';
import { sizes, sitemap, brokenLinks, htmlValidate, deadSelectors } from '#cli/checks/general/site/output.ts';

/** The engine of each check gspot analyses itself, by check ID. */
export const ENGINES: Record<string, Engine> = {
    'trpc/boundaries': boundaries,
    'react-native/expo-doctor': expoDoctor,
    'svelte/check': svelteCheck,
    'i18n/locales': locales,
    'css/module-classes': moduleClasses,
    'ansible/lint': lint,
    'nginx/test': test,
    'jest/coverage': jestCoverage,
    'gspot/drift': drift,
    'structure/config-logic': moduleLogic,
    'structure/suppressions': suppressions,
    'structure/stale-allowlists': staleAllowlists,
    'structure/large-files': largeFiles,
    'structure/tracked-dependencies': trackedDependencies,
    'typescript/tsconfig': tsconfigOptions,
    'javascript/rules-off': requiredRules,
    'docs/headings': headings,
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
    'nextjs/config': nextOptions,
    'nextjs/tsc': types,
    'nextjs/build': build,
    'nextjs/version-pairs': versionPairs,
    ...ANALYSES,
    'site/build': siteBuilds,
    'site/build-reproducible': buildReproducible,
    'site/html-validate': htmlValidate,
    'site/purgecss': deadSelectors,
    'site/linkinator': (input) => brokenLinks(input, false),
    'site/linkinator-external': (input) => brokenLinks(input, true),
    'site/size': sizes,
    'site/sitemap': sitemap,
    'site/dead-assets': deadAssets,
    'site/svgo': svgo,
    'site/webmanifest': webManifest,
    'site/security-headers': securityHeaders,
    ...HTML_ANALYSES,
    ...PYTHON_ANALYSES,
    'xctest/disabled': disabled,
    'xctest/sleep': sleeps,
    'xctest/recording': recording,
    'xctest/references': references,
    'xctest/coverage': coverage,
    'xcode/xcconfig': xcconfig,
    'xcode/entitlements': entitlements,
    'xcode/ats': ats,
    'xcode/xcstrings': xcstrings,
    'xcode/assets': assets,
    'xcode/test-plans': testPlans,
    'xcode/orphan-sources': orphanSources,
    'xcode/symlinks': symlinks,
    ...SWIFT_ANALYSES,
    'express/untested-routes': untestedRoutes,
    'openapi/spectral': spectral,
    'openapi/fresh': fresh,
    'supabase/config': projectValid,
    'supabase/storage-policies': storagePolicies,
    'supabase/migration-names': migrationNames,
    'supabase/deno-lint': denoLint,
    'supabase/deno-check': check,
    'supabase/admin-key': adminKey,
    'supabase/types-fresh': typesFresh,
    'postgres/rls': rls,
    'postgres/grants': grants,
    'postgres/definer-search-path': definerSearchPath,
    'postgres/foreign-key-indexes': foreignKeyIndexes,
    'postgres/migration-order': migrationOrder,
    'postgres/migrations-frozen': migrationsFrozen,
    'postgres/migration-docs': migrationDocs,
    ...SQL_ANALYSES,
    'docker/dockerignore': dockerignore,
    'docker/trivy-image': trivyImage,
    'structure/lone-files': structureEngine(loneFiles),
    'structure/prefix-collisions': structureEngine(prefixCollisions),
    'structure/stem-collisions': structureEngine(stemCollisions),
    'structure/folder-names': structureEngine(getDirectories),
    'bash/limits': structureEngine(bashLimits),
    'bash/doc-comments': structureEngine(docComment),
    'bash/duplicate-functions': structureEngine(duplicateFunctions),
    'bash/unused-functions': structureEngine(unusedFunctions),
    'bash/unread-arguments': structureEngine(unreadArguments),
    'bash/private-prefix': structureEngine(privatePrefix),
    'bash/private-before-public': structureEngine(privateBeforePublic),
    'bash/trivial-functions': structureEngine(trivialFunctions),
    'bash/env-owner': structureEngine(envOwner),
    'bash/contract': structureEngine(contract),
    'bash/wrappers': structureEngine(wrappers),
    'bash/embeds': structureEngine(embeds),
    'bash/ssh-blocks': structureEngine(sshBlocks),
    'bash/defaults': structureEngine(defaults),
    'bash/guards': structureEngine(guards),
    'bash/boundaries': structureEngine(scriptBoundaries),
    'bash/safety': structureEngine(safety),
    'bash/source-comments': structureEngine(sourceComments),
    'bash/source-order': structureEngine(sourceOrder),
    'prose/vale': vale,
    'prose/hidden': banned,
    ...NAMING_ENGINES,
};

/** The checks that run their own tool and read its output, by check ID. */
export const RUNNERS: Record<string, Executable['run']> = {
    'secrets/trufflehog': trufflehog,
    'secrets/gitleaks-history': gitleaksHistory,
    'commits/commitlint-range': commitlintRange,
    'vue/tsc': tsc,
    'typescript/tsc': tsc,
    'javascript/tsc': checkjs,
    'swift/swiftlint': swiftlint,
    'python/pydoclint': checkDocstrings,
    'python/deptry': checkDependencies,
    'actions/actionlint': actionlint,
};

/** The registry the check command hands to the run. */
export const CHECKS: CheckRegistry = { engines: ENGINES, runners: RUNNERS };
