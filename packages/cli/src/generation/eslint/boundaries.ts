import { TRPC_CONFIGURATION } from '#cli/config/configurations.ts';
import { listAllowedRules, formatRefusedImport } from '#cli/settings/import-rules.ts';
import { buildScopeGlob, buildNodePatterns, buildSourcePattern } from '#cli/generation/eslint/files.ts';

import type {
    EslintBlock,
    EslintContext,
    EslintBoundaryPolicy,
    EslintBoundaryContext,
} from '#cli/types/generation/eslint.ts';
import {
    TEMPLATE_OPEN,
    CODE_LANGUAGES,
    TEST_IMPORT_POLICY,
    OTHER_BOUNDARY_FILE,
    IMPORT_RULE_CATEGORY,
    TRPC_SERVER_CATEGORY,
    TRPC_DEPENDENCY_NODES,
    TEMPLATE_OPEN_ESCAPED,
    TEST_BOUNDARY_CATEGORY,
    OTHER_BOUNDARY_ELEMENTS,
    UNKNOWN_IMPORT_POLICIES,
    BOUNDARY_OWNER_TEMPLATE,
    TRPC_SERVER_VALUE_POLICY,
    BOUNDARY_SOURCE_TEMPLATE,
    TRPC_DEPENDENCY_SELECTORS,
} from '#cli/config/generation/eslint.ts';

// Your import rules precede the fixed test and server-value restrictions. The last policy that matches decides. Each
// rule first refuses every file, with a message that names what it may import. Then it allows the rules from
// listAllowedRules.
function buildDependencyPolicies({
    importRules,
    enforceTests,
    hasFixedPolicies,
    tests,
    trpcPaths,
}: EslintBoundaryContext): EslintBoundaryPolicy[] {
    const policies: EslintBoundaryPolicy[] = importRules.flatMap((rule, index) => {
        const from = { file: { categories: `${IMPORT_RULE_CATEGORY}${rule.name}` } };
        const allowed = listAllowedRules(importRules, index);
        const message = formatRefusedImport(
            allowed.map((name) => name.replaceAll(TEMPLATE_OPEN, TEMPLATE_OPEN_ESCAPED)),
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

// Test files win over module categories. The elements also cover unknown endpoints.
function buildBoundarySettings({
    importRules,
    enforceTests,
    hasFixedPolicies,
    tests,
    serverFiles,
}: EslintBoundaryContext): NonNullable<EslintBlock['settings']> {
    const files: { category: string; pattern: readonly string[]; stopMatching?: boolean }[] = importRules.map(
        (rule) => ({
            category: `${IMPORT_RULE_CATEGORY}${rule.name}`,
            pattern: rule.paths,
        }),
    );
    if (serverFiles.length > 0) files.push({ category: TRPC_SERVER_CATEGORY, pattern: serverFiles });
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
            'boundaries/dependency-nodes': TRPC_DEPENDENCY_NODES,
            'boundaries/additional-dependency-nodes': TRPC_DEPENDENCY_SELECTORS,
        });
    return settings;
}

/**
 * Build one boundary block from the root modules and the project tests.
 *
 * @param context the scopes, level, and Node script paths to cover.
 *
 * @returns one classification block and its ordered dependency policies.
 */
export function buildBoundaryBlocks(context: Pick<EslintContext, 'session' | 'nodeFiles'>): EslintBlock[] {
    const {
        session: {
            settingsFile: { settings },
            scopes,
        },
        nodeFiles,
    } = context;
    const importRules = settings.import_rule;
    const codeLanguages: readonly string[] = CODE_LANGUAGES;
    const javascriptScopes = scopes.filter(({ selected }) =>
        selected.some(({ configuration }) => codeLanguages.includes(configuration.name)),
    );
    const enforceTests = settings.level === 'all' && javascriptScopes.length > 0;
    const trpcScopes = scopes.filter(({ selected }) =>
        selected.some(({ configuration }) => configuration.name === TRPC_CONFIGURATION),
    );
    const serverFiles = [...new Set(trpcScopes.flatMap(({ view }) => view.values.trpc?.server_files ?? []))];
    // Other files of a tRPC scope import the server files only as types.
    const trpcPaths = serverFiles.length === 0 ? [] : trpcScopes.map(({ scope }) => buildScopeGlob(scope.path, '**/*'));
    if (importRules.length === 0 && !enforceTests && trpcPaths.length === 0) return [];
    const tests = [...new Set(javascriptScopes.flatMap(({ view }) => view.test_files))];
    const hasFixedPolicies = trpcPaths.length > 0 || enforceTests;
    const input = { importRules, tests, enforceTests, hasFixedPolicies, trpcPaths, serverFiles };
    return [
        {
            files: [buildSourcePattern(...CODE_LANGUAGES), ...buildNodePatterns(nodeFiles, '')],
            settings: buildBoundarySettings(input),
            rules: {
                'boundaries/dependencies': [
                    'error',
                    {
                        default: importRules.length > 0 ? 'disallow' : 'allow',
                        policies: buildDependencyPolicies(input),
                        checkInternals: hasFixedPolicies,
                    },
                ],
            },
        },
    ];
}
