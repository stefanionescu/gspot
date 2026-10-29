import { escapeGlob } from '#cli/system/paths.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { TRPC_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { listAllowedRules, formatRefusedImport } from '#cli/settings/import-rules.ts';
import { listCodeTestFiles } from '#cli/generation/configurations/language/javascript/eslint/files.ts';
import { CODE_LANGUAGES } from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';

import type {
    EslintBlock,
    ScopeBoundaries,
    PlannedEslintFile,
    EslintBoundaryPolicy,
} from '#cli/types/generation/eslint.ts';
import {
    TEMPLATE_OPEN,
    TEST_IMPORT_POLICY,
    OTHER_BOUNDARY_FILE,
    IMPORT_RULE_CATEGORY,
    TRPC_SERVER_CATEGORY,
    TEMPLATE_OPEN_ESCAPED,
    TEST_BOUNDARY_CATEGORY,
    OTHER_BOUNDARY_ELEMENTS,
    UNKNOWN_IMPORT_POLICIES,
    BOUNDARY_OWNER_TEMPLATE,
    TRPC_SERVER_VALUE_POLICY,
    BOUNDARY_SOURCE_TEMPLATE,
    BOUNDARY_DEPENDENCY_NODES,
    BOUNDARY_DEPENDENCY_SELECTORS,
} from '#cli/config/generation/configurations/language/javascript/eslint/blocks/boundaries.ts';

function buildDependencyPolicies({
    importRules,
    enforceTests,
    hasFixedPolicies,
    tests,
    trpcPaths,
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
            'boundaries/dependency-nodes': BOUNDARY_DEPENDENCY_NODES,
            'boundaries/additional-dependency-nodes': BOUNDARY_DEPENDENCY_SELECTORS,
        });
    return settings;
}

/**
Build one boundary block from the root modules and the project tests.

@param planned the scopes and the files to cover.
@returns one classification block and its ordered dependency policies.
*/
export function buildBoundaryBlocks(planned: Pick<PlannedEslintFile, 'session' | 'eslintFiles'>): EslintBlock[] {
    const { session, eslintFiles } = planned;
    const { settings, scopes } = session;
    const importRules = settings.import_rule;
    const codeLanguages: readonly string[] = CODE_LANGUAGES;
    const javascriptScopes = scopes.filter(({ configurations }) =>
        configurations.some((configuration) => codeLanguages.includes(configuration.name)),
    );
    const isEnforceTests = settings.level === 'all' && javascriptScopes.length > 0;
    const trpcScopes = scopes.filter(({ configurations }) =>
        configurations.some((configuration) => configuration.name === TRPC_CONFIGURATION),
    );
    const serverFiles = [
        ...new Set(trpcScopes.flatMap(({ settings: scopeSettings }) => scopeSettings.tables.trpc?.server_files ?? [])),
    ];
    const trpcPaths = serverFiles.length === 0 ? [] : trpcScopes.map(({ path }) => joinScope(escapeGlob(path), '**/*'));
    if (!isEnforceTests && importRules.length === 0 && trpcPaths.length === 0) return [];
    const tests = listCodeTestFiles([
        ...new Set(javascriptScopes.flatMap(({ settings: scopeSettings }) => scopeSettings.test_files)),
    ]);
    const hasFixedPolicies = trpcPaths.length > 0 || isEnforceTests;
    const boundaries = { importRules, tests, enforceTests: isEnforceTests, hasFixedPolicies, trpcPaths, serverFiles };
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
