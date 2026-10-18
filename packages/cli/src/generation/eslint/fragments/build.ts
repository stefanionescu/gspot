// Collect what the fragments add to a generated file: text, imports, file globs, and selectors.
import type { Session } from '#cli/types/planning.ts';
import { escapeGlob } from '#cli/repository/matchers.ts';
import type { Fragment } from '#cli/types/generation/fragments.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { isInScope, listNestedScopes } from '#cli/repository/scopes.ts';
import { createBlockWriter } from '#cli/generation/eslint/block-writer.ts';
import { buildVueFragment } from '#cli/generation/eslint/fragments/vue.ts';
import { buildJestFragment } from '#cli/generation/eslint/fragments/jest.ts';
import { groupFragmentSelectors } from '#cli/generation/eslint/selectors.ts';
import { getProjectDependencies } from '#cli/repository/dependency-files.ts';
import { buildAstroFragment } from '#cli/generation/eslint/fragments/astro.ts';
import { buildReactFragment } from '#cli/generation/eslint/fragments/react.ts';
import { buildNestjsFragment } from '#cli/generation/eslint/fragments/nestjs.ts';
import { buildNextjsFragment } from '#cli/generation/eslint/fragments/nextjs.ts';
import { buildSvelteFragment } from '#cli/generation/eslint/fragments/svelte.ts';
import { buildVitestFragment } from '#cli/generation/eslint/fragments/vitest.ts';
import type { Manifest, ToolFileDeclaration } from '#cli/types/configurations.ts';
import { buildDrizzleFragment } from '#cli/generation/eslint/fragments/drizzle.ts';
import { buildZustandFragment } from '#cli/generation/eslint/fragments/zustand.ts';
import { buildReactDomFragment } from '#cli/generation/eslint/fragments/react-dom.ts';
import { buildTypescriptFragment } from '#cli/generation/eslint/fragments/typescript.ts';
import { type EslintContext, type EslintFragment } from '#cli/types/generation/eslint.ts';
import { buildLintRuleFragment } from '#cli/generation/eslint/fragments/plugin-lint-rules.ts';
import { buildTanstackQueryFragment } from '#cli/generation/eslint/fragments/tanstack-query.ts';
import { buildTestingLibraryFragment } from '#cli/generation/eslint/fragments/testing-library.ts';

/**
 * Select the configurations whose fragments add to this tool file.
 * A tool file for one scope asks that scope; a tool file written once asks every scope.
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

function buildFragment(manifest: Manifest, inputs: EslintContext): EslintFragment {
    const builders: Record<string, (inputs: EslintContext, configuration: string) => EslintFragment> = {
        astro: buildAstroFragment,
        vue: buildVueFragment,
        svelte: buildSvelteFragment,
        expo: buildLintRuleFragment,
        nextjs: buildNextjsFragment,
        typescript: buildTypescriptFragment,
        zustand: buildZustandFragment,
        'testing-library': buildTestingLibraryFragment,
        jest: buildJestFragment,
        vitest: buildVitestFragment,
        react: buildReactFragment,
        'react-dom': buildReactDomFragment,
        'react-native': buildLintRuleFragment,
        nestjs: buildNestjsFragment,
        express: buildLintRuleFragment,
        drizzle: buildDrizzleFragment,
        zod: buildLintRuleFragment,
        'tanstack-query': buildTanstackQueryFragment,
        translations: buildLintRuleFragment,
    };
    const builder = builders[manifest.configuration.name];
    if (builder === undefined) throw new Error(`No ESLint fragment builder for ${manifest.configuration.name}.`);
    return builder(inputs, manifest.configuration.name);
}

// Build the text of each ESLint fragment.
function buildSelectedFragments(session: Session, fragments: Fragment[], inputs: EslintContext): EslintFragment[] {
    const { scopes } = inputs;
    const blockText: EslintFragment[] = [];
    for (const { manifest } of fragments) {
        for (const selection of scopes.filter((entry) => entry.selected.includes(manifest))) {
            const scope = selection.scope.path;
            const children = listNestedScopes(
                scopes.map((entry) => entry.scope.path),
                scope,
            );
            const selectedFiles = inputs.sourceFiles.filter(
                (path) => isInScope(path, scope) && children.every((child) => !isInScope(path, child)),
            );
            const module = createBlockWriter({
                source: manifest.configuration.name,
                allRules: inputs.eslintAllRules,
                isAll: inputs.isAll,
                codeFiles: inputs.eslintFiles.code,
                ruleOptions: inputs.ruleOptions,
                scope: { path: scope, excluded: children.map((path) => `${escapeGlob(path)}/**`) },
            });
            const fragment = buildFragment(manifest, {
                ...inputs,
                ...selection.view,
                scope,
                testFiles: selection.view.test_files,
                scopeDependencies: Object.keys(getProjectDependencies(session.repository.dependencyFiles, scope)),
                blockWriter: module,
                eslintFiles: {
                    ...inputs.eslintFiles,
                    tests: selection.view.test_files.flatMap((test) =>
                        inputs.eslintFiles.code.map((pattern) => [test, pattern]),
                    ),
                },
                sourceFiles: selectedFiles,
            });
            blockText.push(fragment);
        }
    }
    return blockText;
}

/**
 * Collect the imports, lint blocks, and selectors that the ESLint fragments add.
 *
 * @param session the repository.
 * @param target the tool file to build.
 * @param inputs the typed source facts of the scope, with every scope and the one that gets the tool file.
 *
 * @returns the fragments with their imports, file globs, and selector groups.
 */
function collectFragments(
    session: Session,
    target: ToolFileDeclaration,
    inputs: EslintContext,
): {
    fragmentParts: string[];
    fragmentImports: string;
    fragmentSelectors: ReturnType<typeof groupFragmentSelectors>;
} {
    const { scopes, selection } = inputs;
    const fragments = listFragmentConfigurations(scopes, selection, target).flatMap((manifest) =>
        manifest.toolFiles
            .filter((toolFile) => toolFile.fragment && toolFile.target === target.target)
            .map((toolFile) => ({ manifest, toolFile })),
    );
    const blockText = buildSelectedFragments(session, fragments, inputs);
    const imports = blockText.flatMap((fragment) => fragment.imports);
    const bodies = blockText.map((fragment) => fragment.blocks);
    return {
        fragmentParts: bodies,
        fragmentImports: [...new Set(imports)].join('\n'),
        fragmentSelectors: groupFragmentSelectors(scopes, inputs.isAll, inputs.repositorySettings.structure.reexports),
    };
}

export { collectFragments, listFragmentConfigurations };
