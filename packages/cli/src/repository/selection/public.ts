import { posix } from 'node:path';
import { extensionOf } from '#cli/platform/contracts.ts';
import { TEST_FILES_PLACEHOLDER } from '#cli/config/configurations.ts';
import type { TrackedFile, FileDeclaration } from '#cli/types/repository/inventory.ts';
import { selectConfigurations, sourceConfigurations } from '#cli/configurations/public.ts';
import type { Manifest, FileMatch, ConfigurationSelection } from '#cli/types/configurations.ts';
import { isInScope, pathMatcher, byScopeDepth, filenameMatcher } from '#cli/repository/paths/public.ts';

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
 * @param testFiles the effective repository-relative test paths.
 * @returns the files owned
 */
export function ownedBy(
    table: FileMatch,
    selected: Manifest[],
    files: TrackedFile[],
    scope: string,
    testFiles: string[],
): TrackedFile[] {
    const ownsTests = table.paths.includes(TEST_FILES_PLACEHOLDER);
    const tests = pathMatcher(testFiles);
    const owners = effectiveOwners(
        { ...table, paths: table.paths.filter((path) => path !== TEST_FILES_PLACEHOLDER) },
        selected,
    );
    const candidates = files.filter((file) => isInScope(file.path, scope) && owners.kinds.includes(file.kind));
    const languages = owners.languages ? sourceConfigurations(selected) : [];
    return candidates.filter((file) => {
        const scopeFile = { ...file, path: posix.relative(scope, file.path) };
        return (
            (ownsTests && tests(file.path)) ||
            isOwned(owners, scopeFile) ||
            languages.some((language) => isOwned(language.files, scopeFile))
        );
    });
}

/**
 * Every selected configuration that owns a file.
 * @param file the file
 * @param selected the selected manifests
 * @param scope the owning scope path.
 * @param testFiles the effective repository-relative test paths.
 * @returns the owning configurations
 */
export function ownersOf(file: TrackedFile, selected: Manifest[], scope: string, testFiles: string[]): Manifest[] {
    return selected.filter((manifest) => ownedBy(manifest.files, selected, [file], scope, testFiles).length > 0);
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
 * Resolve authored declarations and generated paths of the configurations each scope selects.
 * @param declarations the authored file declarations
 * @param selected the actual manifests selected by each authored scope
 * @returns file declarations with internal configuration origins retained
 */
export function fileDeclarations(
    declarations: FileDeclaration[],
    selected: Map<string, Manifest[]>,
): FileDeclaration[] {
    return [
        ...declarations.filter((entry) => entry.kind !== 'generated' || entry.configuration === undefined),
        ...selected.entries().flatMap(([path, manifests]) =>
            manifests.flatMap(({ generated, configuration }) =>
                generated.length === 0
                    ? []
                    : [
                          {
                              kind: 'generated' as const,
                              configuration: configuration.name,
                              paths: generated.map((file) => posix.join(path, file)),
                          },
                      ],
            ),
        ),
    ];
}
