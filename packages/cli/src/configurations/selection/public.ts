import { posix } from 'node:path';
import { GspotError } from '#cli/platform/public.ts';
import { extensionOf } from '#cli/platform/contracts.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { unknownConfigurationDiagnostic } from '#cli/configurations/errors/public.ts';
import { isInScope, pathMatcher, byScopeDepth, filenameMatcher } from '#cli/repository/paths/public.ts';

import type {
    Manifest,
    FileMatch,
    SelectionWalk,
    ConfigurationSelection,
    SelectedConfigurations,
} from '#cli/types/configurations.ts';

// The owners with the file types of the selected Prettier or ESLint plugins, when the table takes them.
function effectiveOwners(owners: FileMatch, selected: Manifest[]): FileMatch {
    if (!owners.prettier_plugins && !owners.eslint_plugins) return owners;
    const extensions = selected
        .flatMap((manifest) => manifest.tools)
        .flatMap((tool) => [
            ...(owners.prettier_plugins ? (tool.prettier?.extensions ?? []) : []),
            ...(owners.eslint_plugins ? (tool.eslint?.extensions ?? []) : []),
        ]);
    return { ...owners, extensions: [...owners.extensions, ...extensions] };
}

// Selection: the configurations named plus every configuration they require, dependencies first, in order of first mention.

function visit(walk: SelectionWalk, configurationName: string): void {
    if (walk.seen.has(configurationName)) return;
    if (walk.visiting.includes(configurationName)) {
        const chain = [...walk.visiting.slice(walk.visiting.indexOf(configurationName)), configurationName];
        walk.errors.push(
            `The configurations require each other in a circle: ${chain.join(' -> ')}. This is a bug in a configuration manifest.`,
        );
        return;
    }
    const manifest = walk.manifests.get(configurationName);
    if (!manifest) {
        const known = walk.manifests.keys().toArray();
        walk.errors.push(unknownConfigurationDiagnostic(configurationName, known));
        walk.seen.add(configurationName);
        return;
    }
    walk.visiting.push(configurationName);
    for (const required of manifest.configuration.requires) visit(walk, required);
    walk.visiting.pop();
    walk.seen.add(configurationName);
    walk.order.push(manifest);
}

/**
 * True when the owners name this file, by extension, filename at any depth, tag, or path glob.
 * @param owners the owners table
 * @param file the file
 * @returns whether the owners cover the file
 */
export function isOwned(owners: FileMatch, file: TrackedFile): boolean {
    if (owners.extensions.includes(extensionOf(file.path))) return true;
    if (filenameMatcher(owners.filenames)(file.path)) return true;
    if (owners.tags.some((tag) => file.tags.includes(tag))) return true;
    return owners.paths.length > 0 && pathMatcher(owners.paths)(file.path);
}

/**
 * The files selected by a scoped owners table and its `kinds` and `languages` constraints.
 * @param table the owners table
 * @param selected the selected manifests, for languages and the Prettier plugins
 * @param files the tracked files
 * @param scope the scope path
 * @returns the files owned
 */
export function ownedBy(table: FileMatch, selected: Manifest[], files: TrackedFile[], scope: string): TrackedFile[] {
    const owners = effectiveOwners(table, selected);
    const candidates = files.filter((file) => isInScope(file.path, scope) && owners.kinds.includes(file.kind));
    const languages = owners.languages ? sourceConfigurations(selected) : [];
    return candidates.filter((file) => {
        const scopeFile = { ...file, path: posix.relative(scope, file.path) };
        return isOwned(owners, scopeFile) || languages.some((language) => isOwned(language.files, scopeFile));
    });
}

/**
 * Every selected configuration that owns a file.
 * @param file the file
 * @param selected the selected manifests
 * @returns the owning configurations
 */
export function ownersOf(file: TrackedFile, selected: Manifest[]): Manifest[] {
    return selected.filter((manifest) => ownedBy(manifest.files, selected, [file], '').length > 0);
}

/**
 * The chain of requirements from one configuration to another, without revisiting a declaration.
 * @param target the required configuration.
 * @param from the configuration the chain starts at.
 * @param manifests every configuration manifest.
 * @returns the configuration names along the chain from the starting configuration to the target, or undefined when no chain exists.
 */
export function requireChain(target: string, from: string, manifests: Map<string, Manifest>): string[] | undefined {
    const seen = new Set<string>();
    function search(current: string): string[] | undefined {
        if (current === target) return [current];
        if (seen.has(current)) return undefined;
        seen.add(current);
        for (const required of manifests.get(current)?.configuration.requires ?? []) {
            const rest = search(required);
            if (rest !== undefined) return [current, ...rest];
        }
        return undefined;
    }
    return search(from);
}

/**
 * Resolves configuration names to ordered manifests. Throws GspotError('selection') for unknown configurations or circular requirements.
 * @param configurationNames the requested configuration names.
 * @param manifests every configuration manifest.
 * @returns the manifests, requirements first, in order of first mention.
 */
export function selectConfigurations(configurationNames: string[], manifests: Map<string, Manifest>): Manifest[] {
    const walk: SelectionWalk = { manifests, errors: [], order: [], seen: new Set(), visiting: [] };
    for (const configurationName of configurationNames) visit(walk, configurationName);
    const { errors } = walk;
    if (errors.length > 0) throw new GspotError('selection', [...new Set(errors)]);
    return walk.order;
}

/**
 * The root selection and each ancestor scope selection, deduplicated in order.
 * @param policy the declared selections.
 * @param policy.configurations the configurations the root selects.
 * @param policy.scope the keyed scopes, each with its authored configuration choices.
 * @param policy.removed_configurations the manually removed configurations.
 * @param scope the scope path.
 * @param manifests every configuration manifest.
 * @returns the manifests in order.
 */
export function selectForScope(
    policy: ConfigurationSelection,
    scope: string,
    manifests: Map<string, Manifest>,
): Manifest[] {
    const automatic = manifests
        .values()
        .filter(
            (manifest) =>
                manifest.configuration.kind === 'general' &&
                manifest.configuration.always_selected &&
                manifest.configuration.when === undefined,
        )
        .map((manifest) => manifest.configuration.name)
        .toArray();
    const choices = new Set<string>();
    const tables = [
        policy,
        ...Object.entries(policy.scope)
            .filter(([ancestor]) => isInScope(scope, ancestor))
            .toSorted(([left], [right]) => byScopeDepth(left, right))
            .map(([, entry]) => entry),
    ];
    for (const table of tables) {
        for (const removed of table.removed_configurations) choices.delete(removed);
        for (const configuration of table.configurations) choices.add(configuration);
    }
    return selectConfigurations([...choices, ...automatic], manifests);
}

/**
 * Language and framework configurations that contribute source to shared checks.
 * @param selected the selected manifests.
 * @returns the source policy owners.
 */
export function sourceConfigurations(selected: Manifest[]): Manifest[] {
    return selected.filter(
        (manifest) => manifest.configuration.kind === 'language' || manifest.configuration.kind === 'framework',
    );
}

/**
 * Every distinct manifest across the scopes, in first-seen order.
 * @param scopes the selected scopes.
 * @returns the manifests.
 */
export function everyManifest(scopes: SelectedConfigurations[]): Manifest[] {
    const seen = new Map<string, Manifest>();
    for (const scope of scopes)
        for (const manifest of scope.selected)
            if (!seen.has(manifest.configuration.name)) seen.set(manifest.configuration.name, manifest);
    return seen.values().toArray();
}

/**
 * Tests whether any resolved scope selects a configuration.
 * @param scopes the validated scope selections
 * @param name the configuration name
 * @returns whether the configuration is selected in at least one scope
 */
export function isConfigurationSelected(scopes: SelectedConfigurations[], name: string): boolean {
    return scopes.some((selection) => selection.selected.some((manifest) => manifest.configuration.name === name));
}
