// Selects scope configurations and the files their tables cover.
import { posix } from 'node:path';
import { extractExtension } from '#cli/system/paths.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { isInScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import { selectConfigurations, sourceConfigurations } from '#cli/configurations/select.ts';
import { SETTING_PLACEHOLDER, TEST_FILES_PLACEHOLDER } from '#cli/config/configurations.ts';
import type { FileMatch, ConfigurationSelection } from '#cli/types/repository/selection.ts';
import { escapeGlob, buildPathMatcher, buildFilenameMatcher } from '#cli/repository/matchers.ts';

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

// Build both pattern matchers once for a configuration's file table.
function fileMatchers(table: FileMatch) {
    return { table, filenames: buildFilenameMatcher(table.filenames), paths: buildPathMatcher(table.paths) };
}

/**
 * True when the file patterns match this file, by extension, filename at any depth, tag, or path glob.
 * @param owners the file patterns.
 * @param file the file.
 * @param filenames the prebuilt filename matcher.
 * @param paths the prebuilt path matcher.
 * @returns whether the patterns cover the file.
 */
export function isCovered(
    owners: FileMatch,
    file: TrackedFile,
    filenames: (path: string) => boolean,
    paths: (path: string) => boolean,
): boolean {
    if (owners.extensions.includes(extractExtension(file.path))) return true;
    if (filenames(file.path)) return true;
    if (owners.tags.some((tag) => file.tags.includes(tag))) return true;
    return paths(file.path);
}

/**
 * The files selected by file patterns for one scope and its `kinds` and `languages` constraints.
 * @param table the file patterns.
 * @param selected manifests that declare languages and Prettier plugins.
 * @param files the tracked files.
 * @param scope the scope path.
 * @param testFiles the configured repository-relative test paths.
 * @param settings the settings for the scope, with repository-relative path values.
 * @returns the files owned.
 */
export function listCoveredFiles(
    table: FileMatch,
    selected: Manifest[],
    files: TrackedFile[],
    scope: string,
    testFiles: string[],
    settings: Record<string, unknown>,
): TrackedFile[] {
    const ownsTests = table.paths.includes(TEST_FILES_PLACEHOLDER);
    const tests = buildPathMatcher(testFiles);
    const defaults: FileMatch[] = [];
    const settingPatterns = table.paths.flatMap((path) => {
        if (path === TEST_FILES_PLACEHOLDER) return [];
        const name = [...path.matchAll(SETTING_PLACEHOLDER)][0]?.groups?.['name'];
        if (name === undefined) return [];
        const value = settings[name];
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
    const filenames = buildFilenameMatcher(owners.filenames);
    const paths = buildPathMatcher(owners.paths);
    const defaultMatchers = defaults.map((table) => fileMatchers(table));
    const languages = (owners.languages ? sourceConfigurations(selected) : []).map(({ files }) => fileMatchers(files));
    return candidates.filter((file) => {
        const scopeFile = { ...file, path: posix.relative(scope, file.path) };
        return (
            (ownsTests && tests(file.path)) ||
            settingMatches(file.path) ||
            isCovered(owners, scopeFile, filenames, paths) ||
            [...defaultMatchers, ...languages].some((match) =>
                isCovered(match.table, scopeFile, match.filenames, match.paths),
            )
        );
    });
}

/**
 * The root selection and each ancestor scope selection, deduplicated in order.
 * @param settings the declared selections.
 * @param settings.configurations the configurations the root selects.
 * @param settings.scope the keyed scopes, each with its written configuration choices.
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
        ...Object.entries(settings.scope)
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
