// Builds knip.json: the workspaces, their entry files, and what Knip leaves out.
import { JSON_INDENT } from '#cli/config/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { joinScopeSelector } from '#cli/settings/paths.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import { listApplicableTables } from '#cli/settings/inherit.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import { splitIdentity } from '#cli/parsers/projects/lockfiles.ts';
import { buildPathMatcher } from '#cli/repository/files/matchers.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { listWorkspaceFolders } from '#cli/repository/npm/workspaces.ts';
import { isInScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations/names.ts';

import {
    convertToGlobs,
    buildIgnoreSections,
    listCheckIgnoreSections,
} from '#cli/generation/config-files/ignore-files.ts';
import {
    KNIP_SCHEMA_URL,
    PACKAGE_RUNNERS,
    KNIP_ENTRY_SETTING,
    MISE_FILE_TASK_GLOBS,
    COMMAND_WORD_SEPARATORS,
    KNIP_IGNORED_DEPENDENCIES,
    KNIP_JAVASCRIPT_ENTRY_FILES,
} from '#cli/config/generation/configurations/language/javascript/knip.ts';

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
        .filter((entry) => isInScope(scope, entry.folder.path))
        .toSorted((left, right) => compareScopeDepth(right.folder.path, left.folder.path))
        .slice(0, 1)
        .flatMap(({ configurations, settings: scopeSettings }) => [
            ...(configurations.some((configuration) => configuration.name === JAVASCRIPT_CONFIGURATION)
                ? KNIP_JAVASCRIPT_ENTRY_FILES
                : []
            ).map((pattern) => joinScopeSelector(pattern, scope)),
            ...scopeSettings.test_files,
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
 * @param scopes every project scope.
 * @returns the workspace settings.
 */
function buildWorkspaces(repositoryRoot: string, settings: Settings, scopes: Scope[]) {
    const selected = scopes.filter(({ settings: scopeSettings }) =>
        scopeSettings.configurations.includes(JAVASCRIPT_CONFIGURATION),
    );
    const paths = [...new Set(['', ...listWorkspaceFolders(repositoryRoot)])];
    return Object.fromEntries(
        paths.map((path) => {
            const workspace = selected.find((entry) => entry.folder.path === path);
            const ignored =
                workspace === undefined ? undefined : getTable(workspace.settings, 'tools.knip').ignore_dependencies;
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
    return words.slice(index + 1 + Number(hasSubcommand)).find((word) => !word.startsWith('-'));
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
function listFileTaskPackages(planned: PlannedConfigFile): string[] {
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
 * Build knip.json: the workspace entry points, project selectors, and dependency exclusions.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the workspace entry points, project selectors, and dependency exclusions.
 */
export function buildKnipFile(planned: PlannedConfigFile): string {
    const { scope } = planned;
    const { scopes, neededToolConfigurations: configurations } = planned.session;
    const { settingsFile, root, startRunner } = planned.session;
    const options = getTable(scope.settings, 'tools.knip');
    const scanner = getTable(scope.settings, 'dependencies').bun_scanner;
    const ignoredGlobs = convertToGlobs([
        ...buildIgnoreSections(planned.session),
        ...listCheckIgnoreSections(scope.settings, 'javascript/knip'),
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
    const externals = [...new Set(scopes.flatMap(({ settings }) => settings.values.javascript?.externals ?? []))];
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
