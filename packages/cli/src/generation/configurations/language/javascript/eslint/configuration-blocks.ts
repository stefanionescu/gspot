import { isDeepStrictEqual } from 'node:util';
import type { Session } from '#cli/types/session.ts';
import { BACKSLASH_BEFORE_MATCH } from '#cli/config/text.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { GLOB_SPECIAL_CHARACTERS } from '#cli/config/files/path-patterns.ts';
import { buildVitestBlocks } from '#cli/generation/configurations/vitest.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { buildVueBlocks } from '#cli/generation/configurations/framework/vue.ts';
import { buildAstroBlocks } from '#cli/generation/configurations/framework/astro.ts';
import { buildReactBlocks } from '#cli/generation/configurations/framework/react.ts';
import { buildNestjsBlocks } from '#cli/generation/configurations/framework/nestjs.ts';
import { buildNextjsBlocks } from '#cli/generation/configurations/framework/nextjs.ts';
import { buildSvelteBlocks } from '#cli/generation/configurations/framework/svelte.ts';
import { buildDrizzleBlocks } from '#cli/generation/configurations/library/drizzle.ts';
import { buildZustandBlocks } from '#cli/generation/configurations/library/zustand.ts';
import { buildReactDomBlocks } from '#cli/generation/configurations/framework/react-dom.ts';
import { buildTypescriptBlocks } from '#cli/generation/configurations/language/typescript.ts';
import { buildTestFiles } from '#cli/generation/configurations/language/javascript/eslint/files.ts';
import { buildTanstackQueryBlocks } from '#cli/generation/configurations/library/tanstack-query.ts';
import { buildTestingLibraryBlocks } from '#cli/generation/configurations/library/testing-library.ts';
import { joinScope, isInScope, listNestedScopes, compareScopeDepth } from '#cli/repository/scopes.ts';
import { buildPluginRuleBlocks } from '#cli/generation/configurations/language/javascript/eslint/plugin-rules.ts';
import { buildSelectorGroups } from '#cli/generation/configurations/language/javascript/eslint/blocks/selectors.ts';
import { PLUGIN_RULE_BLOCKS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

import type {
    EslintScope,
    EslintPlugins,
    PlannedEslintFile,
    PlannedEslintBlock,
    ConfigurationBlocks,
} from '#cli/types/generation/eslint.ts';

function buildConfigurationBlocks(
    session: Session,
    configuration: Configuration,
    builder: (scope: EslintScope, configuration: string) => ConfigurationBlocks,
    scope: Scope,
    planned: PlannedEslintFile,
): ConfigurationBlocks {
    const scopePath = scope.folder.path;
    const children = listNestedScopes(
        planned.session.scopes.map((each) => each.folder.path),
        scopePath,
    );
    const testFiles = scope.settings.test_files.map((pattern) =>
        scopePath !== '' && pattern.startsWith(`${scopePath}/**/`) ? pattern.slice(scopePath.length + 1) : pattern,
    );
    return builder(
        {
            settings: scope.settings,
            projects: planned.projects,
            eslintPresets: planned.eslintPresets,
            scopePath,
            presets: planned.eslintPresets.get(configuration.name),
            scopeDependencies: listProjectDependencyNames(session.repository.dependencyFiles, scopePath),
            eslintFiles: {
                ...planned.eslintFiles,
                tests: buildTestFiles(testFiles, planned.eslintFiles.code),
            },
            sourceFiles: session.repository.files
                .filter((file) => file.kind === 'source')
                .map((file) => file.path)
                .filter((path) => isInScope(path, scopePath) && children.every((child) => !isInScope(path, child))),
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
                    .filter((scope) => scope.folder.path !== path && isInScope(path, scope.folder.path))
                    .toSorted((a, b) => compareScopeDepth(b.folder.path, a.folder.path))[0];
                const previous = scopeBlocks.find((each) => each.path === parent?.folder.path);
                return previous !== undefined && isDeepStrictEqual(blocks.blocks, previous.blocks.blocks);
            })
            .map(({ path }) => path),
    );
}

function buildScopeConfigurationBlocks(
    session: Session,
    configurations: {
        configuration: Configuration;
        builder: (scope: EslintScope, configuration: string) => ConfigurationBlocks;
    }[],
    planned: PlannedEslintFile,
): { configuration: Configuration; imports: EslintPlugins; blocks: PlannedEslintBlock[] }[] {
    const result: { configuration: Configuration; imports: EslintPlugins; blocks: PlannedEslintBlock[] }[] = [];
    for (const { configuration, builder } of configurations) {
        const scopeBlocks = planned.session.scopes
            .filter((each) => each.configurations.includes(configuration))
            .map((scope) => ({
                path: scope.folder.path,
                blocks: buildConfigurationBlocks(session, configuration, builder, scope, planned),
            }));
        const matching = listMatchingScopes(scopeBlocks, planned.session.scopes);
        for (const { path, blocks } of scopeBlocks.filter((each) => !matching.has(each.path))) {
            const excluded = listNestedScopes(
                planned.session.scopes.map((each) => each.folder.path),
                path,
            )
                .filter((child) => !matching.has(child))
                .map((child) => joinScope(child.replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH), '**'));
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
 * Collect imported bindings, the scoped blocks of each configuration, and configuration selectors.
 *
 * @param session the repository.
 * @param planned the source facts and resolved scopes.
 * @returns the configuration data before serialization, with the blocks of each configuration in plan order.
 */
export function listConfigurationBlocks(
    session: Session,
    planned: PlannedEslintFile,
): {
    configurationBlocks: Map<Configuration, PlannedEslintBlock[]>;
    configurationImports: EslintPlugins;
    configurationSelectors: ReturnType<typeof buildSelectorGroups>;
} {
    const configurations = planned.configurations.flatMap((configuration) => {
        const builder = Object.hasOwn(CONFIGURATION_BUILDERS, configuration.name)
            ? CONFIGURATION_BUILDERS[configuration.name]
            : undefined;
        return builder === undefined ? [] : [{ configuration, builder }];
    });
    const selected = buildScopeConfigurationBlocks(session, configurations, planned);
    return {
        configurationBlocks: new Map(
            Map.groupBy(selected, ({ configuration }) => configuration)
                .entries()
                .map(([configuration, groups]) => [configuration, groups.flatMap(({ blocks }) => blocks)]),
        ),
        configurationImports: Object.fromEntries(selected.flatMap((blocks) => Object.entries(blocks.imports))),
        configurationSelectors: buildSelectorGroups(
            planned.session.scopes,
            planned.level,
            planned.session.settingsFile.settings.structure.reexports,
        ),
    };
}

const CONFIGURATION_BUILDERS: Record<string, (scope: EslintScope, configuration: string) => ConfigurationBlocks> = {
    ...Object.fromEntries(Object.keys(PLUGIN_RULE_BLOCKS).map((name) => [name, buildPluginRuleBlocks])),
    astro: buildAstroBlocks,
    vue: buildVueBlocks,
    svelte: buildSvelteBlocks,
    nextjs: buildNextjsBlocks,
    typescript: buildTypescriptBlocks,
    zustand: buildZustandBlocks,
    'testing-library': buildTestingLibraryBlocks,
    vitest: buildVitestBlocks,
    react: buildReactBlocks,
    'react-dom': buildReactDomBlocks,
    nestjs: buildNestjsBlocks,
    drizzle: buildDrizzleBlocks,
    'tanstack-query': buildTanstackQueryBlocks,
};
