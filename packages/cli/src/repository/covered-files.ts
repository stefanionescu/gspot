import { posix } from 'node:path';
import { isInScope } from '#cli/repository/scopes.ts';
import { extractExtension } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { BACKSLASH_BEFORE_MATCH } from '#cli/config/text.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { GLOB_SPECIAL_CHARACTERS } from '#cli/config/system/paths.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { filterSourceConfigurations } from '#cli/configurations/select.ts';
import { buildPathMatcher, buildFilenameMatcher } from '#cli/repository/matchers.ts';
import type { FileMatch, CoveredFilesOptions } from '#cli/types/repository/detection.ts';
import { SETTING_PLACEHOLDER, TEST_FILES_PLACEHOLDER } from '#cli/config/placeholders.ts';

// Add the file types of the Prettier or ESLint plugins in use to the owners, when the table takes them.
function addPluginExtensions(owners: FileMatch, configurations: Configuration[]): FileMatch {
    if (!owners.prettier_plugins && !owners.eslint_plugins) return owners;
    const extensions = configurations
        .flatMap((configuration) => configuration.tools)
        .flatMap((tool) => [
            ...(owners.prettier_plugins ? (tool.prettier?.extensions ?? []) : []),
            ...(owners.eslint_plugins ? (tool.eslint?.extensions ?? []) : []),
        ]);
    return { ...owners, extensions: [...owners.extensions, ...extensions] };
}

/**
 * Build one matcher for the extensions, filenames, tags, and paths of a files table.
 *
 * @param table the file patterns.
 * @returns a test of whether a tracked file matches.
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
 * List the files that the patterns match in one scope, within its `kinds` and `languages` limits.
 *
 * @param table the file patterns.
 * @param files the tracked inventory.
 * @param options the scope to match in.
 * @param options.configurations configurations that declare languages and Prettier plugins.
 * @param options.scopePath the folder to match in.
 * @param options.settings settings and repository-relative test paths for the scope.
 * @returns the matching files.
 */
export function listCoveredFiles(
    table: FileMatch,
    files: TrackedFile[],
    { configurations, scopePath: scope, settings }: CoveredFilesOptions,
): TrackedFile[] {
    const ownsTests = table.paths.includes(TEST_FILES_PLACEHOLDER);
    const tests = buildPathMatcher(settings.test_files);
    const defaults: FileMatch[] = [];
    const settingPatterns = table.paths.flatMap((path) => {
        if (path === TEST_FILES_PLACEHOLDER) return [];
        const name = [...path.matchAll(SETTING_PLACEHOLDER)][0]?.groups?.['name'];
        if (name === undefined) return [];
        const value = settings.settings[name];
        if (typeof value === 'string')
            return [
                path.replace(SETTING_PLACEHOLDER, () =>
                    value.replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH),
                ),
            ];
        defaults.push(
            ...configurations
                .filter((configuration) => configuration.name === name.split('.', 1)[0])
                .map((configuration) => configuration.files),
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
        configurations,
    );
    const scopeFiles = files.filter((file) => isInScope(file.path, scope) && owners.kinds.includes(file.kind));
    const matches = [
        owners,
        ...defaults,
        ...(owners.languages ? filterSourceConfigurations(configurations).map(({ files }) => files) : []),
    ].map((table) => buildFileMatcher(table));
    return scopeFiles.filter((file) => {
        const scopeFile = { ...file, path: posix.relative(scope, file.path) };
        return (
            (ownsTests && tests(file.path)) || settingMatches(file.path) || matches.some((match) => match(scopeFile))
        );
    });
}

/**
 * Select source paths by extension or whole file name.
 *
 * @param files the classified inventory.
 * @param endings the extensions or file names to select; every source file when absent.
 * @returns the matching source paths.
 */
export function listSourcePaths(files: TrackedFile[], endings: readonly string[]): string[] {
    return files
        .filter(
            (file) =>
                file.kind === 'source' &&
                endings.some((ending) =>
                    ending.startsWith('.')
                        ? file.path.endsWith(ending)
                        : file.path === ending || file.path.endsWith(`/${ending}`),
                ),
        )
        .map((file) => file.path);
}

/**
 * List the files covered by another check in the selected configurations.
 *
 * @param planned the planned scope and its candidate files.
 * @param checkId the declaration whose coverage to apply.
 * @returns the matching tracked files.
 */
export function listCheckFiles(planned: PlannedCheck, checkId: string): TrackedFile[] {
    return planned.scope.configurations.flatMap((configuration) =>
        configuration.checks
            .filter((check) => check.id === checkId)
            .flatMap((check) =>
                listCoveredFiles(check.files ?? configuration.files, planned.files, {
                    configurations: planned.scope.configurations,
                    scopePath: planned.scope.folder.path,
                    settings: planned.scope.settings,
                }),
            ),
    );
}
