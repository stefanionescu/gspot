import { getTable } from '#cli/settings/scope-view.ts';
import { splitIdentity } from '#cli/parsers/lockfiles.ts';
import { joinScopeSelector } from '#cli/settings/paths.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { listApplicableTables } from '#cli/settings/inherit.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { JSON_INDENT } from '#cli/config/generation/generate.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations.ts';
import { listWorkspaceFolders } from '#cli/repository/npm/workspaces.ts';
import { isInScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import { listDistinctTools } from '#cli/configurations/declared-tools.ts';
import { convertToGlobs, buildIgnoreSections, listCheckIgnoreSections } from '#cli/generation/settings/ignore-files.ts';

import {
    KNIP_SCHEMA_URL,
    PACKAGE_RUNNERS,
    KNIP_ENTRY_SETTING,
    MISE_FILE_TASK_GLOBS,
    COMMAND_WORD_SEPARATORS,
    KNIP_IGNORED_DEPENDENCIES,
    KNIP_JAVASCRIPT_ENTRY_FILES,
} from '#cli/config/generation/settings/builders/knip.ts';

/**
 * Select your own and the declared entry files for each scope.
 *
 * @param settings the parsed gspot.toml.
 * @param scopes every scope.
 * @param scope the folder to select for.
 *
 * @returns entry patterns for each scope.
 */
function selectEntryFiles(settings: Settings, scopes: Scope[], scope: string): string[] {
    const authored = listApplicableTables(settings, scope).flatMap(({ table }) => {
        const entries = table.tools?.['knip']?.[KNIP_ENTRY_SETTING];
        return Array.isArray(entries) ? entries.filter((entry): entry is string => typeof entry === 'string') : [];
    });
    const declared = scopes
        .filter((entry) => isInScope(scope, entry.scope.path))
        .toSorted((left, right) => compareScopeDepth(right.scope.path, left.scope.path))
        .slice(0, 1)
        .flatMap(({ selected, view }) => [
            ...(selected.some((configuration) => configuration.name === JAVASCRIPT_CONFIGURATION)
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
function buildWorkspaces(repositoryRoot: string, settings: Settings, scopes: Scope[]) {
    const selected = scopes.filter(({ view }) => view.configurations.includes(JAVASCRIPT_CONFIGURATION));
    const paths = [...new Set(['', ...listWorkspaceFolders(repositoryRoot)])];
    return Object.fromEntries(
        paths.map((path) => {
            const workspace = selected.find((entry) => entry.scope.path === path);
            const ignored =
                workspace === undefined ? undefined : getTable(workspace.view, 'tools.knip').ignore_dependencies;
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

function findRunPackage(words: string[], index: number): string | undefined {
    const subcommands = PACKAGE_RUNNERS[words[index] ?? ''];
    if (subcommands === undefined) return undefined;
    const hasSubcommand = subcommands.length > 0;
    if (hasSubcommand && !subcommands.includes(words[index + 1] ?? '')) return undefined;
    return words.slice(index + 1 + Number(hasSubcommand)).find((candidate) => !candidate.startsWith('-'));
}

function listRunPackages(text: string): string[] {
    const words = text.split(COMMAND_WORD_SEPARATORS);
    return words.flatMap((_word, index) => {
        const target = findRunPackage(words, index);
        return target === undefined ? [] : [splitIdentity(target)?.[0] ?? target];
    });
}

// Knip reads the [tasks] of mise.toml but not mise file tasks, so a package that only a file task runs, such as bunx
// wrangler, reads as unused. Knip keeps each package that a project declares and a file task runs.
function listFileTaskPackages(planned: PlannedToolFile): string[] {
    const { files, dependencyFiles } = planned.session.repository;
    const isFileTask = buildPathMatcher([...MISE_FILE_TASK_GLOBS]);
    const declared = new Set(dependencyFiles.flatMap((file) => Object.keys(file.dependencies)));
    const names = files
        .filter((file) => file.kind === 'source' && isFileTask(file.path))
        .flatMap((file) => listRunPackages(readCachedText(planned.session.reads, file.path)));
    return [...new Set(names)]
        .filter((name) => declared.has(name))
        .toSorted((left, right) => left.localeCompare(right));
}

/**
 * Build the Knip file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the workspace entry points, project selectors, and dependency exclusions.
 */
export function buildKnipFile(planned: PlannedToolFile): string {
    const { selection } = planned;
    const { scopes, neededToolConfigurations: configurations } = planned.session;
    const { settingsFile, root, startRunner } = planned.session;
    const options = getTable(selection.view, 'tools.knip');
    const scanner = getTable(selection.view, 'dependencies').bun_scanner;
    const ignoredGlobs = convertToGlobs([
        ...buildIgnoreSections(planned.session),
        ...listCheckIgnoreSections(selection.view, 'javascript/knip'),
    ]);
    const tools = listDistinctTools(configurations);
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
            ignore: ignoredGlobs,
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
            ...(externals.length === 0 ? {} : { ignoreUnresolved: externals }),
            workspaces,
        },
        null,
        JSON_INDENT,
    );
}
