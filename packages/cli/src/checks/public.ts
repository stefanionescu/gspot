import { fences } from '#cli/checks/language/markdown.ts';
import { ansibleLint } from '#cli/checks/tool/ansible.ts';
import { expoDoctor } from '#cli/checks/framework/expo.ts';
import { vale, jscpd } from '#cli/checks/general/public.ts';
import { moduleClasses } from '#cli/checks/language/css.ts';
import { embeds } from '#cli/checks/language/bash/embeds.ts';
import { safety } from '#cli/checks/language/bash/safety.ts';
import { sshBlocks } from '#cli/checks/language/bash/ssh.ts';
import { locales } from '#cli/checks/library/translations.ts';
import { runBuiltInCheck } from '#cli/execution/contracts.ts';
import { svelteCheck } from '#cli/checks/framework/contracts.ts';
import { contract } from '#cli/checks/language/bash/contract.ts';
import { wrappers } from '#cli/checks/language/bash/wrappers.ts';
import { commitlintPushed } from '#cli/checks/general/commits.ts';
import { codeql, semgrep } from '#cli/checks/general/security.ts';
import { licensesPackages } from '#cli/checks/general/licenses.ts';
import { sourceOrder } from '#cli/checks/language/bash/sources.ts';
import { nginxTest, actionlint } from '#cli/checks/tool/public.ts';
import { shellcheck } from '#cli/checks/language/bash/shellcheck.ts';
import { generatedCode } from '#cli/checks/general/generated-code.ts';
import { envOwner } from '#cli/checks/general/structure/env-owner.ts';
import { suppressions } from '#cli/checks/general/structure/public.ts';
import { migrationDocs } from '#cli/checks/database/postgres/public.ts';
import { fileLines } from '#cli/checks/general/structure/file-lines.ts';
import { loneFiles } from '#cli/checks/general/structure/lone-files.ts';
import { docComments } from '#cli/checks/language/bash/doc-comments.ts';
import { privatePrefix } from '#cli/checks/language/bash/visibility.ts';
import { manifests } from '#cli/checks/general/dependencies/manifests.ts';
import { versionPairs } from '#cli/checks/general/dependencies/public.ts';
import { folderNames } from '#cli/checks/general/structure/folder-names.ts';
import { largeFiles, trackedFiles } from '#cli/checks/general/repository.ts';
import { relations as drizzleRelations } from '#cli/checks/library/drizzle.ts';
import { compose, trivyImage, dockerignore } from '#cli/checks/tool/docker.ts';
import { testPlacement } from '#cli/checks/general/structure/test-placement.ts';
import { unreadArguments } from '#cli/checks/language/bash/unread-arguments.ts';
import { unusedFunctions } from '#cli/checks/language/bash/unused-functions.ts';
import { ats, xcconfig, entitlements } from '#cli/checks/tool/xcode/settings.ts';
import { foreignKeyIndexes } from '#cli/checks/database/postgres/foreign-keys.ts';
import { importComments } from '#cli/checks/general/structure/import-comments.ts';
import { stemCollisions } from '#cli/checks/general/structure/stem-collisions.ts';
import { lockfileFresh } from '#cli/checks/general/dependencies/lockfile/fresh.ts';
import { lockfileHosts } from '#cli/checks/general/dependencies/lockfile/hosts.ts';
import { configurationLogic } from '#cli/checks/general/structure/config-logic.ts';
import { guards, bashVariableDefaults } from '#cli/checks/language/bash/guards.ts';
import { tsc, checkjs, tsconfig, pydoclint } from '#cli/checks/language/public.ts';
import { bunReleaseAge } from '#cli/checks/general/dependencies/bun-release-age.ts';
import { prefixCollisions } from '#cli/checks/general/structure/prefix-collisions.ts';
import { trivialFunctions } from '#cli/checks/general/structure/trivial-functions.ts';
import { trivialFunctions as sqlTrivialFunctions } from '#cli/checks/language/sql.ts';
import { recording, references } from '#cli/checks/library/swift-snapshot-testing.ts';
import { symlinks, testPlans, orphanSources } from '#cli/checks/tool/xcode/project.ts';
import { rls, grants, definerSearchPath } from '#cli/checks/database/postgres/access.ts';
import { trufflehog, envTemplate, gitleaksPushed } from '#cli/checks/general/secrets.ts';
import { singletons as pythonSingletons } from '#cli/checks/language/python/singletons.ts';
import { migrationOrder, migrationsFrozen } from '#cli/checks/database/postgres/history.ts';
import { importLinter as pythonImportLinter } from '#cli/checks/language/python/imports.ts';
import { privateBeforePublic } from '#cli/checks/general/structure/private-before-public.ts';
import { functionSize as bashFunctionSize } from '#cli/checks/language/bash/function-size.ts';
import type { CheckResult, BuiltInCheck, BuiltInChecks } from '#cli/types/execution/check.ts';
import { headings, stalePaths, readmeShape, requiredFiles } from '#cli/checks/general/docs.ts';
import { lazyExports as pythonLazyExports } from '#cli/checks/language/python/lazy-exports.ts';
import { scripts as htmlScripts, literals as htmlLiterals } from '#cli/checks/language/html.ts';
import { xcstrings, orphanAssets, contentsFindings } from '#cli/checks/tool/xcode/resources.ts';
import { deptry, pipInstalls as pythonPipInstalls } from '#cli/checks/language/python/deptry.ts';
import { functionSize as pythonFunctionSize } from '#cli/checks/language/python/function-size.ts';
import { NEXT_VERSION_PAIRS, REACT_VERSION_PAIRS } from '#cli/config/checks/general/dependencies.ts';
import { swiftBuild, swiftPeriphery, swiftlintAnalyze } from '#cli/checks/language/swift/contracts.ts';
import { nextBuild, nextjsTsc, routeSegments, nextConfiguration } from '#cli/checks/framework/public.ts';
import { namingPaths, namingPolicy, namingIdentifiers } from '#cli/checks/general/naming/identifiers.ts';
import { sitemap, purgecss, siteSize, linkinator, htmlValidate } from '#cli/checks/general/site/public.ts';
import { swiftTestsSleep, swiftTestsCoverage, swiftTestsSkipReasons } from '#cli/checks/tool/contracts.ts';
import { placeholderDocstrings as pythonPlaceholderDocstrings } from '#cli/checks/language/python/functions.ts';
import { gspotDrift, unmatchedPaths, fixPolicyLayout, gspotPolicyLayout } from '#cli/checks/general/contracts.ts';
import { svgo, siteBuild, deadAssets, webManifest, buildReproducible } from '#cli/checks/general/site/contracts.ts';

import {
    denoLint,
    denoCheck,
    projectFile,
    serviceRoleKey,
    migrationNames,
    storagePolicies,
} from '#cli/checks/platform/public.ts';
import {
    securityHeaders,
    headers as cloudflareHeaders,
    wrangler as cloudflareWrangler,
    redirects as cloudflareRedirects,
} from '#cli/checks/platform/cloudflare.ts';
import {
    exportOrder as pythonExportOrder,
    privatePrefix as pythonPrivatePrefix,
    packageExports as pythonPackageExports,
    exportsAtBottom as pythonExportsAtBottom,
} from '#cli/checks/language/python/exports.ts';

/** Native input calculations, keyed by their check IDs. */
export const BUILT_IN_CALCULATIONS = {
    'expo/doctor': expoDoctor,
    'svelte/svelte-check': svelteCheck,
    'translations/locales': locales,
    'css/module-classes': moduleClasses,
    'ansible/ansible-lint': ansibleLint,
    'nginx/config-test': nginxTest,
    'structure/private-before-public': privateBeforePublic,
    'structure/import-comments': importComments,
    'structure/trivial-functions': trivialFunctions,
    'structure/env-owner': envOwner,
    'structure/file-lines': fileLines,
    'structure/config-logic': configurationLogic,
    'gspot/suppressions': suppressions,
    'repository/large-files': largeFiles,
    'typescript/tsconfig': tsconfig,
    'docs/headings': headings,
    'docs/stale-paths': stalePaths,
    'docs/required-files': requiredFiles,
    'docs/readme-shape': readmeShape,
    'markdown/fences': fences,
    'duplication/jscpd': jscpd,
    'secrets/env-template': envTemplate,
    'repository/tracked-files': trackedFiles,
    'security/codeql': codeql,
    'dependencies/package-json': manifests,
    'dependencies/stale-lockfile': lockfileFresh,
    'licenses/allowed': licensesPackages,
    'dependencies/bun-release-age': bunReleaseAge,
    'dependencies/lockfile-hosts': lockfileHosts,
    'drizzle/relations': drizzleRelations,
    'drizzle/stale-migrations': generatedCode,
    'nextjs/route-segments': routeSegments,
    'nextjs/next-config': nextConfiguration,
    'nextjs/build': nextBuild,
    'nextjs/version-pairs': (input) => versionPairs(input, NEXT_VERSION_PAIRS),
    'react/version-pairs': (input) => versionPairs(input, REACT_VERSION_PAIRS),
    'cloudflare/headers': cloudflareHeaders,
    'cloudflare/redirects': cloudflareRedirects,
    'cloudflare/wrangler': cloudflareWrangler,
    'cloudflare/stale-types': generatedCode,
    'site/build': siteBuild,
    'site/build-reproducible': buildReproducible,
    'site/html-validate': htmlValidate,
    'site/purgecss': purgecss,
    'site/linkinator': (input) => linkinator(input, false),
    'site/linkinator-external': (input) => linkinator(input, true),
    'site/size': siteSize,
    'site/sitemap': sitemap,
    'site/dead-assets': deadAssets,
    'site/svgo': svgo,
    'site/webmanifest': webManifest,
    'cloudflare/security-headers': securityHeaders,
    'html/scripts': htmlScripts,
    'html/template-text': htmlLiterals,
    'python/function-size': pythonFunctionSize,
    'python/placeholder-docstrings': pythonPlaceholderDocstrings,
    'python/private-prefix': pythonPrivatePrefix,
    'python/exports-at-bottom': pythonExportsAtBottom,
    'python/lazy-exports': pythonLazyExports,
    'python/package-exports': pythonPackageExports,
    'python/export-order': pythonExportOrder,
    'python/singletons': pythonSingletons,
    'python/import-linter': pythonImportLinter,
    'python/pip-installs': pythonPipInstalls,
    'swift-tests/skip-reasons': swiftTestsSkipReasons,
    'swift-tests/sleep': swiftTestsSleep,
    'swift-snapshot-testing/recording': recording,
    'swift-snapshot-testing/references': references,
    'swift-tests/coverage': swiftTestsCoverage,
    'xcode/xcconfig': xcconfig,
    'xcode/entitlements': entitlements,
    'xcode/ats': ats,
    'xcode/xcstrings': xcstrings,
    'xcode/assets': contentsFindings,
    'xcode/orphan-assets': orphanAssets,
    'xcode/test-plans': testPlans,
    'xcode/orphan-sources': orphanSources,
    'xcode/symlinks': symlinks,
    'swift/build': swiftBuild,
    'swift/swiftlint-analyze': swiftlintAnalyze,
    'swift/periphery': swiftPeriphery,
    'openapi/stale-document': generatedCode,
    'supabase/project-file': projectFile,
    'supabase/storage-policies': storagePolicies,
    'supabase/migration-names': migrationNames,
    'supabase/deno-lint': denoLint,
    'supabase/deno-check': denoCheck,
    'supabase/service-role-key': serviceRoleKey,
    'supabase/stale-types': generatedCode,
    'postgres/rls': rls,
    'postgres/grants': grants,
    'postgres/definer-search-path': definerSearchPath,
    'postgres/foreign-key-indexes': foreignKeyIndexes,
    'postgres/migration-order': migrationOrder,
    'postgres/migrations-frozen': migrationsFrozen,
    'postgres/migration-docs': migrationDocs,
    'sql/trivial-functions': sqlTrivialFunctions,
    'docker/dockerignore': dockerignore,
    'docker/trivy-image': trivyImage,
    'structure/lone-files': loneFiles,
    'structure/prefix-collisions': prefixCollisions,
    'structure/stem-collisions': stemCollisions,
    'structure/folder-names': folderNames,
    'structure/test-placement': testPlacement,
    'bash/function-size': bashFunctionSize,
    'bash/doc-comments': docComments,
    'bash/unused-functions': unusedFunctions,
    'bash/unread-arguments': unreadArguments,
    'bash/private-prefix': privatePrefix,
    'bash/contract': contract,
    'bash/wrappers': wrappers,
    'bash/embeds': embeds,
    'bash/ssh-blocks': sshBlocks,
    'bash/variable-defaults': bashVariableDefaults,
    'bash/guards': guards,
    'bash/safety': safety,
    'bash/source-order': sourceOrder,
    'prose/vale': vale,
    'naming/identifiers': namingIdentifiers,
    'naming/paths': namingPaths,
    'naming/policy': namingPolicy,
} satisfies Record<string, BuiltInCheck>;

/** Every execution callback, keyed by its check ID. */
export const BUILT_IN_CHECKS = {
    ...Object.fromEntries(
        Object.entries(BUILT_IN_CALCULATIONS).map(([name, input]): [string, BuiltInChecks[string]] => [
            name,
            { run: runBuiltInCheck(input) },
        ]),
    ),
    'gspot/drift': { run: gspotDrift },
    'gspot/policy-layout': { run: gspotPolicyLayout, fix: fixPolicyLayout },
    'gspot/unmatched-paths': {
        run: (session, planned, options): Promise<CheckResult> =>
            runBuiltInCheck((input) => unmatchedPaths(input, session, BUILT_IN_CALCULATIONS))(
                session,
                planned,
                options,
            ),
    },
    'security/semgrep': { run: semgrep },
    'nextjs/tsc': { run: nextjsTsc },
    'docker/compose': { run: compose },
    'secrets/trufflehog': { run: trufflehog },
    'secrets/gitleaks-pushed': { run: gitleaksPushed },
    'commits/commitlint-pushed': { run: commitlintPushed },
    'vue/vue-tsc': { run: tsc },
    'typescript/tsc': { run: tsc },
    'javascript/tsc': { run: checkjs },
    'bash/shellcheck': { run: shellcheck },
    'python/pydoclint': { run: pydoclint },
    'python/deptry': { run: deptry },
    'github-actions/actionlint': { run: actionlint },
} satisfies BuiltInChecks;
