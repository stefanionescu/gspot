// What the selected fragments add to a generated target: emitted text, imports, file globs, and selectors.
import ts from 'typescript';
import type { Session } from '#cli/types/planning.ts';
import { literalGlob } from '#cli/repository/selectors.ts';
import { filePatterns } from '#cli/generation/eslint/files.ts';
import { eslintModule } from '#cli/generation/eslint/serialize.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { vueFragment } from '#cli/generation/eslint/fragments/vue.ts';
import { zodFragment } from '#cli/generation/eslint/fragments/zod.ts';
import { expoFragment } from '#cli/generation/eslint/fragments/expo.ts';
import { jestFragment } from '#cli/generation/eslint/fragments/jest.ts';
import { astroFragment } from '#cli/generation/eslint/fragments/astro.ts';
import { reactFragment } from '#cli/generation/eslint/fragments/react.ts';
import { nestjsFragment } from '#cli/generation/eslint/fragments/nestjs.ts';
import { nextjsFragment } from '#cli/generation/eslint/fragments/nextjs.ts';
import { svelteFragment } from '#cli/generation/eslint/fragments/svelte.ts';
import { vitestFragment } from '#cli/generation/eslint/fragments/vitest.ts';
import type { EslintFragmentInputs } from '#cli/types/generation/eslint.ts';
import { fragmentSelectorGroups } from '#cli/generation/eslint/selectors.ts';
import { drizzleFragment } from '#cli/generation/eslint/fragments/drizzle.ts';
import { expressFragment } from '#cli/generation/eslint/fragments/express.ts';
import { zustandFragment } from '#cli/generation/eslint/fragments/zustand.ts';
import { reactDomFragment } from '#cli/generation/eslint/fragments/react-dom.ts';
import type { Manifest, ToolFileDeclaration } from '#cli/types/configurations.ts';
import { typescriptFragment } from '#cli/generation/eslint/fragments/typescript.ts';
import type { Fragment, TypescriptImports } from '#cli/types/generation/fragments.ts';
import { reactNativeFragment } from '#cli/generation/eslint/fragments/react-native.ts';
import { translationsFragment } from '#cli/generation/eslint/fragments/translations.ts';
import { isInScope, nestedScopes, projectDependencies } from '#cli/repository/scopes.ts';
import { tanstackQueryFragment } from '#cli/generation/eslint/fragments/tanstack-query.ts';
import { testingLibraryFragment } from '#cli/generation/eslint/fragments/testing-library.ts';

// The configurations whose fragments a target takes: a target written for one scope asks that scope, and a target
// written once asks every scope.
function fragmentConfigurations(
    scopes: ScopeSelection[],
    selection: ScopeSelection,
    target: ToolFileDeclaration,
): Manifest[] {
    if (target.per_scope) return selection.selected;
    const every = [selection, ...scopes].flatMap((entry) => entry.selected);
    return new Map(every.map((manifest) => [manifest.configuration.name, manifest])).values().toArray();
}

function emitFragment(manifest: Manifest, inputs: EslintFragmentInputs): string {
    const builder = (
        {
            astro: astroFragment,
            vue: vueFragment,
            svelte: svelteFragment,
            expo: expoFragment,
            nextjs: nextjsFragment,
            typescript: typescriptFragment,
            zustand: zustandFragment,
            'testing-library': testingLibraryFragment,
            jest: jestFragment,
            vitest: vitestFragment,
            react: reactFragment,
            'react-dom': reactDomFragment,
            'react-native': reactNativeFragment,
            nestjs: nestjsFragment,
            express: expressFragment,
            drizzle: drizzleFragment,
            zod: zodFragment,
            'tanstack-query': tanstackQueryFragment,
            translations: translationsFragment,
        } as Record<string, (inputs: EslintFragmentInputs) => string>
    )[manifest.configuration.name];
    return (builder as (values: EslintFragmentInputs) => string)(inputs);
}

// The text emitted by each selected ESLint fragment.
function emittedFragments(
    session: Session,
    fragments: Fragment[],
    inputs: EslintFragmentInputs,
    scopes: ScopeSelection[],
    target: ToolFileDeclaration,
): string[] {
    const emitted: string[] = [];
    for (const { manifest } of fragments) {
        if (!target.scope_fragments) {
            emitted.push(emitFragment(manifest, inputs));
            continue;
        }
        for (const selection of scopes.filter((entry) => entry.selected.includes(manifest))) {
            const scope = selection.scope.path;
            const children = nestedScopes(
                scopes.map((entry) => entry.scope.path),
                scope,
            );
            const selectedFiles = inputs
                .files('')
                .filter((path) => isInScope(path, scope) && children.every((child) => !isInScope(path, child)));
            const module = eslintModule({
                allRules: inputs.eslintAllRules,
                isAll: inputs.isAll,
                codeFiles: inputs.eslintFiles.code,
                ruleOptions: inputs.ruleOptions,
                scope: { path: scope, excluded: children.map((path) => `${literalGlob(path)}/**`) },
            });
            const fragment = emitFragment(manifest, {
                ...inputs,
                ...selection.view,
                scope,
                testFiles: selection.view.test_files,
                scopeDependencies: Object.keys(projectDependencies(session.packageManifests, scope)),
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
export function fragmentInputs(
    session: Session,
    scopes: ScopeSelection[],
    selection: ScopeSelection,
    target: ToolFileDeclaration,
    inputs: EslintFragmentInputs,
): {
    fragmentParts: string[];
    fragmentImports: string;
    fragmentSelectors: ReturnType<typeof fragmentSelectorGroups>;
    eslintFragmentBlocks: EslintFragmentInputs['eslintFragmentBlocks'];
    eslintModule: EslintFragmentInputs['eslintModule'];
    eslintFiles: EslintFragmentInputs['eslintFiles'];
} {
    const fragments = fragmentConfigurations(scopes, selection, target).flatMap((manifest) =>
        manifest.toolFiles
            .filter((toolFile) => toolFile.fragment && toolFile.target === target.target)
            .map((toolFile) => ({ manifest, toolFile })),
    );
    const config = target.scope_fragments ? inputs.eslint() : undefined;
    const eslintFiles =
        config === undefined
            ? inputs.eslintFiles
            : filePatterns({
                  components: fragments.map(({ manifest }) => manifest),
                  tests: config.testFiles,
                  scripts: config.scriptFiles,
                  nodeFiles: config.nodeFiles,
              });
    const eslintFragmentBlocks: EslintFragmentInputs['eslintFragmentBlocks'] = [];
    const emitted = emittedFragments(
        session,
        fragments,
        { ...inputs, eslintFragmentBlocks, eslintFiles },
        scopes,
        target,
    );
    const parsed = target.scope_fragments
        ? emitted.map((fragment) => typescriptImports(fragment))
        : emitted.map((body) => ({ body, imports: [] }));
    const imports = parsed.flatMap(({ imports }) => imports);
    const bodies = parsed.map(({ body }) => body);
    return {
        fragmentParts: bodies,
        fragmentImports: [...new Set(imports.filter((line) => line.trim() !== ''))].join('\n'),
        eslintFiles,
        eslintFragmentBlocks,
        eslintModule: eslintModule({
            allRules: inputs.eslintAllRules,
            isAll: inputs.isAll,
            codeFiles: eslintFiles.code,
            ruleOptions: inputs.ruleOptions,
        }),
        fragmentSelectors: fragmentSelectorGroups(scopes, inputs.isAll, inputs.repositorySettings.structure.reexports),
    };
}
