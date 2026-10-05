// What the selected fragments add to a generated target: rendered text, imports, file globs, and selectors.
import { eta } from '#cli/generation/templates.ts';
import { readAsset } from '#cli/platform/assets.ts';
import type { Fragment } from '#cli/types/generation/fragments.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import { isInScope, nestedScopes } from '#cli/repository/selectors.ts';
import type { TemplateInputs } from '#cli/types/generation/templates.ts';
import { fragmentSelectorGroups } from '#cli/generation/eslint/blocks.ts';
import type { Manifest, ConfigurationFile } from '#cli/types/configurations.ts';
import { eslintModule, eslintFilePatterns, eslintSourcePattern } from '#cli/generation/eslint/output.ts';

// The configurations whose fragments a target takes: a target written for one scope asks that scope, and a target
// written once asks every scope.
function fragmentOwners(scopes: ScopeSelection[], selection: ScopeSelection, target: ConfigurationFile): Manifest[] {
    if (target.scoped) return selection.selected;
    const every = [selection, ...scopes].flatMap((entry) => entry.selected);
    return new Map(every.map((manifest) => [manifest.configuration.name, manifest])).values().toArray();
}

// The rendered text of every fragment that has a template.
function renderedFragments(fragments: Fragment[], inputs: TemplateInputs, scopes: ScopeSelection[]): string {
    const rendered: string[] = [];
    for (const { manifest, config } of fragments) {
        if (config.template === undefined) continue;
        const source = readAsset(`${manifest.dir}/${config.template}`);
        if (!config.target.endsWith('eslint.config.mjs')) {
            rendered.push(eta.renderString(source, inputs));
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
            const template = eslintModule(
                inputs.eslintAllRules,
                inputs.isAll,
                [eslintSourcePattern('javascript', 'typescript'), ...inputs.fragmentFiles],
                {
                    path: scope,
                    excluded: children.map((path) => `${path}/**`),
                },
            );
            const fragment = eta.renderString(source, {
                ...inputs,
                ...selection.view,
                scope,
                eslintModule: template,
                files: (extension: string) => selectedFiles.filter((path) => path.endsWith(extension)),
            });
            inputs.eslintFragmentBlocks.push(...template.blocks);
            rendered.push(fragment);
        }
    }
    return rendered.join('\n');
}

/**
 * The template inputs a target's fragments contribute.
 * @param scopes every resolved scope.
 * @param selection the scope the target is written for.
 * @param target the configuration target
 * @param inputs the scope's template inputs, which the fragment templates render with.
 * @returns the rendered fragments, their imports, file globs, and selector groups.
 */
export function fragmentInputs(
    scopes: ScopeSelection[],
    selection: ScopeSelection,
    target: ConfigurationFile,
    inputs: TemplateInputs,
): Pick<
    TemplateInputs,
    | 'fragments'
    | 'fragmentImports'
    | 'fragmentFiles'
    | 'fragmentSelectors'
    | 'eslintFragmentBlocks'
    | 'eslintModule'
    | 'eslintFiles'
> {
    const fragments = fragmentOwners(scopes, selection, target).flatMap((manifest) =>
        manifest.configs
            .filter((config) => config.fragment && config.target === target.target)
            .map((config) => ({ manifest, config })),
    );
    const fragmentFiles = [...new Set(fragments.flatMap(({ config }) => config.component_globs))];
    const config = target.target.endsWith('eslint.config.mjs') ? inputs.eslint() : undefined;
    const eslintFiles =
        config === undefined
            ? inputs.eslintFiles
            : eslintFilePatterns(fragmentFiles, config.testFiles, config.scriptFiles);
    const eslintFragmentBlocks: TemplateInputs['eslintFragmentBlocks'] = [];
    const rendered = renderedFragments(
        fragments,
        { ...inputs, fragmentFiles, eslintFragmentBlocks, eslintFiles },
        scopes,
    );
    const imports = fragments.flatMap(({ manifest, config }) =>
        config.imports === undefined ? [] : readAsset(`${manifest.dir}/${config.imports}`).split('\n'),
    );
    return {
        fragments: rendered,
        fragmentImports: [...new Set(imports.filter((line) => line.trim() !== ''))].join('\n'),
        fragmentFiles,
        eslintFiles,
        eslintFragmentBlocks,
        eslintModule: eslintModule(inputs.eslintAllRules, inputs.isAll, [
            eslintSourcePattern('javascript', 'typescript'),
            ...fragmentFiles,
        ]),
        fragmentSelectors: fragmentSelectorGroups(scopes, fragments, inputs.isAll),
    };
}
