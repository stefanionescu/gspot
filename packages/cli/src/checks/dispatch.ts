import { cssModuleUsage } from '#cli/checks/css.ts';
import { fences } from '#cli/checks/docs/fences.ts';
import { svelteCheck } from '#cli/checks/svelte.ts';
import { ansibleLint } from '#cli/checks/ansible.ts';
import { localeFiles } from '#cli/checks/locales.ts';
import { trpcBoundaries } from '#cli/checks/trpc.ts';
import { jestCoverage } from '#cli/checks/jest/run.ts';
import { codeql } from '#cli/checks/security/codeql.ts';
import { expoDoctor } from '#cli/checks/react-native.ts';
import type { Engine } from '#cli/types/checks/checks.ts';
import { licensesPackages } from '#cli/checks/licenses.ts';
import { docsHeadings } from '#cli/checks/docs/headings.ts';
import { htmlCopy, htmlScripts } from '#cli/checks/html.ts';
import { adminKey } from '#cli/checks/supabase/admin-key.ts';
import { envFiles } from '#cli/checks/security/env/files.ts';
import { nginxTest } from '#cli/checks/nginx/config-test.ts';
import { routesTested } from '#cli/checks/express/routes.ts';
import { stalePaths } from '#cli/checks/docs/stale-paths.ts';
import type { CheckSpec } from '#cli/types/configurations.ts';
import { testCoverage } from '#cli/checks/xctest/coverage.ts';
import { trivyImage } from '#cli/checks/docker/image-scan.ts';
import { readmeShape } from '#cli/checks/docs/readme/shape.ts';
import { SWIFT_STRUCTURE } from '#cli/checks/swift/analyses.ts';
import { copiedBlocks } from '#cli/checks/docs/copied-blocks.ts';
import { dockerignore } from '#cli/checks/docker/ignore-file.ts';
import { envExample } from '#cli/checks/security/env/example.ts';
import { typesFresh } from '#cli/checks/supabase/types-fresh.ts';
import { PYTHON_STRUCTURE } from '#cli/checks/python/analyses.ts';
import { denoCheck, denoLint } from '#cli/checks/supabase/deno.ts';
import { largeFiles } from '#cli/checks/repository/large-files.ts';
import { readmePresent } from '#cli/checks/docs/readme/present.ts';
import { referenceOwners } from '#cli/checks/xctest/references.ts';
import { taskPolicy } from '#cli/checks/repository/task-policy.ts';
import { suppressions } from '#cli/checks/repository/suppressions.ts';
import { migrationDocs } from '#cli/checks/postgres/migration-docs.ts';
import { nextjsBuild, nextjsTypes } from '#cli/checks/nextjs/build.ts';
import { requiredRules } from '#cli/checks/typescript/required-rules.ts';
import { assetFolders, stringFiles } from '#cli/checks/xcode/resources.ts';
import { generatedDrift } from '#cli/checks/repository/generated-drift.ts';
import { installPolicy } from '#cli/checks/dependencies/install-policy.ts';
import { lockfileFresh } from '#cli/checks/dependencies/lockfile/fresh.ts';
import { lockfileHosts } from '#cli/checks/dependencies/lockfile/hosts.ts';
import { openapiFresh, openapiLint } from '#cli/checks/express/openapi.ts';
import { pythonBlockingCalls } from '#cli/checks/python/blocking-calls.ts';
import { allowlistsMatch } from '#cli/checks/repository/allowlists-match.ts';
import { drizzleMigrations, drizzleRelations } from '#cli/checks/drizzle.ts';
import { gitleaksBaseline } from '#cli/checks/security/gitleaks-baseline.ts';
import { manifestPolicy } from '#cli/checks/dependencies/manifest-policy.ts';
import { tsconfigOptions } from '#cli/checks/typescript/tsconfig-options.ts';
import { configurationPurity } from '#cli/checks/repository/config-purity.ts';
import { buildReproducible, siteBuilds } from '#cli/checks/static-site/build.ts';
import { migrationOrder, migrationsFrozen } from '#cli/checks/postgres/history.ts';
import { trackedDependencies } from '#cli/checks/repository/tracked-dependencies.ts';
import { swiftAnalyze, swiftBuild, swiftPeriphery } from '#cli/checks/swift/build.ts';
import { orphanSources, projectSymlinks, testPlans } from '#cli/checks/xcode/project.ts';
import { disabledTests, noSleep, recordingMode } from '#cli/checks/xctest/line-checks.ts';
import { sqlBlockComments, sqlFileLength, sqlSyntax, sqlFunctions } from '#cli/checks/sql.ts';
import { projectValid, migrationNames, storagePolicies } from '#cli/checks/supabase/config-checks.ts';
import { dependencyAlignment, nextjsConfiguration, routeSegments } from '#cli/checks/nextjs/source.ts';
import { dependencyOwnership, importLinter, typecheckMembership } from '#cli/checks/python/project.ts';
import { envTypesFresh, headersSyntax, redirectsSyntax, wranglerFile } from '#cli/checks/cloudflare.ts';
import { entitlementsPolicy, transportSecurity, xcconfigLines } from '#cli/checks/xcode/settings-files.ts';
import { deadAssets, securityHeaders, svgCompressed, webManifest } from '#cli/checks/static-site/source-checks.ts';

import {
    definerSearchPath,
    explicitGrants,
    foreignKeyIndexes,
    rlsPresent,
} from '#cli/checks/postgres/schema/checks.ts';
import {
    builtMarkup,
    deadSelectors,
    externalLinks,
    internalLinks,
    sitemapMatches,
    sizeLimits,
} from '#cli/checks/static-site/output-checks.ts';

const checks: Record<string, Engine> = {
    'generated-drift': generatedDrift,
    'tsconfig-options': tsconfigOptions,
    'docs-headings': docsHeadings,
    'stale-paths': stalePaths,
    'readme-present': readmePresent,
    'readme-shape': readmeShape,
    fences,
    'env-example': envExample,
    'config-purity': configurationPurity,
    suppressions,
    'allowlists-match': allowlistsMatch,
    'task-policy': taskPolicy,
    'large-files': largeFiles,
    'tracked-dependencies': trackedDependencies,
    'env-files': envFiles,
    'manifest-policy': manifestPolicy,
    'lockfile-fresh': lockfileFresh,
    'licenses-packages': licensesPackages,
    'trpc-boundaries': trpcBoundaries,
    'drizzle-relations': drizzleRelations,
    'drizzle-migrations': drizzleMigrations,
    'next-route-segments': routeSegments,
    'next-config': nextjsConfiguration,
    'next-types': nextjsTypes,
    'next-build': nextjsBuild,
    'expo-doctor': expoDoctor,
    'svelte-check': svelteCheck,
    'required-rules': requiredRules,
    'dependency-alignment': dependencyAlignment,
    'locale-files': localeFiles,
    'cloudflare-headers': headersSyntax,
    'cloudflare-redirects': redirectsSyntax,
    'cloudflare-wrangler': wranglerFile,
    'cloudflare-env-types': envTypesFresh,
    'site-build': siteBuilds,
    'site-build-reproducible': buildReproducible,
    'site-built-markup': builtMarkup,
    'site-dead-selectors': deadSelectors,
    'site-links-internal': internalLinks,
    'site-links-external': externalLinks,
    'site-size': sizeLimits,
    'site-sitemap': sitemapMatches,
    'site-dead-assets': deadAssets,
    'site-svg': svgCompressed,
    'site-webmanifest': webManifest,
    'site-security-headers': securityHeaders,
    'html-scripts': htmlScripts,
    'html-copy': htmlCopy,
    'css-module-usage': cssModuleUsage,
    ...PYTHON_STRUCTURE,
    ...SWIFT_STRUCTURE,
    'python-import-linter': importLinter,
    'python-blocking-calls': pythonBlockingCalls,
    'python-dependency-ownership': dependencyOwnership,
    'python-typecheck-membership': typecheckMembership,
    'copied-blocks': copiedBlocks,
    'xctest-disabled': disabledTests,
    'xctest-sleep': noSleep,
    'xctest-recording': recordingMode,
    'xctest-references': referenceOwners,
    'xctest-coverage': testCoverage,
    'xcode-xcconfig': xcconfigLines,
    'xcode-entitlements': entitlementsPolicy,
    'xcode-ats': transportSecurity,
    'xcode-xcstrings': stringFiles,
    'xcode-assets': assetFolders,
    'xcode-test-plans': testPlans,
    'xcode-orphan-sources': orphanSources,
    'xcode-symlinks': projectSymlinks,
    'swift-build': swiftBuild,
    'swift-analyze': swiftAnalyze,
    'swift-periphery': swiftPeriphery,
    'ansible-lint': ansibleLint,
    'openapi-lint': openapiLint,
    'openapi-fresh': openapiFresh,
    'routes-tested': routesTested,
    'supabase-config': projectValid,
    'supabase-storage': storagePolicies,
    'supabase-migration-names': migrationNames,
    'supabase-deno-lint': denoLint,
    'supabase-deno-check': denoCheck,
    'supabase-admin-key': adminKey,
    'supabase-types': typesFresh,
    'postgres-rls': rlsPresent,
    'postgres-grants': explicitGrants,
    'postgres-definer': definerSearchPath,
    'postgres-foreign-keys': foreignKeyIndexes,
    'postgres-order': migrationOrder,
    'postgres-frozen': migrationsFrozen,
    'postgres-docs': migrationDocs,
    'sql-functions': sqlFunctions,
    'sql-syntax': sqlSyntax,
    'sql-block-comments': sqlBlockComments,
    'sql-file-length': sqlFileLength,
    'nginx-test': nginxTest,
    dockerignore,
    'trivy-image': trivyImage,
    'install-policy': installPolicy,
    'lockfile-hosts': lockfileHosts,
    codeql,
    'jest-coverage': jestCoverage,
    'gitleaks-baseline': gitleaksBaseline,
};

/**
 * Resolve the declared integrity analysis before executing any checks.
 * @param spec the check
 * @returns the engine that runs the analysis
 */
export function resolveIntegrity(spec: CheckSpec): Engine {
    const name = spec.analysis ?? spec.name.slice(spec.name.indexOf('/') + 1);
    const check = checks[name];
    if (!check) throw new Error(`No integrity analysis is called ${name}.`);
    return check;
}
