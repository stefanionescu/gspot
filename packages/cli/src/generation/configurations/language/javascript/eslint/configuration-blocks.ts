import { dirname } from 'node:path/posix';
import { isDeepStrictEqual } from 'node:util';
import { escapeGlob } from '#cli/system/paths.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { buildZodBlocks } from '#cli/generation/configurations/library/zod.ts';
import { buildVueBlocks } from '#cli/generation/configurations/framework/vue.ts';
import { buildAstroBlocks } from '#cli/generation/configurations/framework/astro.ts';
import { buildReactBlocks } from '#cli/generation/configurations/framework/react.ts';
import { buildVitestBlocks } from '#cli/generation/configurations/testing/vitest.ts';
import { buildNestjsBlocks } from '#cli/generation/configurations/framework/nestjs.ts';
import { buildNextjsBlocks } from '#cli/generation/configurations/framework/nextjs.ts';
import { buildSvelteBlocks } from '#cli/generation/configurations/framework/svelte.ts';
import { buildDrizzleBlocks } from '#cli/generation/configurations/library/drizzle.ts';
import { buildZustandBlocks } from '#cli/generation/configurations/library/zustand.ts';
import { buildReactDomBlocks } from '#cli/generation/configurations/framework/react-dom.ts';
import { buildTypescriptBlocks } from '#cli/generation/configurations/language/typescript.ts';
import { buildTanstackQueryBlocks } from '#cli/generation/configurations/library/tanstack-query.ts';
import { buildTestingLibraryBlocks } from '#cli/generation/configurations/library/testing-library.ts';
import { joinScope, isInScope, listNestedScopes, compareScopeDepth } from '#cli/repository/scopes.ts';
import { buildPluginRuleBlocks } from '#cli/generation/configurations/language/javascript/eslint/plugin-rules.ts';
import { buildTestFiles, listCodeTestFiles } from '#cli/generation/configurations/language/javascript/eslint/files.ts';
import { PLUGIN_RULE_BLOCKS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

import type {
    EslintPlugins,
    PlannedEslintFile,
    PlannedEslintBlock,
    ConfigurationBlocks,
    ConfigurationBuilder,
    ConfigurationScopeBlocks,
} from '#cli/types/generation/eslint.ts';

const CONFIGURATION_BUILDERS: Readonly<Record<string, ConfigurationBuilder | undefined>> = {
    ...Object.fromEntries(Object.keys(PLUGIN_RULE_BLOCKS).map((name) => [name, buildPluginRuleBlocks])),
    astro: buildAstroBlocks,
    vue: buildVueBlocks,
    svelte: buildSvelteBlocks,
    nextjs: buildNextjsBlocks,
    typescript: buildTypescriptBlocks,
    zustand: buildZustandBlocks,
    zod: buildZodBlocks,
    'testing-library': buildTestingLibraryBlocks,
    vitest: buildVitestBlocks,
    react: buildReactBlocks,
    'react-dom': buildReactDomBlocks,
    nestjs: buildNestjsBlocks,
    drizzle: buildDrizzleBlocks,
    'tanstack-query': buildTanstackQueryBlocks,
};

function buildConfigurationBlocks(
    configuration: Configuration,
    builder: ConfigurationBuilder,
    scope: Scope,
    planned: PlannedEslintFile,
): ConfigurationBlocks {
    const { session } = planned;
    const scopePath = scope.path;
    const children = listNestedScopes(
        planned.session.scopes.map((each) => each.path),
        scopePath,
    );
    const nextProject =
        session.repository.dependencyFiles
            .filter((file) => file.kind === 'package.json' && file.dependencies['next'] !== undefined)
            .map((file) => (dirname(file.path) === '.' ? '' : dirname(file.path)))
            .filter((path) => isInScope(scopePath, path))
            .toSorted((left, right) => -compareScopeDepth(left, right))[0] ?? scopePath;
    const testFiles = listCodeTestFiles(scope.settings.test_files).map((pattern) =>
        scopePath !== '' && pattern.startsWith(`${scopePath}/**/`) ? pattern.slice(scopePath.length + 1) : pattern,
    );
    return builder(
        {
            settings: scope.settings,
            projects: planned.projects,
            path: scopePath,
            projectPath: configuration.name === 'nextjs' ? nextProject : scopePath,
            dependencies: listProjectDependencyNames(session.repository.dependencyFiles, scopePath),
            eslintFiles: {
                ...planned.eslintFiles,
                tests: buildTestFiles(testFiles, planned.eslintFiles.code),
            },
            sourceFiles: session.repository.files
                .filter((file) => file.kind === 'source')
                .map((file) => file.path)
                .filter((path) =>
                    configuration.name === 'nextjs'
                        ? isInScope(path, nextProject)
                        : isInScope(path, scopePath) && children.every((child) => !isInScope(path, child)),
                ),
        },
        configuration.name,
    );
}

function listMatchingScopes(
    scopeBlocks: { path: string; blocks: ConfigurationBlocks }[],
    scopes: Scope[],
): Set<string> {
    return new Set(
        scopeBlocks
            .filter(({ path, blocks }) => {
                const parent = scopes
                    .filter((scope) => scope.path !== path && isInScope(path, scope.path))
                    .toSorted((a, b) => compareScopeDepth(b.path, a.path))[0];
                const previous = scopeBlocks.find((each) => each.path === parent?.path);
                return previous !== undefined && isDeepStrictEqual(blocks.blocks, previous.blocks.blocks);
            })
            .map(({ path }) => path),
    );
}

function buildScopeConfigurationBlocks(
    configurations: { configuration: Configuration; builder: ConfigurationBuilder }[],
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
                imports: blocks.imports,
                blocks: blocks.blocks.map((block) => ({
                    ...block,
                    scope: { path, excluded },
                    label: configuration.name,
                })),
            });
        }
    }
    return result;
}

/**
Collect imported bindings and the scoped blocks of each configuration.

@param planned the source facts and resolved scopes.
@returns the blocks of each configuration in plan order.
*/
export function listConfigurationBlocks(planned: PlannedEslintFile): {
    configurationBlocks: Map<Configuration, PlannedEslintBlock[]>;
    configurationImports: EslintPlugins;
} {
    const configurations = planned.configurations.flatMap((configuration) => {
        const builder = CONFIGURATION_BUILDERS[configuration.name];
        return builder === undefined ? [] : { configuration, builder };
    });
    const selected = buildScopeConfigurationBlocks(configurations, planned);
    return {
        configurationBlocks: new Map(
            Map.groupBy(selected, ({ configuration }) => configuration)
                .entries()
                .map(([configuration, groups]) => [configuration, groups.flatMap(({ blocks }) => blocks)]),
        ),
        configurationImports: Object.fromEntries(selected.flatMap((blocks) => Object.entries(blocks.imports))),
    };
}
