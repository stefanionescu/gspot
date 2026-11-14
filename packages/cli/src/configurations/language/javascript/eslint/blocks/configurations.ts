import { isDeepStrictEqual } from 'node:util';
import { joinTables } from '#cli/system/tables.ts';
import type { Scope } from '#cli/types/settings.ts';
import { findParentScope } from '#cli/settings/scopes.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { VUE_BLOCK_BUILDERS } from '#cli/configurations/framework/vue/generate.ts';
import { PLUGIN_RULE_BLOCKS } from '#cli/config/configurations/javascript/blocks.ts';
import { listCodePatterns } from '#cli/configurations/language/javascript/sources.ts';
import { listProjectDependencyNames } from '#cli/repository/projects/dependencies.ts';
import { ASTRO_BLOCK_BUILDERS } from '#cli/configurations/framework/astro/generate.ts';
import { VITEST_BLOCK_BUILDERS } from '#cli/configurations/testing/vitest/generate.ts';
import { NESTJS_BLOCK_BUILDERS } from '#cli/configurations/framework/nestjs/generate.ts';
import { NEXTJS_BLOCK_BUILDERS } from '#cli/configurations/framework/nextjs/generate.ts';
import { SVELTE_BLOCK_BUILDERS } from '#cli/configurations/framework/svelte/generate.ts';
import { buildTestFiles } from '#cli/configurations/language/javascript/eslint/files.ts';
import { DRIZZLE_BLOCK_BUILDERS } from '#cli/configurations/library/drizzle/generate.ts';
import { ZUSTAND_BLOCK_BUILDERS } from '#cli/configurations/library/zustand/generate.ts';
import { SUPABASE_BLOCK_BUILDERS } from '#cli/configurations/platform/supabase/generate.ts';
import { REACT_DOM_BLOCK_BUILDERS } from '#cli/configurations/framework/react-dom/generate.ts';
import { listNestedScopeGlobs } from '#cli/configurations/language/javascript/eslint/scopes.ts';
import { TYPESCRIPT_BLOCK_BUILDERS } from '#cli/configurations/language/typescript/generate.ts';
import { TESTING_LIBRARY_BLOCK_BUILDERS } from '#cli/configurations/library/testing-library/generate.ts';

import type {
    EslintScope,
    PluginRuleBlock,
    PlannedEslintFile,
    EslintBlockBuilder,
    PlannedEslintBlock,
    ConfigurationBlocks,
    ConfigurationScopeBlocks,
} from '#cli/types/configurations/javascript.ts';

const CONFIGURATION_BUILDERS = joinTables<EslintBlockBuilder>([
    Object.fromEntries(
        Object.entries(PLUGIN_RULE_BLOCKS).map(([name, declaration]) => [
            name,
            (scope: EslintScope) => buildPluginRuleBlocks(scope, declaration),
        ]),
    ),
    ASTRO_BLOCK_BUILDERS,
    DRIZZLE_BLOCK_BUILDERS,
    NESTJS_BLOCK_BUILDERS,
    NEXTJS_BLOCK_BUILDERS,
    REACT_DOM_BLOCK_BUILDERS,
    SUPABASE_BLOCK_BUILDERS,
    SVELTE_BLOCK_BUILDERS,
    TESTING_LIBRARY_BLOCK_BUILDERS,
    TYPESCRIPT_BLOCK_BUILDERS,
    VITEST_BLOCK_BUILDERS,
    VUE_BLOCK_BUILDERS,
    ZUSTAND_BLOCK_BUILDERS,
]);

function buildConfigurationBlocks(
    builder: EslintBlockBuilder,
    scope: Scope,
    planned: PlannedEslintFile,
): ConfigurationBlocks {
    const { session } = planned;
    const scopePath = scope.path;
    const testFiles = listCodePatterns(scope.settings.test_files).map((pattern) =>
        scopePath !== '' && pattern.startsWith(`${scopePath}/**/`) ? pattern.slice(scopePath.length + 1) : pattern,
    );
    return builder({
        level: planned.blockWriter.level,
        settings: scope.settings,
        projects: planned.projects,
        defaultProjectFiles: planned.defaultProjectFiles,
        path: scopePath,
        dependencyFiles: session.repository.dependencyFiles,
        dependencies: listProjectDependencyNames(session.repository.dependencyFiles, scopePath),
        eslintFiles: {
            ...planned.eslintFiles,
            tests: buildTestFiles(testFiles, planned.eslintFiles.code),
        },
        sourceFiles: session.repository.files.filter((file) => file.kind === 'source').map((file) => file.path),
    });
}

function listMatchingScopes(
    scopeBlocks: Array<{ path: string; blocks: ConfigurationBlocks }>,
    scopes: Scope[],
): Set<string> {
    return new Set(
        scopeBlocks
            .filter(({ path, blocks }) => {
                const parent = findParentScope(scopes, path);
                const previous = scopeBlocks.find((each) => each.path === parent?.path);
                return previous !== undefined && isDeepStrictEqual(blocks, previous.blocks);
            })
            .map(({ path }) => path),
    );
}

function buildScopeConfigurationBlocks(
    configurations: Array<{ configuration: Configuration; builder: EslintBlockBuilder }>,
    planned: PlannedEslintFile,
): ConfigurationScopeBlocks[] {
    const result: ConfigurationScopeBlocks[] = [];
    for (const { configuration, builder } of configurations) {
        const scopeBlocks = planned.session.scopes
            .filter((each) => each.configurations.includes(configuration))
            .map((scope) => ({
                path: scope.path,
                blocks: buildConfigurationBlocks(builder, scope, planned),
            }));
        const matching = listMatchingScopes(scopeBlocks, planned.session.scopes);
        for (const { path, blocks } of scopeBlocks) {
            if (matching.has(path) || blocks.length === 0) continue;
            const excluded = listNestedScopeGlobs(
                planned.session.scopes.map((each) => each.path).filter((child) => !matching.has(child)),
                path,
            );
            result.push({
                configuration,
                blocks: blocks.map((block) => ({ ...block, scope: { path, excluded } })),
            });
        }
    }
    return result;
}

function buildPluginRuleBlocks(scope: EslintScope, declaration: PluginRuleBlock): ConfigurationBlocks {
    const selectors = { code: scope.eslintFiles.code, tests: scope.eslintFiles.tests };
    const files = typeof declaration.files === 'string' ? selectors[declaration.files] : declaration.files;
    return [
        {
            fields: {
                ...declaration.fields,
                files,
                ...(declaration.ignoresTests === true && {
                    ignores: [
                        ...new Set(scope.eslintFiles.tests.map(([test]) => test).filter((test) => test !== undefined)),
                    ],
                }),
                rules: { ...declaration.rules, ...(scope.level === 'all' && declaration.allLevelRules) },
            },
            calls: declaration.calls ?? [],
            presets: declaration.presets ?? [],
        },
    ];
}

export function listConfigurationBlocks(planned: PlannedEslintFile): Map<Configuration, PlannedEslintBlock[]> {
    const configurations = planned.configurations.flatMap((configuration) => {
        const builder = CONFIGURATION_BUILDERS[configuration.name];
        return builder === undefined ? [] : { configuration, builder };
    });
    return new Map(
        Map.groupBy(buildScopeConfigurationBlocks(configurations, planned), ({ configuration }) => configuration)
            .entries()
            .map(([configuration, groups]) => [configuration, groups.flatMap(({ blocks }) => blocks)]),
    );
}
