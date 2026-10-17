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
    TRPC_SERVER_MODULE,
    TEST_IMPORT_POLICY,
    OTHER_BOUNDARY_FILE,
    TRPC_DEPENDENCY_NODES,
    UNKNOWN_IMPORT_POLICIES,
    TRPC_SERVER_VALUE_POLICY,
    TRPC_DEPENDENCY_SELECTORS,
} from '#cli/config/generation/eslint.ts';

// Your module edges precede the fixed test and server-value restrictions.
function buildDependencyPolicies({
    modules,
    enforceTests,
    tests,
    trpcPaths,
}: EslintBoundaryContext): EslintBoundaryPolicy[] {
    const policies: EslintBoundaryPolicy[] = modules.map((module, index) => ({
        from: { file: { categories: `module:${module.name}` } },
        allow: {
            to: {
                file: {
                    categories: {
                        anyOf: [
                            ...modules.slice(0, index).map(({ name }) => name),
                            module.name,
                            ...module.may_import,
                        ].map((name) => `module:${name}`),
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
        const outsideModules = { categories: { noneOf: modules.map(({ name }) => `module:${name}`) } };
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
    modules,
    enforceTests,
    tests,
    trpcPaths,
}: EslintBoundaryContext): NonNullable<EslintBlock['settings']> {
    const files: { category: string; pattern: string[]; stopMatching?: boolean }[] = modules.map((module) => ({
        category: `module:${module.name}`,
        pattern: module.paths,
    }));
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
    const modules = scopes
        .filter(({ scope }) => scope.path === '')
        .flatMap(({ view }) => view.values.architecture?.module ?? []);
    const javascriptScopes = scopes.filter(({ selected }) =>
        selected.some(
            ({ configuration }) => configuration.name === 'javascript' || configuration.name === 'typescript',
        ),
    );
    const enforceTests = settings.level === 'all' && javascriptScopes.length > 0;
    if (modules.length === 0 && !enforceTests) return [];
    const tests = [...new Set(javascriptScopes.flatMap(({ view }) => view.test_files))];
    const trpcPaths = modules.some(({ name }) => name === TRPC_SERVER_MODULE)
        ? scopes
              .filter(({ selected }) => selected.some(({ configuration }) => configuration.name === TRPC_CONFIGURATION))
              .map(({ scope }) => joinScope(escapeGlob(scope.path), '**/*'))
        : [];
    const input = { modules, tests, enforceTests, trpcPaths };
    return [
        {
            files: [buildSourcePattern(...CODE_LANGUAGES), ...buildNodePatterns(nodeFiles, '')],
            settings: buildBoundarySettings(input),
            rules: {
                'boundaries/dependencies': [
                    'error',
                    {
                        default: modules.length > 0 ? 'disallow' : 'allow',
                        policies: buildDependencyPolicies(input),
                        checkInternals: trpcPaths.length > 0 || enforceTests,
                    },
                ],
            },
        },
    ];
}
