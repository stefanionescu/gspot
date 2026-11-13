import { SETTING_PLACEHOLDER } from '#cli/config/repository/files.ts';
import { listSourceConfigurations } from '#cli/manifests/select.ts';
import { listPathTags } from '#cli/repository/files/classify.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { extractExtension } from '#cli/system/paths.ts';
import { buildFilenameMatcher, buildPathMatcher, escapeGlob } from '#cli/system/patterns.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { CoverageScope, TrackedFile } from '#cli/types/repository.ts';

function buildCoverageMatcher(
    table: Configuration['files'],
    { configurations, path: scopePath, settings }: CoverageScope,
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
        const scopeFile = { ...file, path: scopePath === '' ? file.path : file.path.slice(scopePath.length + 1) };
        return isTestFile(file.path) || isSettingPath(file.path) || matches.some((match) => match(scopeFile));
    };
}

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

export function buildFileMatcher(table: Configuration['files']): (file: Pick<TrackedFile, 'path' | 'tags'>) => boolean {
    const isListedFilename = buildFilenameMatcher(table.filenames);
    const isListedPath = buildPathMatcher(table.paths);
    return (file) =>
        table.extensions.includes(extractExtension(file.path)) ||
        isListedFilename(file.path) ||
        table.tags.some((tag) => file.tags.includes(tag)) ||
        isListedPath(file.path);
}

export function listCoveredFiles(
    table: Configuration['files'],
    files: TrackedFile[],
    scope: CoverageScope,
): TrackedFile[] {
    const isCovered = buildCoverageMatcher(table, scope);
    return files.filter(
        (file) => isInScope(file.path, scope.path) && table.kinds.includes(file.kind) && isCovered(file),
    );
}

export function listCoveredPaths(table: Configuration['files'], paths: string[], scope: CoverageScope): string[] {
    const isCovered = buildCoverageMatcher(table, scope);
    return paths.filter((path) => isInScope(path, scope.path) && isCovered({ path, tags: listPathTags(path) }));
}

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
