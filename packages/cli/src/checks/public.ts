import { fences } from '#cli/checks/language/markdown.ts';
import { ansibleLint } from '#cli/checks/tool/ansible.ts';
import { expoDoctor } from '#cli/checks/framework/expo.ts';
import { vale, jscpd } from '#cli/checks/general/public.ts';
import { moduleClasses } from '#cli/checks/language/css.ts';
import { embeds } from '#cli/checks/language/bash/embeds.ts';
import { safety } from '#cli/checks/language/bash/safety.ts';
import { sshBlocks } from '#cli/checks/language/bash/ssh.ts';
import { locales } from '#cli/checks/library/translations.ts';
import { largeFiles } from '#cli/checks/general/repository.ts';
import { svelteCheck } from '#cli/checks/framework/contracts.ts';
import { contract } from '#cli/checks/language/bash/contract.ts';
import { wrappers } from '#cli/checks/language/bash/wrappers.ts';
import { commitlintPushed } from '#cli/checks/general/commits.ts';
import { codeql, semgrep } from '#cli/checks/general/security.ts';
import { licensesPackages } from '#cli/checks/general/licenses.ts';
import { sourceOrder } from '#cli/checks/language/bash/sources.ts';
import { nginxTest, actionlint } from '#cli/checks/tool/public.ts';
import type { BuiltInChecks } from '#cli/types/execution/check.ts';
import { shellcheck } from '#cli/checks/language/bash/shellcheck.ts';
import { generatedCode } from '#cli/checks/general/generated-code.ts';
import { envOwner } from '#cli/checks/general/structure/env-owner.ts';
import { trivyImage, dockerignore } from '#cli/checks/tool/docker.ts';
import { suppressions } from '#cli/checks/general/structure/public.ts';
import { migrationDocs } from '#cli/checks/database/postgres/public.ts';
import { fileLines } from '#cli/checks/general/structure/file-lines.ts';
import { loneFiles } from '#cli/checks/general/structure/lone-files.ts';
import { docComments } from '#cli/checks/language/bash/doc-comments.ts';
import { privatePrefix } from '#cli/checks/language/bash/visibility.ts';
import { manifests } from '#cli/checks/general/dependencies/manifests.ts';
import { versionPairs } from '#cli/checks/general/dependencies/public.ts';
import { folderNames } from '#cli/checks/general/structure/folder-names.ts';
import { relations as drizzleRelations } from '#cli/checks/library/drizzle.ts';
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
import { singletons as pythonSingletons } from '#cli/checks/language/python/singletons.ts';
import { migrationOrder, migrationsFrozen } from '#cli/checks/database/postgres/history.ts';
import { trackedDependencies } from '#cli/checks/general/structure/tracked-dependencies.ts';
import { importLinter as pythonImportLinter } from '#cli/checks/language/python/imports.ts';
import { privateBeforePublic } from '#cli/checks/general/structure/private-before-public.ts';
import { functionSize as bashFunctionSize } from '#cli/checks/language/bash/function-size.ts';
import { headings, stalePaths, readmeShape, requiredFiles } from '#cli/checks/general/docs.ts';
import { lazyExports as pythonLazyExports } from '#cli/checks/language/python/lazy-exports.ts';
import { scripts as htmlScripts, literals as htmlLiterals } from '#cli/checks/language/html.ts';
import { xcstrings, orphanAssets, contentsFindings } from '#cli/checks/tool/xcode/resources.ts';
import { deptry, pipInstalls as pythonPipInstalls } from '#cli/checks/language/python/deptry.ts';
import { functionSize as pythonFunctionSize } from '#cli/checks/language/python/function-size.ts';
import { envFiles, trufflehog, envTemplate, gitleaksPushed } from '#cli/checks/general/secrets.ts';
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
    adminKey,
    denoLint,
    denoCheck,
    migrationNames,
    storagePolicies,
    supabaseConfiguration,
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

/** Every built-in implementation, keyed by its check ID. */
export const BUILT_IN_CHECKS = {
    'expo/doctor': { input: expoDoctor },
    'svelte/svelte-check': { input: svelteCheck },
    'translations/locales': { input: locales },
    'css/module-classes': { input: moduleClasses },
    'ansible/lint': { input: ansibleLint },
    'nginx/test': { input: nginxTest },
    'gspot/drift': { run: gspotDrift },
    'gspot/policy-layout': { run: gspotPolicyLayout, fix: fixPolicyLayout },
    'structure/private-before-public': { input: privateBeforePublic },
    'structure/import-comments': { input: importComments },
    'structure/trivial-functions': { input: trivialFunctions },
    'structure/env-owner': { input: envOwner },
    'structure/file-lines': { input: fileLines },
    'structure/config-logic': { input: configurationLogic },
    'gspot/suppressions': { input: suppressions },
    'gspot/unmatched-paths': { input: unmatchedPaths },
    'repository/large-files': { input: largeFiles },
    'structure/tracked-dependencies': { input: trackedDependencies },
    'typescript/tsconfig': { input: tsconfig },
    'docs/headings': { input: headings },
    'docs/stale-paths': { input: stalePaths },
    'docs/required-files': { input: requiredFiles },
    'docs/readme-shape': { input: readmeShape },
    'markdown/fences': { input: fences },
    'duplication/jscpd': { input: jscpd },
    'secrets/env-template': { input: envTemplate },
    'secrets/env-files': { input: envFiles },
    'security/codeql': { input: codeql },
    'security/semgrep': { run: semgrep },
    'dependencies/manifests': { input: manifests },
    'dependencies/stale-lockfile': { input: lockfileFresh },
    'licenses/packages': { input: licensesPackages },
    'dependencies/bun-release-age': { input: bunReleaseAge },
    'dependencies/lockfile-hosts': { input: lockfileHosts },
    'drizzle/relations': { input: drizzleRelations },
    'drizzle/stale-migrations': { input: generatedCode },
    'nextjs/route-segments': { input: routeSegments },
    'nextjs/next-config': { input: nextConfiguration },
    'nextjs/tsc': { run: nextjsTsc },
    'nextjs/build': { input: nextBuild },
    'nextjs/version-pairs': { input: (input) => versionPairs(input, NEXT_VERSION_PAIRS) },
    'react/version-pairs': { input: (input) => versionPairs(input, REACT_VERSION_PAIRS) },
    'cloudflare/headers': { input: cloudflareHeaders },
    'cloudflare/redirects': { input: cloudflareRedirects },
    'cloudflare/wrangler': { input: cloudflareWrangler },
    'cloudflare/stale-types': { input: generatedCode },
    'site/build': { input: siteBuild },
    'site/build-reproducible': { input: buildReproducible },
    'site/html-validate': { input: htmlValidate },
    'site/purgecss': { input: purgecss },
    'site/linkinator': { input: (input) => linkinator(input, false) },
    'site/linkinator-external': { input: (input) => linkinator(input, true) },
    'site/size': { input: siteSize },
    'site/sitemap': { input: sitemap },
    'site/dead-assets': { input: deadAssets },
    'site/svgo': { input: svgo },
    'site/webmanifest': { input: webManifest },
    'cloudflare/security-headers': { input: securityHeaders },
    'html/scripts': { input: htmlScripts },
    'html/template-text': { input: htmlLiterals },
    'python/function-size': { input: pythonFunctionSize },
    'python/placeholder-docstrings': { input: pythonPlaceholderDocstrings },
    'python/private-prefix': { input: pythonPrivatePrefix },
    'python/exports-at-bottom': { input: pythonExportsAtBottom },
    'python/lazy-exports': { input: pythonLazyExports },
    'python/package-exports': { input: pythonPackageExports },
    'python/export-order': { input: pythonExportOrder },
    'python/singletons': { input: pythonSingletons },
    'python/import-linter': { input: pythonImportLinter },
    'python/pip-installs': { input: pythonPipInstalls },
    'swift-tests/skip-reasons': { input: swiftTestsSkipReasons },
    'swift-tests/sleep': { input: swiftTestsSleep },
    'swift-snapshot-testing/recording': { input: recording },
    'swift-snapshot-testing/references': { input: references },
    'swift-tests/coverage': { input: swiftTestsCoverage },
    'xcode/xcconfig': { input: xcconfig },
    'xcode/entitlements': { input: entitlements },
    'xcode/ats': { input: ats },
    'xcode/xcstrings': { input: xcstrings },
    'xcode/assets': { input: contentsFindings },
    'xcode/orphan-assets': { input: orphanAssets },
    'xcode/test-plans': { input: testPlans },
    'xcode/orphan-sources': { input: orphanSources },
    'xcode/symlinks': { input: symlinks },
    'swift/build': { input: swiftBuild },
    'swift/swiftlint-analyze': { input: swiftlintAnalyze },
    'swift/periphery': { input: swiftPeriphery },
    'openapi/stale-document': { input: generatedCode },
    'supabase/project-file': { input: supabaseConfiguration },
    'supabase/storage-policies': { input: storagePolicies },
    'supabase/migration-names': { input: migrationNames },
    'supabase/deno-lint': { input: denoLint },
    'supabase/deno-check': { input: denoCheck },
    'supabase/service-role-key': { input: adminKey },
    'supabase/stale-types': { input: generatedCode },
    'postgres/rls': { input: rls },
    'postgres/grants': { input: grants },
    'postgres/definer-search-path': { input: definerSearchPath },
    'postgres/foreign-key-indexes': { input: foreignKeyIndexes },
    'postgres/migration-order': { input: migrationOrder },
    'postgres/migrations-frozen': { input: migrationsFrozen },
    'postgres/migration-docs': { input: migrationDocs },
    'sql/trivial-functions': { input: sqlTrivialFunctions },
    'docker/dockerignore': { input: dockerignore },
    'docker/trivy-image': { input: trivyImage },
    'structure/lone-files': { input: loneFiles },
    'structure/prefix-collisions': { input: prefixCollisions },
    'structure/stem-collisions': { input: stemCollisions },
    'structure/folder-names': { input: folderNames },
    'structure/test-placement': { input: testPlacement },
    'bash/function-size': { input: bashFunctionSize },
    'bash/doc-comments': { input: docComments },
    'bash/unused-functions': { input: unusedFunctions },
    'bash/unread-arguments': { input: unreadArguments },
    'bash/private-prefix': { input: privatePrefix },
    'bash/contract': { input: contract },
    'bash/wrappers': { input: wrappers },
    'bash/embeds': { input: embeds },
    'bash/ssh-blocks': { input: sshBlocks },
    'bash/variable-defaults': { input: bashVariableDefaults },
    'bash/guards': { input: guards },
    'bash/safety': { input: safety },
    'bash/source-order': { input: sourceOrder },
    'prose/vale': { input: vale },
    'naming/identifiers': { input: namingIdentifiers },
    'naming/paths': { input: namingPaths },
    'naming/policy': { input: namingPolicy },
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
