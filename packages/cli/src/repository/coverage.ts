import { posix } from 'node:path';
import { extractExtension } from '#cli/system/paths.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { isInScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import { SETTING_PLACEHOLDER, TEST_FILES_PLACEHOLDER } from '#cli/config/configurations.ts';
import { selectConfigurations, filterSourceConfigurations } from '#cli/configurations/select.ts';
import { escapeGlob, buildPathMatcher, buildFilenameMatcher } from '#cli/repository/matchers.ts';
import type { FileMatch, FileCoverageOptions, ConfigurationSelection } from '#cli/types/repository/selection.ts';

// The owners with the file types of the selected Prettier or ESLint plugins, when the table takes them.
function addPluginExtensions(owners: FileMatch, selected: Manifest[]): FileMatch {
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
 * Build one matcher for the extensions, filenames, tags, and paths of a files table.
 * @param table the file patterns.
 * @returns the predicate for one tracked file.
 */
export function buildFileMatcher(table: FileMatch): (file: TrackedFile) => boolean {
    const filenames = buildFilenameMatcher(table.filenames);
    const paths = buildPathMatcher(table.paths);
    return (file) =>
        table.extensions.includes(extractExtension(file.path)) ||
        filenames(file.path) ||
        table.tags.some((tag) => file.tags.includes(tag)) ||
        paths(file.path);
}

/**
 * The files selected by file patterns for one scope and its `kinds` and `languages` constraints.
 * @param table the file patterns.
 * @param files the tracked files.
 * @param options the selected configurations, scope, and settings view.
 * @param options.selected manifests that declare languages and Prettier plugins.
 * @param options.scope the scope path.
 * @param options.view settings and repository-relative test paths for the scope.
 * @returns the files owned.
 */
export function listCoveredFiles(
    table: FileMatch,
    files: TrackedFile[],
    { selected, scope, view }: FileCoverageOptions,
): TrackedFile[] {
    const ownsTests = table.paths.includes(TEST_FILES_PLACEHOLDER);
    const tests = buildPathMatcher(view.test_files);
    const defaults: FileMatch[] = [];
    const settingPatterns = table.paths.flatMap((path) => {
        if (path === TEST_FILES_PLACEHOLDER) return [];
        const name = [...path.matchAll(SETTING_PLACEHOLDER)][0]?.groups?.['name'];
        if (name === undefined) return [];
        const value = view.settings[name];
        if (typeof value === 'string') return [path.replace(SETTING_PLACEHOLDER, () => escapeGlob(value))];
        defaults.push(
            ...selected
                .filter((manifest) => manifest.configuration.name === name.split('.', 1)[0])
                .map((manifest) => manifest.files),
        );
        return [];
    });
    const settingMatches = buildPathMatcher(settingPatterns);
    const owners = addPluginExtensions(
        {
            ...table,
            paths: table.paths.filter(
                (path) => path !== TEST_FILES_PLACEHOLDER && [...path.matchAll(SETTING_PLACEHOLDER)].length === 0,
            ),
        },
        selected,
    );
    const candidates = files.filter((file) => isInScope(file.path, scope) && owners.kinds.includes(file.kind));
    const matches = [
        owners,
        ...defaults,
        ...(owners.languages ? filterSourceConfigurations(selected).map(({ files }) => files) : []),
    ].map((table) => buildFileMatcher(table));
    return candidates.filter((file) => {
        const scopeFile = { ...file, path: posix.relative(scope, file.path) };
        return (
            (ownsTests && tests(file.path)) || settingMatches(file.path) || matches.some((match) => match(scopeFile))
        );
    });
}

/**
 * The root selection and each ancestor scope selection, deduplicated in order.
 * @param settings the declared selections.
 * @param settings.configurations the configurations the root selects.
 * @param settings.scopes the keyed scopes, each with its written configuration choices.
 * @param settings.removed_configurations the manually removed configurations.
 * @param scope the scope path.
 * @param manifests every configuration manifest.
 * @returns the manifests in order.
 */
export function selectForScope(
    settings: ConfigurationSelection,
    scope: string,
    manifests: Map<string, Manifest>,
): Manifest[] {
    const automatic = manifests
        .values()
        .filter(
            (manifest) =>
                manifest.configuration.group === 'general' &&
                manifest.configuration.always_selected &&
                manifest.configuration.when === undefined,
        )
        .map((manifest) => manifest.configuration.name)
        .toArray();
    const choices = new Set<string>();
    const tables = [
        settings,
        ...Object.entries(settings.scopes)
            .filter(([ancestor]) => isInScope(scope, ancestor))
            .toSorted(([left], [right]) => compareScopeDepth(left, right))
            .map(([, entry]) => entry),
    ];
    for (const table of tables) {
        for (const removed of table.removed_configurations) choices.delete(removed);
        for (const configuration of table.configurations) choices.add(configuration);
    }
    return selectConfigurations([...choices, ...automatic], manifests);
}

/**
 * Select source paths by extension or whole file name.
 * @param files the classified repository files.
 * @param endings the file extensions to select.
 * @returns the selected source paths.
 */
export function listSourcePaths(files: TrackedFile[], endings?: readonly string[]): string[] {
    return files
        .filter(
            (file) =>
                file.kind === 'source' &&
                (endings === undefined ||
                    endings.some((ending) =>
                        ending.startsWith('.')
                            ? file.path.endsWith(ending)
                            : file.path === ending || file.path.endsWith(`/${ending}`),
                    )),
        )
        .map((file) => file.path);
}
