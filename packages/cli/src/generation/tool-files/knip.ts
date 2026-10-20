// Find the entry files of a folder: the ones in the settings, then the ones that the configurations of the nearest scope know.

import { joinScopeSelector } from '#cli/settings/paths.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { JSON_INDENT } from '#cli/config/generation/files.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { listApplicableTables } from '#cli/settings/inherit.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import { splitIdentity } from '#cli/parsers/lockfile-packages.ts';
import { listIgnoredGlobs } from '#cli/generation/ignore-files.ts';
import { listWorkspaceFolders } from '#cli/repository/packages.ts';
import { type ToolFileContext } from '#cli/types/generation/files.ts';
import { isInScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import type { Settings, ScopeSelection } from '#cli/types/settings/values.ts';

import {
    KNIP_SCHEMA_URL,
    PACKAGE_RUNNERS,
    KNIP_ENTRY_SETTING,
    MISE_FILE_TASK_GLOBS,
    COMMAND_WORD_SEPARATORS,
    KNIP_IGNORED_DEPENDENCIES,
    KNIP_JAVASCRIPT_ENTRY_FILES,
} from '#cli/config/generation/tool-files.ts';

/**
 * Select your own and the declared entry files for each scope.
 *
 * @param settings the parsed gspot.toml.
 * @param scopes every scope.
 * @param scope the folder to select for.
 *
 * @returns entry patterns for each scope.
 */
function selectEntryFiles(settings: Settings, scopes: ScopeSelection[], scope: string): string[] {
    const authored = listApplicableTables(settings, scope).flatMap(({ table }) => {
        const entries = table.tools?.['knip']?.[KNIP_ENTRY_SETTING];
        return Array.isArray(entries) ? entries.filter((entry): entry is string => typeof entry === 'string') : [];
    });
    const declared = scopes
        .filter((entry) => isInScope(scope, entry.scope.path))
        .toSorted((left, right) => compareScopeDepth(right.scope.path, left.scope.path))
        .slice(0, 1)
        .flatMap(({ selected, view }) => [
            ...(selected.some((manifest) => manifest.configuration.name === 'javascript')
                ? KNIP_JAVASCRIPT_ENTRY_FILES
                : []
            ).map((pattern) => joinScopeSelector(pattern, scope)),
            ...view.test_files,
        ]);
    return [...new Set([...authored, ...declared])].flatMap((pattern) => {
        const sign = pattern.startsWith('!') ? '!' : '';
        const source = sign === '' ? pattern : pattern.slice(1);
        if (scope === '' || source.startsWith('**/')) return [pattern];
        return source.startsWith(`${scope}/`) ? [`${sign}${source.slice(scope.length + 1)}`] : [];
    });
}

/**
 * Build Knip workspace entries and scoped dependency exclusions.
 *
 * @param repositoryRoot the folder whose package.json files declare the workspaces.
 * @param settings the validated gspot.toml.
 * @param scopes every project selection.
 *
 * @returns the workspace settings.
 */
function buildWorkspaces(repositoryRoot: string, settings: Settings, scopes: ScopeSelection[]) {
    const selected = scopes.filter(({ view }) => view.configurations.includes('javascript'));
    const paths = [...new Set(['', ...listWorkspaceFolders(repositoryRoot)])];
    return Object.fromEntries(
        paths.map((path) => {
            const workspace = selected.find((entry) => entry.scope.path === path);
            const ignored = workspace?.view.options('tools.knip').ignore_dependencies;
            return [
                path === '' ? '.' : path,
                {
                    entry: selectEntryFiles(settings, scopes, path),
                    ...(path !== '' && ignored !== undefined ? { ignoreDependencies: ignored } : {}),
                },
            ];
        }),
    );
}
function findRunTarget(words: string[], index: number): string | undefined {
    const subcommands = PACKAGE_RUNNERS[words[index] ?? ''];
    if (subcommands === undefined) return undefined;
    const hasSubcommand = subcommands.length > 0;
    if (hasSubcommand && !subcommands.includes(words[index + 1] ?? '')) return undefined;
    return words.slice(index + 1 + Number(hasSubcommand)).find((candidate) => !candidate.startsWith('-'));
}

function listRunPackages(text: string): string[] {
    const words = text.split(COMMAND_WORD_SEPARATORS);
    return words.flatMap((_word, index) => {
        const target = findRunTarget(words, index);
        return target === undefined ? [] : [splitIdentity(target)?.[0] ?? target];
    });
}

// Knip reads the [tasks] of mise.toml but not mise file tasks, so a package that only a file task runs, such as bunx
// wrangler, reads as unused. Knip keeps each package that a project declares and a file task runs.
function listFileTaskPackages(context: ToolFileContext): string[] {
    const { files, dependencyFiles } = context.session.repository;
    const isFileTask = buildPathMatcher([...MISE_FILE_TASK_GLOBS]);
    const declared = new Set(dependencyFiles.flatMap((file) => Object.keys(file.dependencies)));
    const names = files
        .filter((file) => file.kind === 'source' && isFileTask(file.path))
        .flatMap((file) => listRunPackages(readCachedText(context.session.reads, file.path) ?? ''));
    return [...new Set(names)]
        .filter((name) => declared.has(name))
        .toSorted((left, right) => left.localeCompare(right));
}

/**
 * Build the Knip file from the settings.
 *
 * @param context the tool file to build.
 * @returns the workspace entry points, project selectors, and dependency exclusions.
 */
function buildKnipFile(context: ToolFileContext): string {
    const { selection } = context;
    const { scopes, neededToolManifests: manifests } = context.session;
    const { settingsFile, root, startRunner } = context.session;
    const { extra } = selection.view;
    const options = selection.view.options('tools.knip');
    const scanner = selection.view.options('dependencies').bun_scanner;
    const ignoredPaths = listIgnoredGlobs(context.session, selection.view, 'javascript/knip');
    const tools = listDistinctTools(manifests);
    const toolBinaries = [
        ...tools.filter((tool) => tool.kind !== 'library').map((tool) => tool.name),
        startRunner.name,
    ];
    const toolPackages = tools.flatMap((tool) =>
        tool.installers['npm']?.name === undefined ? [] : [tool.installers['npm'].name],
    );
    const workspaces = buildWorkspaces(root, settingsFile.settings, scopes);
    const externals = [...new Set(scopes.flatMap(({ view }) => view.values.javascript?.externals ?? []))];
    return JSON.stringify(
        {
            $schema: KNIP_SCHEMA_URL,
            ignore: ignoredPaths,
            ignoreDependencies: [
                ...new Set([
                    ...KNIP_IGNORED_DEPENDENCIES,
                    ...toolPackages,
                    ...(scanner === undefined ? [] : [scanner]),
                    ...options.ignore_dependencies,
                    ...listFileTaskPackages(context),
                ]),
            ],
            ignoreBinaries: [...new Set(toolBinaries)],
            ignoreExportsUsedInFile: settingsFile.settings.level !== 'all',
            ...(externals.length === 0 ? {} : { ignoreUnresolved: externals }),
            workspaces,
            ...extra('knip'),
        },
        null,
        JSON_INDENT,
    );
}

export { buildKnipFile };
