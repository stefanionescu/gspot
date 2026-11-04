import { isDeepStrictEqual } from 'node:util';
import { escapeGlob } from '#cli/system/paths.ts';
import type { Scope } from '#cli/types/settings.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { getTable, findParentScope } from '#cli/settings/scopes.ts';
import { joinScope, listNestedScopes } from '#cli/repository/scopes.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { VUE_BLOCK_BUILDERS } from '#cli/configurations/framework/vue/generate.ts';
import { ASTRO_BLOCK_BUILDERS } from '#cli/configurations/framework/astro/generate.ts';
import { VITEST_BLOCK_BUILDERS } from '#cli/configurations/testing/vitest/generate.ts';
import { NESTJS_BLOCK_BUILDERS } from '#cli/configurations/framework/nestjs/generate.ts';
import { NEXTJS_BLOCK_BUILDERS } from '#cli/configurations/framework/nextjs/generate.ts';
import { SVELTE_BLOCK_BUILDERS } from '#cli/configurations/framework/svelte/generate.ts';
import { DRIZZLE_BLOCK_BUILDERS } from '#cli/configurations/library/drizzle/generate.ts';
import { ZUSTAND_BLOCK_BUILDERS } from '#cli/configurations/library/zustand/generate.ts';
import { IMPORT_EXTENSIONS, FILE_EXTENSION_RULE } from '#cli/config/configurations/blocks.ts';
import { SUPABASE_RULES, PLUGIN_RULE_BLOCKS } from '#cli/config/configurations/javascript.ts';
import { REACT_DOM_BLOCK_BUILDERS } from '#cli/configurations/framework/react-dom/generate.ts';
import { TYPESCRIPT_BLOCK_BUILDERS } from '#cli/configurations/language/typescript/generate.ts';
import { TESTING_LIBRARY_BLOCK_BUILDERS } from '#cli/configurations/library/testing-library/generate.ts';
import { buildTestFiles, listCodeTestFiles } from '#cli/configurations/language/javascript/eslint/files.ts';

import type {
    EslintScope,
    PlannedEslintFile,
    PlannedEslintBlock,
    ConfigurationBlocks,
    ConfigurationBuilder,
    ConfigurationScopeBlocks,
} from '#cli/types/configurations/language.ts';

const CONFIGURATION_BUILDERS: Readonly<Record<string, ConfigurationBuilder | undefined>> = {
    ...Object.fromEntries(Object.keys(PLUGIN_RULE_BLOCKS).map((name) => [name, buildPluginRuleBlocks])),
    ...ASTRO_BLOCK_BUILDERS,
    ...DRIZZLE_BLOCK_BUILDERS,
    ...NESTJS_BLOCK_BUILDERS,
    ...NEXTJS_BLOCK_BUILDERS,
    ...REACT_DOM_BLOCK_BUILDERS,
    ...SVELTE_BLOCK_BUILDERS,
    ...TESTING_LIBRARY_BLOCK_BUILDERS,
    ...TYPESCRIPT_BLOCK_BUILDERS,
    ...VITEST_BLOCK_BUILDERS,
    ...VUE_BLOCK_BUILDERS,
    ...ZUSTAND_BLOCK_BUILDERS,
    supabase: buildSupabaseBlocks,
};

function buildConfigurationBlocks(
    configuration: Configuration,
    builder: ConfigurationBuilder,
    scope: Scope,
    planned: PlannedEslintFile,
): ConfigurationBlocks {
    const { session } = planned;
    const scopePath = scope.path;
    const testFiles = listCodeTestFiles(scope.settings.test_files).map((pattern) =>
        scopePath !== '' && pattern.startsWith(`${scopePath}/**/`) ? pattern.slice(scopePath.length + 1) : pattern,
    );
    return builder(
        {
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
        },
        configuration.name,
    );
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
    configurations: Array<{ configuration: Configuration; builder: ConfigurationBuilder }>,
    planned: PlannedEslintFile,
): ConfigurationScopeBlocks[] {
    const result: ConfigurationScopeBlocks[] = [];
    for (const { configuration, builder } of configurations) {
        const scopeBlocks = planned.session.scopes
            .filter((each) => each.configurations.includes(configuration))
            .map((scope) => ({
                path: scope.path,
                blocks: buildConfigurationBlocks(configuration, builder, scope, planned),
            }));
        const matching = listMatchingScopes(scopeBlocks, planned.session.scopes);
        for (const { path, blocks } of scopeBlocks) {
            if (matching.has(path)) continue;
            const excluded = listNestedScopes(
                planned.session.scopes.map((each) => each.path),
                path,
            )
                .filter((child) => !matching.has(child))
                .map((child) => joinScope(escapeGlob(child), '**'));
            result.push({
                configuration,
                blocks: blocks.map((block) => ({
                    ...block,
                    scope: { path, excluded },
                    label: configuration.name,
                })),
            });
        }
    }
    return result;
}

function buildPluginRuleBlocks(scope: EslintScope, configuration: string): ConfigurationBlocks {
    const declaration = PLUGIN_RULE_BLOCKS[configuration] as (typeof PLUGIN_RULE_BLOCKS)[string];
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

/**
Check the request body that each Supabase edge function reads.

@param scope the planned ESLint file of the scope.
*/
function buildSupabaseBlocks(scope: EslintScope): ConfigurationBlocks {
    const folder = escapeGlob(getTable(scope.settings, 'supabase').functions_folder);
    const files = scope.eslintFiles.code.map((pattern) => [`${folder}/**`, pattern]);
    const settings = { n: { tryExtensions: IMPORT_EXTENSIONS, typescriptExtensionMap: [] } };
    return [{ fields: { files, settings, rules: { ...SUPABASE_RULES, [FILE_EXTENSION_RULE]: ['error', 'always'] } } }];
}

/**
Collect the scoped blocks of each configuration.

@param planned the source facts and resolved scopes.
@returns the blocks of each configuration in plan order.
*/
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
