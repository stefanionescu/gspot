// What the selected fragments add to a generated target: rendered text, imports, file globs, and selectors.

import { eta } from '#cli/generation/registry.ts';
import { readAsset } from '#cli/platform/assets.ts';
import type { ScopeSelection } from '#cli/types/policy/policy.ts';
import { selectorGroups } from '#cli/generation/eslint/blocks.ts';
import type { Manifest, FragmentSelector, ConfigurationTarget } from '#cli/types/kits.ts';
import type { Fragment, TemplateInputs, ResolvedSelector } from '#cli/types/generation.ts';

// The configurations whose fragments a target takes: a target written for one scope asks that scope, and a target
// written once asks every scope.
function fragmentOwners(scopes: ScopeSelection[], selection: ScopeSelection, owner: ConfigurationTarget): Manifest[] {
    if (owner.per_scope) return selection.selected;
    const every = [selection, ...scopes].flatMap((entry) => entry.selected);
    return new Map(every.map((manifest) => [manifest.kit.name, manifest])).values().toArray();
}

function scopeFragment(rendered: string, selection: ScopeSelection, scopes: ScopeSelection[]): string {
    const scope = selection.scope.path;
    const children = scopes
        .map((entry) => entry.scope.path)
        .filter((path) => path !== scope && (scope === '' || path.startsWith(`${scope}/`)));
    const pattern = scope === '' ? '**/*' : `${scope}/**/*`;
    const excluded = children.map((path) => `${path}/**`);
    return `...[${rendered}].map((entry) => ({ ...entry, files: (entry.files ?? CODE).map((files) => [...(Array.isArray(files) ? files : [files]), ${JSON.stringify(pattern)}]), ignores: [...(entry.ignores ?? []), ...${JSON.stringify(excluded)}] })),`;
}

// The rendered text of every fragment that has a template.
function renderedFragments(fragments: Fragment[], inputs: TemplateInputs, scopes: ScopeSelection[]): string {
    return fragments
        .flatMap(({ manifest, config }) => {
            if (config.template === undefined) return [];
            const source = readAsset(`${manifest.dir}/${config.template}`);
            if (!config.target.endsWith('eslint.config.mjs')) return [eta.renderString(source, inputs)];
            return scopes
                .filter((scope) => scope.selected.includes(manifest))
                .map((selection) => {
                    const rendered = eta.renderString(source, { ...inputs, ...selection.view });
                    return scopeFragment(rendered, selection, scopes);
                });
        })
        .join('\n');
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

/**
 * The template inputs a target's fragments contribute.
 * @param scopes every resolved scope.
 * @param selection the scope the target is written for.
 * @param owner the target.
 * @param inputs the scope's template inputs, which the fragment templates render with.
 * @returns the rendered fragments, their imports, file globs, and selector groups.
 */
export function fragmentInputs(
    scopes: ScopeSelection[],
    selection: ScopeSelection,
    owner: ConfigurationTarget,
    inputs: TemplateInputs,
): Pick<TemplateInputs, 'fragments' | 'fragmentImports' | 'fragmentFiles' | 'fragmentSelectors'> {
    const fragments = fragmentOwners(scopes, selection, owner).flatMap((manifest) =>
        manifest.configs
            .filter((config) => config.fragment && config.target === owner.target)
            .map((config) => ({ manifest, config })),
    );
    const rendered = renderedFragments(fragments, inputs, scopes);
    const imports = fragments.flatMap(({ manifest, config }) =>
        config.imports === undefined ? [] : readAsset(`${manifest.dir}/${config.imports}`).split('\n'),
    );
    return {
        fragments: rendered,
        fragmentImports: [...new Set(imports.filter((line) => line.trim() !== ''))].join('\n'),
        fragmentFiles: [...new Set(fragments.flatMap(({ config }) => config.code_files))],
        fragmentSelectors: scopes.flatMap((scope) => {
            const resolved = fragments
                .filter(({ manifest }) => scope.selected.includes(manifest))
                .flatMap(({ config }) =>
                    config.selectors
                        .filter((entry) => inputs.isAll || entry.level === 'recommended')
                        .map(
                            (entry: FragmentSelector): ResolvedSelector => ({
                                selector: entry.selector,
                                message: entry.message,
                                ...(entry.files === undefined ? {} : { files: entry.files }),
                                ...(entry.allowed === undefined ? {} : { except: allowedPaths(scope, entry.allowed) }),
                            }),
                        ),
                );
            return selectorGroups(resolved).map((group) => ({
                ...group,
                scope: scope.scope.path,
                ignoredScopes: scopes
                    .map((entry) => entry.scope.path)
                    .filter(
                        (path) =>
                            path !== scope.scope.path &&
                            (scope.scope.path === '' || path.startsWith(`${scope.scope.path}/`)),
                    ),
            }));
        }),
    };
}
