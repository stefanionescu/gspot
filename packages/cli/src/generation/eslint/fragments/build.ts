// Build the scoped block data, imports, and selectors of the selected configurations.
import { isDeepStrictEqual } from 'node:util';
import type { Session } from '#cli/types/planning.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { buildVueFragment } from '#cli/generation/eslint/fragments/vue.ts';
import { groupFragmentSelectors } from '#cli/generation/eslint/selectors.ts';
import { buildAstroFragment } from '#cli/generation/eslint/fragments/astro.ts';
import { buildReactFragment } from '#cli/generation/eslint/fragments/react.ts';
import { buildTestFiles, buildScopeGlob } from '#cli/generation/eslint/files.ts';
import { buildNestjsFragment } from '#cli/generation/eslint/fragments/nestjs.ts';
import { buildNextjsFragment } from '#cli/generation/eslint/fragments/nextjs.ts';
import { buildSvelteFragment } from '#cli/generation/eslint/fragments/svelte.ts';
import { buildVitestFragment } from '#cli/generation/eslint/fragments/vitest.ts';
import { listProjectDependencyNames } from '#cli/repository/dependency-files.ts';
import type { Manifest, ToolFileDeclaration } from '#cli/types/configurations.ts';
import { buildDrizzleFragment } from '#cli/generation/eslint/fragments/drizzle.ts';
import { buildZustandFragment } from '#cli/generation/eslint/fragments/zustand.ts';
import { buildReactDomFragment } from '#cli/generation/eslint/fragments/react-dom.ts';
import { PLUGIN_LINT_RULE_FRAGMENTS } from '#cli/config/generation/eslint-fragments.ts';
import { buildTypescriptFragment } from '#cli/generation/eslint/fragments/typescript.ts';
import { isInScope, listNestedScopes, compareScopeDepth } from '#cli/repository/scopes.ts';
import { buildLintRuleFragment } from '#cli/generation/eslint/fragments/plugin-lint-rules.ts';
import { buildTanstackQueryFragment } from '#cli/generation/eslint/fragments/tanstack-query.ts';
import { buildTestingLibraryFragment } from '#cli/generation/eslint/fragments/testing-library.ts';

import {
    type EslintContext,
    type EslintPlugins,
    type EslintFragment,
    type EslintBlockInput,
    type EslintFragmentContext,
} from '#cli/types/generation/eslint.ts';

/**
 * Select the configurations whose fragments add to this tool file.
 * A tool file for one scope asks that scope; a tool file written once asks every scope.
 *
 * @param scopes every project and its settings.
 * @param selection the scope that gets the tool file.
 * @param target the tool file declaration and its scope requirements.
 * @returns each configuration with a fragment for this tool file, once.
 */
function listFragmentConfigurations(
    scopes: ScopeSelection[],
    selection: ScopeSelection,
    target: ToolFileDeclaration,
): Manifest[] {
    if (target.per_scope) return selection.selected;
    const every = [selection, ...scopes].flatMap((entry) => entry.selected);
    return new Map(every.map((manifest) => [manifest.configuration.name, manifest])).values().toArray();
}

// Scope inputs determine block data before the builder attaches labels and inclusion masks.
function buildScopeFragment(
    session: Session,
    manifest: Manifest,
    builder: (inputs: EslintFragmentContext, configuration: string) => EslintFragment,
    selection: ScopeSelection,
    inputs: EslintContext,
): EslintFragment {
    const scope = selection.scope.path;
    const children = listNestedScopes(
        inputs.session.scopes.map((entry) => entry.scope.path),
        scope,
    );
    const testFiles = selection.view.test_files.map((pattern) =>
        scope !== '' && pattern.startsWith(`${scope}/**/`) ? pattern.slice(scope.length + 1) : pattern,
    );
    return builder(
        {
            view: selection.view,
            projects: inputs.projects,
            eslintPresets: inputs.eslintPresets,
            scope,
            presets: inputs.eslintPresets.get(manifest.configuration.name),
            scopeDependencies: listProjectDependencyNames(session.repository.dependencyFiles, scope),
            eslintFiles: {
                ...inputs.eslintFiles,
                tests: buildTestFiles(testFiles, inputs.eslintFiles.code),
            },
            sourceFiles: session.repository.files
                .filter((file) => file.kind === 'source')
                .map((file) => file.path)
                .filter((path) => isInScope(path, scope) && children.every((child) => !isInScope(path, child))),
        },
        manifest.configuration.name,
    );
}

// A scope can share only its immediate parent's configuration data, including when that parent has no fragment.
function listMatchingFragmentScopes(
    entries: { path: string; fragment: EslintFragment }[],
    scopes: ScopeSelection[],
): Set<string> {
    return new Set(
        entries
            .filter(({ path, fragment }) => {
                const parent = scopes
                    .filter((entry) => entry.scope.path !== path && isInScope(path, entry.scope.path))
                    .toSorted((a, b) => compareScopeDepth(b.scope.path, a.scope.path))[0];
                const previous = entries.find((entry) => entry.path === parent?.scope.path);
                return previous !== undefined && isDeepStrictEqual(fragment.blocks, previous.fragment.blocks);
            })
            .map(({ path }) => path),
    );
}

// Keep one set of block data for matching nested scopes, with differing scopes excluded from their parent.
function buildSelectedFragments(
    session: Session,
    fragments: {
        manifest: Manifest;
        builder: (inputs: EslintFragmentContext, configuration: string) => EslintFragment;
    }[],
    inputs: EslintContext,
): { imports: EslintPlugins; blocks: EslintBlockInput[] }[] {
    const result: { imports: EslintPlugins; blocks: EslintBlockInput[] }[] = [];
    for (const { manifest, builder } of fragments) {
        const entries = inputs.session.scopes
            .filter((entry) => entry.selected.includes(manifest))
            .map((selection) => ({
                path: selection.scope.path,
                fragment: buildScopeFragment(session, manifest, builder, selection, inputs),
            }));
        const matching = listMatchingFragmentScopes(entries, inputs.session.scopes);
        for (const { path, fragment } of entries.filter((entry) => !matching.has(entry.path))) {
            const excluded = listNestedScopes(
                inputs.session.scopes.map((entry) => entry.scope.path),
                path,
            )
                .filter((child) => !matching.has(child))
                .map((child) => buildScopeGlob(child, '**'));
            result.push({
                imports: fragment.imports,
                blocks: fragment.blocks.map((block) => ({
                    ...block,
                    scope: { path, excluded },
                    label: manifest.configuration.name,
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
 * @param inputs the source facts and resolved scopes.
 * @returns the configuration data before serialization.
 */
function collectFragments(
    session: Session,
    inputs: EslintContext,
): {
    fragmentParts: EslintBlockInput[];
    fragmentImports: EslintPlugins;
    fragmentSelectors: ReturnType<typeof groupFragmentSelectors>;
} {
    const fragments = inputs.configurations.flatMap((manifest) => {
        const builder = Object.hasOwn(FRAGMENT_BUILDERS, manifest.configuration.name)
            ? FRAGMENT_BUILDERS[manifest.configuration.name]
            : undefined;
        return builder === undefined ? [] : [{ manifest, builder }];
    });
    const selected = buildSelectedFragments(session, fragments, inputs);
    return {
        fragmentParts: selected.flatMap((fragment) => fragment.blocks),
        fragmentImports: Object.fromEntries(selected.flatMap((fragment) => Object.entries(fragment.imports))),
        fragmentSelectors: groupFragmentSelectors(
            inputs.session.scopes,
            inputs.level,
            inputs.session.settingsFile.settings.structure.reexports,
        ),
    };
}

const FRAGMENT_BUILDERS: Record<string, (inputs: EslintFragmentContext, configuration: string) => EslintFragment> = {
    ...Object.fromEntries(Object.keys(PLUGIN_LINT_RULE_FRAGMENTS).map((name) => [name, buildLintRuleFragment])),
    astro: buildAstroFragment,
    vue: buildVueFragment,
    svelte: buildSvelteFragment,
    nextjs: buildNextjsFragment,
    typescript: buildTypescriptFragment,
    zustand: buildZustandFragment,
    'testing-library': buildTestingLibraryFragment,
    vitest: buildVitestFragment,
    react: buildReactFragment,
    'react-dom': buildReactDomFragment,
    nestjs: buildNestjsFragment,
    drizzle: buildDrizzleFragment,
    'tanstack-query': buildTanstackQueryFragment,
};

export { collectFragments, listFragmentConfigurations };
