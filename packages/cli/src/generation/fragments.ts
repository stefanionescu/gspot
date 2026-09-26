// What the selected fragments add to a generated target: rendered text, imports, file globs, and selectors.

// The configurations whose fragments a target takes: a target written for one scope asks that scope, and a target

import { eta } from '#cli/generation/registry.ts';
import { readAsset } from '#cli/platform/assets.ts';
import { selectorGroups } from '#cli/generation/eslint.ts';
import type { ScopeSelection } from '#cli/types/policy/policy.ts';
import type { ConfigurationTarget, FragmentSelector, Manifest } from '#cli/types/configurations.ts';
import type { Fragment, ResolvedSelector, SelectorGroup, TemplateInputs } from '#cli/types/generation.ts';

// written once asks every scope.
function fragmentOwners(scopes: ScopeSelection[], selection: ScopeSelection, owner: ConfigurationTarget): Manifest[] {
    if (owner.per_scope) return selection.selected;
    const every = [selection, ...scopes].flatMap((entry) => entry.selected);
    return new Map(every.map((manifest) => [manifest.configuration.name, manifest])).values().toArray();
}

// The fragment entries of a target across its owners, in configuration order, each with the manifest that holds it.
function fragmentsOf(scopes: ScopeSelection[], selection: ScopeSelection, owner: ConfigurationTarget): Fragment[] {
    return fragmentOwners(scopes, selection, owner).flatMap((manifest) =>
        manifest.configs
            .filter((config) => config.fragment && config.target === owner.target)
            .map((config) => ({ manifest, config })),
    );
}

// The rendered text of every fragment that has a template.
function renderedFragments(fragments: Fragment[], inputs: TemplateInputs): string {
    return fragments
        .flatMap(({ manifest, config }) =>
            config.template === undefined
                ? []
                : [eta.renderString(readAsset(`${manifest.dir}/${config.template}`), inputs)],
        )
        .join('\n');
}

// The import lines the fragments declare, each once, in configuration order.
function fragmentImports(fragments: Fragment[]): string {
    const lines = fragments.flatMap(({ manifest, config }) =>
        config.imports === undefined ? [] : readAsset(`${manifest.dir}/${config.imports}`).split('\n'),
    );
    return [...new Set(lines.filter((line) => line.trim() !== ''))].join('\n');
}

// The paths a loosening setting allows: every entry's paths, in the order written.
function allowedPaths(selection: ScopeSelection, setting: string): string[] {
    const value = selection.view.settings[setting];
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry: unknown) => {
        const paths = typeof entry === 'object' && entry !== null ? (entry as { paths?: unknown }).paths : undefined;
        return Array.isArray(paths) ? paths.filter((path): path is string => typeof path === 'string') : [];
    });
}

// The selectors the fragments add, grouped by the file set each one applies to.
function fragmentSelectors(fragments: Fragment[], selection: ScopeSelection): SelectorGroup[] {
    const resolved = fragments.flatMap(({ config }) =>
        config.selectors.map(
            (entry: FragmentSelector): ResolvedSelector => ({
                selector: entry.selector,
                message: entry.message,
                ...(entry.files === undefined ? {} : { files: entry.files }),
                ...(entry.allowed === undefined ? {} : { except: allowedPaths(selection, entry.allowed) }),
            }),
        ),
    );
    return selectorGroups(resolved);
}

/**
 * The template inputs a target's fragments contribute.
 * @param scopes every resolved scope
 * @param selection the scope the target is written for
 * @param owner the target
 * @param inputs the scope's template inputs, which the fragment templates render with
 * @returns the rendered fragments, their imports, file globs, and selector groups
 */
export function fragmentInputs(
    scopes: ScopeSelection[],
    selection: ScopeSelection,
    owner: ConfigurationTarget,
    inputs: TemplateInputs,
): Pick<TemplateInputs, 'fragments' | 'fragmentImports' | 'fragmentFiles' | 'fragmentSelectors'> {
    const fragments = fragmentsOf(scopes, selection, owner);
    return {
        fragments: renderedFragments(fragments, inputs),
        fragmentImports: fragmentImports(fragments),
        fragmentFiles: [...new Set(fragments.flatMap(({ config }) => config.code_files))],
        fragmentSelectors: fragmentSelectors(fragments, selection),
    };
}
