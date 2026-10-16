// What the selected fragments add to a generated target: emitted text, imports, file globs, and selectors.
import ts from 'typescript';
import type { Session } from '#cli/types/planning.ts';
import { escapeGlob } from '#cli/repository/matchers.ts';
import { buildFilePatterns } from '#cli/generation/eslint/files.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { isInScope, listNestedScopes } from '#cli/repository/scopes.ts';
import { createBlockWriter } from '#cli/generation/eslint/block-writer.ts';
import { buildVueFragment } from '#cli/generation/eslint/fragments/vue.ts';
import type { EslintFragmentInputs } from '#cli/types/generation/eslint.ts';
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
import type { Fragment, TypescriptImports } from '#cli/types/generation/fragments.ts';
import { buildTypescriptFragment } from '#cli/generation/eslint/fragments/typescript.ts';
import { buildTanstackQueryFragment } from '#cli/generation/eslint/fragments/tanstack-query.ts';
import { buildTestingLibraryFragment } from '#cli/generation/eslint/fragments/testing-library.ts';

import {
    zodFragment,
    expoFragment,
    expressFragment,
    reactNativeFragment,
    translationsFragment,
} from '#cli/generation/eslint/fragments/plugin-lint-rules.ts';

// The configurations whose fragments a target takes: a target written for one scope asks that scope, and a target
// written once asks every scope.
function listFragmentConfigurations(
    scopes: ScopeSelection[],
    selection: ScopeSelection,
    target: ToolFileDeclaration,
): Manifest[] {
    if (target.per_scope) return selection.selected;
    const every = [selection, ...scopes].flatMap((entry) => entry.selected);
    return new Map(every.map((manifest) => [manifest.configuration.name, manifest])).values().toArray();
}

function buildFragment(manifest: Manifest, inputs: EslintFragmentInputs): string {
    const builder = (
        {
            astro: buildAstroFragment,
            vue: buildVueFragment,
            svelte: buildSvelteFragment,
            expo: expoFragment,
            nextjs: buildNextjsFragment,
            typescript: buildTypescriptFragment,
            zustand: buildZustandFragment,
            'testing-library': buildTestingLibraryFragment,
            jest: buildJestFragment,
            vitest: buildVitestFragment,
            react: buildReactFragment,
            'react-dom': buildReactDomFragment,
            'react-native': reactNativeFragment,
            nestjs: buildNestjsFragment,
            express: expressFragment,
            drizzle: buildDrizzleFragment,
            zod: zodFragment,
            'tanstack-query': buildTanstackQueryFragment,
            translations: translationsFragment,
        } as Record<string, (inputs: EslintFragmentInputs) => string>
    )[manifest.configuration.name];
    return (builder as (values: EslintFragmentInputs) => string)(inputs);
}

// The text emitted by each selected ESLint fragment.
function buildSelectedFragments(
    session: Session,
    fragments: Fragment[],
    inputs: EslintFragmentInputs,
    scopes: ScopeSelection[],
): string[] {
    const emitted: string[] = [];
    for (const { manifest } of fragments) {
        for (const selection of scopes.filter((entry) => entry.selected.includes(manifest))) {
            const scope = selection.scope.path;
            const children = listNestedScopes(
                scopes.map((entry) => entry.scope.path),
                scope,
            );
            const selectedFiles = inputs
                .files('')
                .filter((path) => isInScope(path, scope) && children.every((child) => !isInScope(path, child)));
            const module = createBlockWriter({
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
                scopeDependencies: Object.keys(getProjectDependencies(session.packageManifests, scope)),
                eslintModule: module,
                eslintFiles: {
                    ...inputs.eslintFiles,
                    tests: selection.view.test_files.flatMap((test) =>
                        inputs.eslintFiles.code.map((pattern) => [test, pattern]),
                    ),
                },
                files: (extension: string) => selectedFiles.filter((path) => path.endsWith(extension)),
            });
            inputs.eslintFragmentBlocks.push(...module.blocks);
            emitted.push(fragment);
        }
    }
    return emitted;
}

/**
 * Separate imports from an emitted configuration fragment.
 *
 * @param text the source text.
 *
 * @returns the imports and remaining fragment body.
 */
function typescriptImports(text: string): TypescriptImports {
    const source = ts.createSourceFile('fragment.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const imports: string[] = [];
    const body: string[] = [];
    let through = 0;
    for (const statement of source.statements.filter((statement) => ts.isImportDeclaration(statement))) {
        const start = Math.max(through, statement.getFullStart());
        let end = ts.getTrailingCommentRanges(text, statement.end)?.at(-1)?.end ?? statement.end;
        if (text[end] === '\r') end += 1;
        if (text[end] === '\n') end += 1;
        body.push(text.slice(through, start));
        imports.push(text.slice(start, end).trim());
        through = end;
    }
    body.push(text.slice(through));
    return { imports, body: body.join('') };
}

/**
 * Build the imports, rule blocks, and selectors contributed by selected ESLint fragments.
 *
 * @param session the repository session.
 * @param scopes every selected scope.
 * @param selection the scope that receives the target.
 * @param target the configuration target.
 * @param inputs the scope's typed source inputs for emitting the fragments.
 *
 * @returns the emitted fragments, their imports, file globs, and selector groups.
 */
export function collectFragments(
    session: Session,
    scopes: ScopeSelection[],
    selection: ScopeSelection,
    target: ToolFileDeclaration,
    inputs: EslintFragmentInputs,
): {
    fragmentParts: string[];
    fragmentImports: string;
    fragmentSelectors: ReturnType<typeof groupFragmentSelectors>;
    eslintFragmentBlocks: EslintFragmentInputs['eslintFragmentBlocks'];
    eslintModule: EslintFragmentInputs['eslintModule'];
    eslintFiles: EslintFragmentInputs['eslintFiles'];
} {
    const fragments = listFragmentConfigurations(scopes, selection, target).flatMap((manifest) =>
        manifest.toolFiles
            .filter((toolFile) => toolFile.fragment && toolFile.target === target.target)
            .map((toolFile) => ({ manifest, toolFile })),
    );
    const config = inputs.eslint();
    const eslintFiles = buildFilePatterns({
        components: fragments.map(({ manifest }) => manifest),
        tests: config.testFiles,
        scripts: config.scriptFiles,
        nodeFiles: config.nodeFiles,
    });
    const eslintFragmentBlocks: EslintFragmentInputs['eslintFragmentBlocks'] = [];
    const emitted = buildSelectedFragments(
        session,
        fragments,
        { ...inputs, eslintFragmentBlocks, eslintFiles },
        scopes,
    );
    const parsed = emitted.map((fragment) => typescriptImports(fragment));
    const imports = parsed.flatMap(({ imports }) => imports);
    const bodies = parsed.map(({ body }) => body);
    return {
        fragmentParts: bodies,
        fragmentImports: [...new Set(imports.filter((line) => line.trim() !== ''))].join('\n'),
        eslintFiles,
        eslintFragmentBlocks,
        eslintModule: createBlockWriter({
            allRules: inputs.eslintAllRules,
            isAll: inputs.isAll,
            codeFiles: eslintFiles.code,
            ruleOptions: inputs.ruleOptions,
        }),
        fragmentSelectors: groupFragmentSelectors(scopes, inputs.isAll, inputs.repositorySettings.structure.reexports),
    };
}
