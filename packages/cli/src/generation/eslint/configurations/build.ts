import { isDeepStrictEqual } from 'node:util';
import type { Session } from '#cli/types/session.ts';
import { BACKSLASH_BEFORE_MATCH } from '#cli/config/text.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { buildTestFiles } from '#cli/generation/eslint/files.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { GLOB_SPECIAL_CHARACTERS } from '#cli/config/system/paths.ts';
import { buildSelectorGroups } from '#cli/generation/eslint/selectors.ts';
import { buildVueBlocks } from '#cli/generation/eslint/configurations/vue.ts';
import { listProjectDependencyNames } from '#cli/repository/dependency-files.ts';
import { buildAstroBlocks } from '#cli/generation/eslint/configurations/astro.ts';
import { buildReactBlocks } from '#cli/generation/eslint/configurations/react.ts';
import { buildNestjsBlocks } from '#cli/generation/eslint/configurations/nestjs.ts';
import { buildNextjsBlocks } from '#cli/generation/eslint/configurations/nextjs.ts';
import { buildSvelteBlocks } from '#cli/generation/eslint/configurations/svelte.ts';
import { buildVitestBlocks } from '#cli/generation/eslint/configurations/vitest.ts';
import { PLUGIN_RULE_BLOCKS } from '#cli/config/generation/eslint/configurations.ts';
import { buildDrizzleBlocks } from '#cli/generation/eslint/configurations/drizzle.ts';
import { buildZustandBlocks } from '#cli/generation/eslint/configurations/zustand.ts';
import { buildReactDomBlocks } from '#cli/generation/eslint/configurations/react-dom.ts';
import { buildTypescriptBlocks } from '#cli/generation/eslint/configurations/typescript.ts';
import { buildPluginRuleBlocks } from '#cli/generation/eslint/configurations/plugin-rules.ts';
import { buildTanstackQueryBlocks } from '#cli/generation/eslint/configurations/tanstack-query.ts';
import { buildTestingLibraryBlocks } from '#cli/generation/eslint/configurations/testing-library.ts';
import { joinScope, isInScope, listNestedScopes, compareScopeDepth } from '#cli/repository/scopes.ts';

import type {
    EslintScope,
    EslintPlugins,
    PlannedEslintFile,
    PlannedEslintBlock,
    ConfigurationBlocks,
} from '#cli/types/generation/eslint.ts';

// Scope inputs determine block data before the builder attaches labels and inclusion masks.
function buildConfigurationBlocks(
    session: Session,
    configuration: Configuration,
    builder: (scope: EslintScope, configuration: string) => ConfigurationBlocks,
    selection: Scope,
    planned: PlannedEslintFile,
): ConfigurationBlocks {
    const scope = selection.scope.path;
    const children = listNestedScopes(
        planned.session.scopes.map((entry) => entry.scope.path),
        scope,
    );
    const testFiles = selection.view.test_files.map((pattern) =>
        scope !== '' && pattern.startsWith(`${scope}/**/`) ? pattern.slice(scope.length + 1) : pattern,
    );
    return builder(
        {
            view: selection.view,
            projects: planned.projects,
            eslintPresets: planned.eslintPresets,
            scope,
            presets: planned.eslintPresets.get(configuration.name),
            scopeDependencies: listProjectDependencyNames(session.repository.dependencyFiles, scope),
            eslintFiles: {
                ...planned.eslintFiles,
                tests: buildTestFiles(testFiles, planned.eslintFiles.code),
            },
            sourceFiles: session.repository.files
                .filter((file) => file.kind === 'source')
                .map((file) => file.path)
                .filter((path) => isInScope(path, scope) && children.every((child) => !isInScope(path, child))),
        },
        configuration.name,
    );
}

// A scope can share only its immediate parent's configuration data, including when that parent has no fragment.
function listMatchingScopes(entries: { path: string; blocks: ConfigurationBlocks }[], scopes: Scope[]): Set<string> {
    return new Set(
        entries
            .filter(({ path, blocks }) => {
                const parent = scopes
                    .filter((entry) => entry.scope.path !== path && isInScope(path, entry.scope.path))
                    .toSorted((a, b) => compareScopeDepth(b.scope.path, a.scope.path))[0];
                const previous = entries.find((entry) => entry.path === parent?.scope.path);
                return previous !== undefined && isDeepStrictEqual(blocks.blocks, previous.blocks.blocks);
            })
            .map(({ path }) => path),
    );
}

// Keep one set of block data for matching nested scopes, with differing scopes excluded from their parent.
function buildScopeConfigurationBlocks(
    session: Session,
    configurations: {
        configuration: Configuration;
        builder: (scope: EslintScope, configuration: string) => ConfigurationBlocks;
    }[],
    planned: PlannedEslintFile,
): { imports: EslintPlugins; blocks: PlannedEslintBlock[] }[] {
    const result: { imports: EslintPlugins; blocks: PlannedEslintBlock[] }[] = [];
    for (const { configuration, builder } of configurations) {
        const entries = planned.session.scopes
            .filter((entry) => entry.selected.includes(configuration))
            .map((selection) => ({
                path: selection.scope.path,
                blocks: buildConfigurationBlocks(session, configuration, builder, selection, planned),
            }));
        const matching = listMatchingScopes(entries, planned.session.scopes);
        for (const { path, blocks } of entries.filter((entry) => !matching.has(entry.path))) {
            const excluded = listNestedScopes(
                planned.session.scopes.map((entry) => entry.scope.path),
                path,
            )
                .filter((child) => !matching.has(child))
                .map((child) => joinScope(child.replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH), '**'));
            result.push({
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
 * Collect imported bindings, scoped block data, and configuration selectors.
 *
 * @param session the repository.
 * @param planned the source facts and resolved scopes.
 * @returns the configuration data before serialization.
 */
export function listConfigurationBlocks(
    session: Session,
    planned: PlannedEslintFile,
): {
    configurationBlocks: PlannedEslintBlock[];
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
        configurationBlocks: selected.flatMap((blocks) => blocks.blocks),
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
