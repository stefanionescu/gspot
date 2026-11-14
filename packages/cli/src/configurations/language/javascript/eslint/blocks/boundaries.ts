import { joinScopeGlob } from '#cli/repository/scopes.ts';
import { TRPC_CONFIGURATION } from '#cli/config/settings/detected.ts';
import { IMPORT_RULE_CATEGORY } from '#cli/config/configurations/shared.ts';
import { listAllowedRules, formatRefusedImport } from '#cli/configurations/import-rules.ts';

import {
    listExternals,
    listCodePatterns,
    listJavascriptScopes,
} from '#cli/configurations/language/javascript/sources.ts';
import type {
    EslintBlock,
    ScopeBoundaries,
    PlannedEslintFile,
    EslintBoundaryPolicy,
} from '#cli/types/configurations/javascript.ts';
import {
    TEMPLATE_OPEN,
    TEST_IMPORT_POLICY,
    OTHER_BOUNDARY_FILE,
    TRPC_SERVER_CATEGORY,
    TEMPLATE_OPEN_ESCAPED,
    TEST_BOUNDARY_CATEGORY,
    BOUNDARY_OWNER_TEMPLATE,
    OTHER_BOUNDARY_ELEMENTS,
    UNKNOWN_IMPORT_POLICIES,
    BOUNDARY_SOURCE_TEMPLATE,
    TRPC_SERVER_VALUE_POLICY,
    BOUNDARY_DEPENDENCY_NODES,
    BOUNDARY_DEPENDENCY_SELECTORS,
} from '#cli/config/configurations/javascript/blocks.ts';

function buildDependencyPolicies({
    importRules,
    enforceTests,
    hasFixedPolicies,
    tests,
    trpcPaths,
    externals,
}: ScopeBoundaries): EslintBoundaryPolicy[] {
    const policies: EslintBoundaryPolicy[] = importRules.flatMap((rule, index) => {
        const from = { file: { categories: `${IMPORT_RULE_CATEGORY}${rule.name}` } };
        const allowed = listAllowedRules(importRules, index);
        const message = formatRefusedImport(
            allowed.map((name) => name.replaceAll(TEMPLATE_OPEN, () => TEMPLATE_OPEN_ESCAPED)),
            BOUNDARY_SOURCE_TEMPLATE,
            BOUNDARY_OWNER_TEMPLATE,
        );
        return [
            { from, disallow: { to: { file: { path: '**/*' } } }, message },
            {
                from,
                allow: {
                    to: { file: { categories: { anyOf: allowed.map((name) => `${IMPORT_RULE_CATEGORY}${name}`) } } },
                },
            },
        ];
    });
    // The last policy that matches an import decides. A specifier of javascript.externals passes the import rules
    // above, and the test file and tRPC policies below still apply to it.
    if (externals.length > 0) policies.push({ allow: { dependency: { source: externals } } });
    if (hasFixedPolicies)
        policies.push(
            ...UNKNOWN_IMPORT_POLICIES,
            { from: { file: { path: tests } }, allow: { to: { file: { path: '**/*' } } } },
            { allow: { to: { file: { path: tests } } } },
        );
    if (enforceTests) {
        const outsideModules = {
            categories: { noneOf: importRules.map(({ name }) => `${IMPORT_RULE_CATEGORY}${name}`) },
        };
        policies.push(
            { from: { file: outsideModules }, allow: { to: { file: { path: '**/*' } } } },
            { allow: { to: { file: outsideModules } } },
            TEST_IMPORT_POLICY,
        );
    }
    if (trpcPaths.length > 0)
        policies.push({
            ...TRPC_SERVER_VALUE_POLICY,
            disallow: {
                ...TRPC_SERVER_VALUE_POLICY.disallow,
                to: { file: { ...TRPC_SERVER_VALUE_POLICY.disallow.to.file, path: trpcPaths } },
            },
        });
    return policies;
}

function buildBoundarySettings({
    importRules,
    enforceTests,
    hasFixedPolicies,
    tests,
    serverFiles,
}: ScopeBoundaries): NonNullable<EslintBlock['settings']> {
    const files: Array<{ category: string; pattern: readonly string[]; stopMatching?: boolean }> = importRules.map(
        (rule) => ({
            category: `${IMPORT_RULE_CATEGORY}${rule.name}`,
            pattern: rule.paths,
            stopMatching: true,
        }),
    );
    if (serverFiles.length > 0) files.unshift({ category: TRPC_SERVER_CATEGORY, pattern: serverFiles });
    if (enforceTests) {
        files.unshift({ category: TEST_BOUNDARY_CATEGORY, pattern: tests, stopMatching: true });
        files.push(OTHER_BOUNDARY_FILE);
    }
    const settings: NonNullable<EslintBlock['settings']> = {
        'boundaries/files': files,
        'boundaries/ignore': hasFixedPolicies ? [] : tests,
    };
    if (hasFixedPolicies)
        Object.assign(settings, {
            'boundaries/elements': OTHER_BOUNDARY_ELEMENTS,
            'boundaries/dependency-nodes': BOUNDARY_DEPENDENCY_NODES,
            'boundaries/additional-dependency-nodes': BOUNDARY_DEPENDENCY_SELECTORS,
        });
    return settings;
}

export function buildBoundaryBlocks(planned: Pick<PlannedEslintFile, 'session' | 'eslintFiles'>): EslintBlock[] {
    const { session, eslintFiles } = planned;
    const { settings, scopes } = session;
    const importRules = settings.import_rule;
    const javascriptScopes = listJavascriptScopes(scopes);
    const isEnforceTests = settings.level === 'all' && javascriptScopes.length > 0;
    const trpcScopes = scopes.filter(({ configurations }) =>
        configurations.some((configuration) => configuration.name === TRPC_CONFIGURATION),
    );
    const serverFiles = [
        ...new Set(trpcScopes.flatMap(({ settings: scopeSettings }) => scopeSettings.tables.trpc?.server_files ?? [])),
    ];
    const trpcPaths = serverFiles.length === 0 ? [] : trpcScopes.map(({ path }) => joinScopeGlob(path, '**/*'));
    if (!isEnforceTests && importRules.length === 0 && trpcPaths.length === 0) return [];
    const tests = listCodePatterns([
        ...new Set(javascriptScopes.flatMap(({ settings: scopeSettings }) => scopeSettings.test_files)),
    ]);
    const hasFixedPolicies = trpcPaths.length > 0 || isEnforceTests;
    const externals = listExternals(javascriptScopes);
    const boundaries = {
        importRules,
        tests,
        enforceTests: isEnforceTests,
        hasFixedPolicies,
        trpcPaths,
        serverFiles,
        externals,
    };
    return [
        {
            files: eslintFiles.code,
            settings: buildBoundarySettings(boundaries),
            rules: {
                'boundaries/dependencies': [
                    'error',
                    {
                        default: importRules.length > 0 ? 'disallow' : 'allow',
                        policies: buildDependencyPolicies(boundaries),
                        checkInternals: hasFixedPolicies,
                    },
                ],
            },
        },
    ];
}
