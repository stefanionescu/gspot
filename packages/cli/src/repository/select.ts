// Selects files and configurations for a scope.
import { posix } from 'node:path';
import { extensionOf } from '#cli/system/paths.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { isInScope, byScopeDepth } from '#cli/repository/scopes.ts';
import { settingFilePatterns } from '#cli/repository/setting-paths.ts';
import { pathMatcher, filenameMatcher } from '#cli/repository/selectors.ts';
import type { TrackedFile, FileDeclaration } from '#cli/types/repository/inventory.ts';
import { selectConfigurations, sourceConfigurations } from '#cli/configurations/select.ts';
import { SETTING_PLACEHOLDER, TEST_FILES_PLACEHOLDER } from '#cli/config/configurations.ts';
import type { FileMatch, ConfigurationSelection } from '#cli/types/repository/selection.ts';

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
    return { table, filenames: filenameMatcher(table.filenames), paths: pathMatcher(table.paths) };
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
    if (owners.extensions.includes(extensionOf(file.path))) return true;
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
export function coveredBy(
    table: FileMatch,
    selected: Manifest[],
    files: TrackedFile[],
    scope: string,
    testFiles: string[],
    settings: Record<string, unknown>,
): TrackedFile[] {
    const ownsTests = table.paths.includes(TEST_FILES_PLACEHOLDER);
    const tests = pathMatcher(testFiles);
    const settingPaths = table.paths.filter(
        (path) => [...path.matchAll(SETTING_PLACEHOLDER)].length > 0 && path !== TEST_FILES_PLACEHOLDER,
    );
    const { paths: settingPatterns, defaults } = settingFilePatterns(settingPaths, selected, settings);
    const settingMatches = pathMatcher(settingPatterns);
    const owners = addPluginExtensions(
        {
            ...table,
            paths: table.paths.filter((path) => path !== TEST_FILES_PLACEHOLDER && !settingPaths.includes(path)),
        },
        selected,
    );
    const candidates = files.filter((file) => isInScope(file.path, scope) && owners.kinds.includes(file.kind));
    const filenames = filenameMatcher(owners.filenames);
    const paths = pathMatcher(owners.paths);
    const defaultMatchers = defaults.map((table) => fileMatchers(table));
    const languages = (owners.languages ? sourceConfigurations(selected) : []).map(({ files }) => fileMatchers(files));
    // eslint-disable-next-line complexity -- reason: One selection predicate combines configuration files, languages, settings paths, and test ownership without changing precedence.
    return candidates.filter((file) => {
        const scopeFile = { ...file, path: posix.relative(scope, file.path) };
        const selectedBySetting =
            settingMatches(file.path) ||
            defaultMatchers.some((defaultMatch) =>
                isCovered(defaultMatch.table, scopeFile, defaultMatch.filenames, defaultMatch.paths),
            ) ||
            (owners.paths.length > 0 && paths(scopeFile.path)) ||
            (ownsTests && tests(file.path));
        return settingPaths.length > 0
            ? selectedBySetting &&
                  (owners.extensions.length === 0 || owners.extensions.includes(extensionOf(file.path)))
            : (ownsTests && tests(file.path)) ||
                  isCovered(owners, scopeFile, filenames, paths) ||
                  languages.some((language) =>
                      isCovered(language.table, scopeFile, language.filenames, language.paths),
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
 * Resolve generated paths of the configurations each scope selects.
 * @param selected the actual manifests selected by each written scope.
 * @returns file declarations with internal configuration origins retained.
 */
export function fileDeclarations(selected: Map<string, Manifest[]>): FileDeclaration[] {
    return selected
        .entries()
        .flatMap(([path, manifests]) =>
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
        )
        .toArray();
}
