// What the selected fragments add to a generated target: emitted text, imports, file globs, and selectors.
import { eta } from '#cli/generation/eta.ts';
import { readAsset } from '#cli/platform/assets.ts';
import type { EtaInputs } from '#cli/types/generation/eta.ts';
import { typescriptImports } from '#cli/parsers/typescript.ts';
import type { Fragment } from '#cli/types/generation/fragments.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import { isInScope, nestedScopes } from '#cli/repository/selectors.ts';
import type { Manifest, ToolFileDeclaration } from '#cli/types/configurations.ts';
import { eslintModule, eslintFilePatterns } from '#cli/generation/eslint/serialize.ts';
import { eslintRuleOptions, fragmentSelectorGroups } from '#cli/generation/eslint/blocks.ts';

// The configurations whose fragments a target takes: a target written for one scope asks that scope, and a target
// written once asks every scope.
function fragmentOwners(scopes: ScopeSelection[], selection: ScopeSelection, target: ToolFileDeclaration): Manifest[] {
    if (target.per_scope) return selection.selected;
    const every = [selection, ...scopes].flatMap((entry) => entry.selected);
    return new Map(every.map((manifest) => [manifest.configuration.name, manifest])).values().toArray();
}

// The emitted text of every fragment that has a template.
function emittedFragments(fragments: Fragment[], inputs: EtaInputs, scopes: ScopeSelection[]): string[] {
    const emitted: string[] = [];
    for (const { manifest, toolFile } of fragments) {
        if (toolFile.source === undefined) continue;
        const source = readAsset(`${manifest.dir}/${toolFile.source}`);
        if (!toolFile.target.endsWith('eslint.config.mjs')) {
            emitted.push(eta.renderString(source, inputs));
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
            const template = eslintModule({
                allRules: inputs.eslintAllRules,
                isAll: inputs.isAll,
                codeFiles: inputs.eslintFiles.code,
                ruleOptions: eslintRuleOptions(inputs.policy),
                scope: { path: scope, excluded: children.map((path) => `${path}/**`) },
            });
            const fragment = eta.renderString(source, {
                ...inputs,
                ...selection.view,
                scope,
                scopeDependencies: inputs
                    .configurationScopes(manifest.configuration.name)
                    .flatMap((entry) => (entry.path === scope ? entry.dependencies : [])),
                eslintModule: template,
                files: (extension: string) => selectedFiles.filter((path) => path.endsWith(extension)),
            });
            inputs.eslintFragmentBlocks.push(...template.blocks);
            emitted.push(fragment);
        }
    }
    return emitted;
}

/**
 * The template inputs a target's fragments contribute.
 * @param scopes every resolved scope.
 * @param selection the scope the target is written for.
 * @param target the configuration target
 * @param inputs the scope's Eta inputs for emitting the fragments.
 * @returns the emitted fragments, their imports, file globs, and selector groups.
 */
export function fragmentInputs(
    scopes: ScopeSelection[],
    selection: ScopeSelection,
    target: ToolFileDeclaration,
    inputs: EtaInputs,
): Pick<
    EtaInputs,
    | 'fragments'
    | 'fragmentParts'
    | 'fragmentImports'
    | 'fragmentFiles'
    | 'fragmentSelectors'
    | 'eslintFragmentBlocks'
    | 'eslintModule'
    | 'eslintFiles'
> {
    const fragments = fragmentOwners(scopes, selection, target).flatMap((manifest) =>
        manifest.toolFiles
            .filter((toolFile) => toolFile.fragment && toolFile.target === target.target)
            .map((toolFile) => ({ manifest, toolFile })),
    );
    const config = target.target.endsWith('eslint.config.mjs') ? inputs.eslint() : undefined;
    const eslintFiles =
        config === undefined
            ? inputs.eslintFiles
            : eslintFilePatterns({
                  components: fragments.map(({ manifest }) => manifest),
                  tests: config.testFiles,
                  scripts: config.scriptFiles,
                  nodeFiles: config.nodeFiles,
              });
    const fragmentFiles = eslintFiles.fragmentFiles;
    const eslintFragmentBlocks: EtaInputs['eslintFragmentBlocks'] = [];
    const emitted = emittedFragments(
        fragments,
        { ...inputs, fragmentFiles, eslintFragmentBlocks, eslintFiles },
        scopes,
    );
    const parsed = target.target.endsWith('eslint.config.mjs')
        ? emitted.map((fragment) => typescriptImports(fragment))
        : emitted.map((body) => ({ body, imports: [] }));
    const imports = parsed.flatMap(({ imports }) => imports);
    const bodies = parsed.map(({ body }) => body);
    return {
        fragments: bodies.join('\n'),
        fragmentParts: bodies,
        fragmentImports: [...new Set(imports.filter((line) => line.trim() !== ''))].join('\n'),
        fragmentFiles,
        eslintFiles,
        eslintFragmentBlocks,
        eslintModule: eslintModule({
            allRules: inputs.eslintAllRules,
            isAll: inputs.isAll,
            codeFiles: eslintFiles.code,
            ruleOptions: eslintRuleOptions(inputs.policy),
        }),
        fragmentSelectors: fragmentSelectorGroups(scopes, target, inputs.isAll),
    };
}
