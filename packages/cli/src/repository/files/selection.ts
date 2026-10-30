import { isInScope } from '#cli/repository/scopes.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { SETTING_PLACEHOLDER } from '#cli/config/placeholders.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { escapeGlob, extractExtension } from '#cli/system/paths.ts';
import { filterSourceConfigurations } from '#cli/configurations/select.ts';
import { buildPathMatcher, buildFilenameMatcher } from '#cli/system/matchers.ts';
import { TEST_FILES_PLACEHOLDER } from '#cli/config/repository/files/selection.ts';
import type { TrackedFile, CoveredFilesOptions } from '#cli/types/repository/files.ts';

function addPluginExtensions(table: Configuration['files'], configurations: Configuration[]): Configuration['files'] {
    if (!table.prettier_plugins && !table.eslint_plugins) return table;
    const extensions = configurations
        .flatMap((configuration) => configuration.tools)
        .flatMap((tool) => [
            ...(table.prettier_plugins ? (tool.prettier?.extensions ?? []) : []),
            ...(table.eslint_plugins ? (tool.eslint?.extensions ?? []) : []),
        ]);
    return { ...table, extensions: [...table.extensions, ...extensions] };
}
/**
Build one matcher for the extensions, filenames, tags, and paths of a files table.

@param table the file patterns.
*/
export function buildFileMatcher(table: Configuration['files']): (file: TrackedFile) => boolean {
    const filenames = buildFilenameMatcher(table.filenames);
    const paths = buildPathMatcher(table.paths);
    return (file) =>
        table.extensions.includes(extractExtension(file.path)) ||
        filenames(file.path) ||
        table.tags.some((tag) => file.tags.includes(tag)) ||
        paths(file.path);
}
/**
List the files that the patterns match in one scope, within its `kinds` and `languages` limits.

@param table the file patterns.
@param files the tracked inventory.
@param options the scope to match in.
@param options.configurations configurations that declare languages and Prettier plugins.
@param options.scopePath the folder to match in.
@param options.settings settings and repository-relative test paths for the scope.
*/
export function listCoveredFiles(
    table: Configuration['files'],
    files: TrackedFile[],
    { configurations, scopePath: scope, settings }: CoveredFilesOptions,
): TrackedFile[] {
    const ownsTests = table.paths.includes(TEST_FILES_PLACEHOLDER);
    const tests = buildPathMatcher(settings.test_files);
    const defaults: Configuration['files'][] = [];
    const settingPatterns = table.paths.flatMap((path) => {
        if (path === TEST_FILES_PLACEHOLDER) return [];
        const name = path.matchAll(SETTING_PLACEHOLDER).toArray()[0]?.groups?.['name'];
        if (name === undefined) return [];
        const value = settings.valuesByKey[name];
        if (typeof value === 'string') return [path.replace(SETTING_PLACEHOLDER, () => escapeGlob(value))];
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
                (path) => path !== TEST_FILES_PLACEHOLDER && path.matchAll(SETTING_PLACEHOLDER).toArray().length === 0,
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
        const scopeFile = { ...file, path: scope === '' ? file.path : file.path.slice(scope.length + 1) };
        return (
            (ownsTests && tests(file.path)) || settingMatches(file.path) || matches.some((match) => match(scopeFile))
        );
    });
}
/**
Select source paths by extension or whole file name.

@param files the classified inventory.
@param endings the extensions or file names to select.
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
List the files that a check of the selected configurations covers.

@param planned the scope and its candidate files.
@param checkId the declaration whose coverage to apply.
*/
export function listCheckFiles(planned: Pick<PlannedCheck, 'scope' | 'files'>, checkId: string): TrackedFile[] {
    return planned.scope.configurations.flatMap((configuration) =>
        configuration.checks
            .filter((check) => check.id === checkId)
            .flatMap((check) =>
                listCoveredFiles(check.files ?? configuration.files, planned.files, {
                    configurations: planned.scope.configurations,
                    scopePath: planned.scope.path,
                    settings: planned.scope.settings,
                }),
            ),
    );
}
