import { JSON_INDENT } from '#cli/config/text.ts';
import { compareText } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { joinScopeSelector } from '#cli/settings/paths.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { listApplicableTables } from '#cli/settings/inherit.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import { splitIdentity } from '#cli/parsers/projects/lockfiles.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { listWorkspaceFolders } from '#cli/repository/npm/workspaces.ts';
import { isInScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import type { Settings, TableSettings } from '#cli/types/settings/file.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { convertToGlobs, listIgnoreSections } from '#cli/generation/config-files/ignore-files.ts';

import {
    PACKAGE_RUNNERS,
    KNIP_ESLINT_CONFIG,
    MISE_FILE_TASK_GLOBS,
    COMMAND_WORD_SEPARATORS,
    KNIP_IGNORED_DEPENDENCIES,
    KNIP_JAVASCRIPT_ENTRY_FILES,
} from '#cli/config/generation/configurations/language/javascript/knip.ts';

function selectEntryFiles(settings: Settings, scopes: Scope[], scope: string): string[] {
    const authored = listApplicableTables(settings, scope).flatMap(
        ({ table }) => (table.tools?.knip as Partial<TableSettings<'tools.knip'>> | undefined)?.entry ?? [],
    );
    const nearest = scopes
        .filter((each) => isInScope(scope, each.folder.path))
        .toSorted((left, right) => compareScopeDepth(right.folder.path, left.folder.path))
        .slice(0, 1)
        .flatMap(({ configurations, settings: scopeSettings }) => [
            ...(configurations.some((configuration) => configuration.name === JAVASCRIPT_CONFIGURATION)
                ? KNIP_JAVASCRIPT_ENTRY_FILES
                : []
            ).map((pattern) => joinScopeSelector(pattern, scope)),
            ...scopeSettings.test_files,
            ...(scopeSettings.values.javascript?.script_files ?? []),
            ...(scope === '' ? [KNIP_ESLINT_CONFIG] : []),
        ]);
    const entries: string[] = [];
    const patterns = new Set([...authored, ...nearest]);
    for (const pattern of patterns) {
        const sign = pattern.startsWith('!') ? '!' : '';
        const source = sign === '' ? pattern : pattern.slice(1);
        if (scope === '' || source.startsWith('**/')) entries.push(pattern);
        else if (source.startsWith(`${scope}/`)) entries.push(`${sign}${source.slice(scope.length + 1)}`);
    }
    return entries;
}

function buildWorkspaces(repositoryRoot: string, settings: Settings, scopes: Scope[]) {
    const selected = scopes.filter(({ settings: scopeSettings }) =>
        scopeSettings.configurations.includes(JAVASCRIPT_CONFIGURATION),
    );
    const paths = [...new Set(['', ...listWorkspaceFolders(repositoryRoot)])];
    return Object.fromEntries(
        paths.map((path) => {
            const workspace = selected.find((each) => each.folder.path === path);
            const ignored =
                workspace === undefined ? undefined : getTable(workspace.settings, 'tools.knip').ignore_dependencies;
            return [
                path === '' ? '.' : path,
                {
                    entry: selectEntryFiles(settings, scopes, path),
                    ...(path !== '' && ignored !== undefined && { ignoreDependencies: ignored }),
                },
            ];
        }),
    );
}

function findRunPackage(words: string[], index: number): string | undefined {
    const subcommands = PACKAGE_RUNNERS[words[index] ?? ''];
    if (subcommands === undefined) return undefined;
    const hasSubcommand = subcommands.length > 0;
    return hasSubcommand && !subcommands.includes(words[index + 1] ?? '')
        ? undefined
        : words.slice(index + 1 + Number(hasSubcommand)).find((word) => !word.startsWith('-'));
}

function listRunPackages(text: string): string[] {
    const words = text.split(COMMAND_WORD_SEPARATORS);
    return words.flatMap((_word, index) => {
        const target = findRunPackage(words, index);
        return target === undefined ? [] : (splitIdentity(target)?.[0] ?? target);
    });
}

function listFileTaskPackages(planned: PlannedConfigFile): string[] {
    const { files, dependencyFiles } = planned.session.repository;
    const isFileTask = buildPathMatcher([...MISE_FILE_TASK_GLOBS]);
    const dependencyNames = new Set(dependencyFiles.flatMap((file) => Object.keys(file.dependencies)));
    const names = files
        .filter((file) => file.kind === 'source' && isFileTask(file.path))
        .flatMap((file) => listRunPackages(readCachedText(planned.session.reads, file.path)));
    return [...new Set(names)]
        .filter((name) => dependencyNames.has(name))
        .toSorted((left, right) => compareText(left, right));
}

/**
Build knip.json: the workspace entry points, project selectors, and dependency exclusions.

@param planned the config file with its scope, level, and target path.
@returns the workspace entry points, project selectors, and dependency exclusions.
*/
export function buildKnipFile(planned: PlannedConfigFile): string {
    const { scope } = planned;
    const { scopes, toolConfigurations: configurations } = planned.session;
    const { settingsFile, root, startRunner } = planned.session;
    const options = getTable(scope.settings, 'tools.knip');
    const scanner = getTable(scope.settings, 'dependencies').bun_scanner;
    const ignoredGlobs = convertToGlobs(listIgnoreSections(planned, 'javascript/knip'));
    const tools = listDistinctTools(configurations);
    const toolBinaries = [
        ...tools.filter((tool) => tool.kind !== 'library').map((tool) => tool.name),
        startRunner.name,
    ];
    const toolPackages = tools.flatMap((tool) => tool.installers['npm']?.name ?? []);
    const workspaces = buildWorkspaces(root, settingsFile.settings, scopes);
    const externals = [...new Set(scopes.flatMap(({ settings }) => settings.values.javascript?.externals ?? []))];
    return JSON.stringify(
        {
            ignore: ignoredGlobs.filter((pattern) => pattern !== KNIP_ESLINT_CONFIG),
            ignoreDependencies: [
                ...new Set([
                    ...KNIP_IGNORED_DEPENDENCIES,
                    ...toolPackages,
                    ...(scanner === undefined ? [] : [scanner]),
                    ...options.ignore_dependencies,
                    ...listFileTaskPackages(planned),
                ]),
            ],
            ignoreBinaries: [...new Set(toolBinaries)],
            ignoreExportsUsedInFile: planned.level !== 'all',
            ...(externals.length > 0 && { ignoreUnresolved: externals }),
            workspaces,
        },
        null,
        JSON_INDENT,
    );
}
