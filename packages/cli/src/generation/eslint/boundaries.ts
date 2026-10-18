import { joinScope } from '#cli/repository/scopes.ts';
import { escapeGlob } from '#cli/repository/matchers.ts';
import { buildNodePatterns, buildSourcePattern } from '#cli/generation/eslint/files.ts';

import type {
    EslintBlock,
    EslintContext,
    EslintBoundaryPolicy,
    EslintBoundaryContext,
} from '#cli/types/generation/eslint.ts';
import {
    CODE_LANGUAGES,
    TRPC_CONFIGURATION,
    TEST_IMPORT_POLICY,
    OTHER_BOUNDARY_FILE,
    IMPORT_RULE_CATEGORY,
    TRPC_SERVER_CATEGORY,
    TRPC_DEPENDENCY_NODES,
    UNKNOWN_IMPORT_POLICIES,
    TRPC_SERVER_VALUE_POLICY,
    TRPC_DEPENDENCY_SELECTORS,
} from '#cli/config/generation/eslint.ts';

// Your import rules precede the fixed test and server-value restrictions. A rule allows its own files, the files of
// every rule above it, and the rules in can_also_import.
function buildDependencyPolicies({
    importRules,
    enforceTests,
    tests,
    trpcPaths,
}: EslintBoundaryContext): EslintBoundaryPolicy[] {
    const policies: EslintBoundaryPolicy[] = importRules.map((rule, index) => ({
        from: { file: { categories: `${IMPORT_RULE_CATEGORY}${rule.name}` } },
        allow: {
            to: {
                file: {
                    categories: {
                        anyOf: [
                            ...importRules.slice(0, index).map(({ name }) => name),
                            rule.name,
                            ...rule.can_also_import,
                        ].map((name) => `${IMPORT_RULE_CATEGORY}${name}`),
                    },
                },
            },
        },
    }));
    if (trpcPaths.length > 0 || enforceTests)
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
    tests,
    trpcPaths,
    serverFiles,
}: EslintBoundaryContext): NonNullable<EslintBlock['settings']> {
    const files: { category: string; pattern: string[]; stopMatching?: boolean }[] = importRules.map((rule) => ({
        category: `${IMPORT_RULE_CATEGORY}${rule.name}`,
        pattern: rule.paths,
    }));
    if (serverFiles.length > 0) files.push({ category: TRPC_SERVER_CATEGORY, pattern: serverFiles });
    if (enforceTests) {
        files.unshift({ category: 'tests', pattern: tests, stopMatching: true });
        files.push({ ...OTHER_BOUNDARY_FILE, pattern: [...OTHER_BOUNDARY_FILE.pattern] });
    }
    const settings: NonNullable<EslintBlock['settings']> = {
        'boundaries/files': files,
        'boundaries/ignore': trpcPaths.length > 0 || enforceTests ? [] : tests,
    };
    if (trpcPaths.length > 0 || enforceTests)
        Object.assign(settings, {
            'boundaries/elements': [{ type: 'other', pattern: '**', partialMatch: false }],
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
export function buildBoundaryBlocks(
    context: Pick<EslintContext, 'repositorySettings' | 'scopes' | 'nodeFiles'>,
): EslintBlock[] {
    const { repositorySettings: settings, scopes, nodeFiles } = context;
    const importRules = settings.import_rule;
    const javascriptScopes = scopes.filter(({ selected }) =>
        selected.some(
            ({ configuration }) => configuration.name === 'javascript' || configuration.name === 'typescript',
        ),
    );
    const enforceTests = settings.level === 'all' && javascriptScopes.length > 0;
    const trpcScopes = scopes.filter(({ selected }) =>
        selected.some(({ configuration }) => configuration.name === TRPC_CONFIGURATION),
    );
    const serverFiles = [...new Set(trpcScopes.flatMap(({ view }) => view.values.trpc?.server_files ?? []))];
    // Other files of a tRPC scope import the server files only as types.
    const trpcPaths =
        serverFiles.length === 0 ? [] : trpcScopes.map(({ scope }) => joinScope(escapeGlob(scope.path), '**/*'));
    if (importRules.length === 0 && !enforceTests && trpcPaths.length === 0) return [];
    const tests = [...new Set(javascriptScopes.flatMap(({ view }) => view.test_files))];
    const input = { importRules, tests, enforceTests, trpcPaths, serverFiles };
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
                        checkInternals: trpcPaths.length > 0 || enforceTests,
                    },
                ],
            },
        },
    ];
}
