import type { Configuration } from '#cli/types/manifests.ts';
import { listPathTags } from '#cli/repository/files/classify.ts';
import { listSourceConfigurations } from '#cli/manifests/select.ts';
import { SETTING_PLACEHOLDER } from '#cli/config/repository/files.ts';
import { isInScope, escapeGlob, extractExtension } from '#cli/system/paths.ts';
import { buildPathMatcher, buildFilenameMatcher } from '#cli/system/matchers.ts';
import type { TrackedFile, CoveredFilesOptions } from '#cli/types/repository.ts';

function buildCoverageMatcher(
    table: Configuration['files'],
    { configurations, scopePath: scope, settings }: CoveredFilesOptions,
): (file: Pick<TrackedFile, 'path' | 'tags'>) => boolean {
    const isTestFile = buildPathMatcher(table.test_files ? settings.test_files : []);
    const defaults: Array<Configuration['files']> = [];
    const settingPatterns = table.paths.flatMap((path) => {
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
    const isSettingPath = buildPathMatcher(settingPatterns);
    const owners = addPluginExtensions(
        {
            ...table,
            paths: table.paths.filter((path) => path.matchAll(SETTING_PLACEHOLDER).toArray().length === 0),
        },
        configurations,
    );
    const matches = [
        owners,
        ...defaults,
        ...(owners.languages ? listSourceConfigurations(configurations).map(({ files }) => files) : []),
    ].map((files) => buildFileMatcher(files));
    return (file) => {
        const scopeFile = { ...file, path: scope === '' ? file.path : file.path.slice(scope.length + 1) };
        return isTestFile(file.path) || isSettingPath(file.path) || matches.some((match) => match(scopeFile));
    };
}

/**
Add the extensions that the selected Prettier and ESLint plugins read to a files table.

@param table the file patterns.
@param configurations the configurations whose tools can add extensions.
*/
export function addPluginExtensions(
    table: Configuration['files'],
    configurations: Configuration[],
): Configuration['files'] {
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
export function buildFileMatcher(table: Configuration['files']): (file: Pick<TrackedFile, 'path' | 'tags'>) => boolean {
    const isListedFilename = buildFilenameMatcher(table.filenames);
    const isListedPath = buildPathMatcher(table.paths);
    return (file) =>
        table.extensions.includes(extractExtension(file.path)) ||
        isListedFilename(file.path) ||
        table.tags.some((tag) => file.tags.includes(tag)) ||
        isListedPath(file.path);
}

/**
List the files that the patterns match in one scope, within its `kinds` and `languages` limits.

@param table the file patterns.
@param files the tracked inventory.
@param options the scope to match in.
*/
export function listCoveredFiles(
    table: Configuration['files'],
    files: TrackedFile[],
    options: CoveredFilesOptions,
): TrackedFile[] {
    const isCovered = buildCoverageMatcher(table, options);
    return files.filter(
        (file) => isInScope(file.path, options.scopePath) && table.kinds.includes(file.kind) && isCovered(file),
    );
}

/**
List the paths that the patterns match in one scope, for paths that have no file to read.

@param table the file patterns.
@param paths the root-relative paths.
@param options the scope to match in.
*/
export function listCoveredPaths(
    table: Configuration['files'],
    paths: string[],
    options: CoveredFilesOptions,
): string[] {
    const isCovered = buildCoverageMatcher(table, options);
    return paths.filter((path) => isInScope(path, options.scopePath) && isCovered({ path, tags: listPathTags(path) }));
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
