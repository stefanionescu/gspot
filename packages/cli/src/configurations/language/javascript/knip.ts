import { posix } from 'node:path';
import { read } from '#cli/system/files/reads.ts';
import { compareText } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { listDistinctTools } from '#cli/tools/pins.ts';
import { joinScopeSelector } from '#cli/settings/paths.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import type { Scope, Settings } from '#cli/types/settings.ts';
import { listApplicableTables } from '#cli/settings/inherit.ts';
import { splitIdentity } from '#cli/parsers/projects/lockfiles.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations/blocks.ts';
import { listWorkspaceFolders } from '#cli/repository/javascript/workspaces.ts';
import { convertToGlobs, listCheckIgnoreSections } from '#cli/configurations/ignores.ts';
import { listCodeTestFiles } from '#cli/configurations/language/javascript/eslint/files.ts';

import {
    KNIP_CHECK,
    PACKAGE_RUNNERS,
    UNQUOTED_COMMENT,
    HIDDEN_FILE_GLOB,
    KNIP_ESLINT_CONFIG,
    MISE_FILE_TASK_GLOBS,
    COMMAND_WORD_SEPARATORS,
    KNIP_IGNORED_DEPENDENCIES,
    KNIP_JAVASCRIPT_ENTRY_FILES,
} from '#cli/config/configurations/javascript.ts';

function selectEntryFiles(settings: Settings, scopes: Scope[], scopePath: string): string[] {
    const authored = listApplicableTables(settings, scopePath).flatMap(({ table, scope = '' }) =>
        (table.javascript?.entry_files ?? []).map((pattern) => joinScopeSelector(pattern, scope)),
    );
    const nearest = scopes
        .filter((each) => each.path === selectScopePath(scopePath, scopes))
        .flatMap(({ configurations, settings: scopeSettings }) => [
            ...(configurations.some((configuration) => configuration.name === JAVASCRIPT_CONFIGURATION)
                ? KNIP_JAVASCRIPT_ENTRY_FILES
                : []
            ).map((pattern) => joinScopeSelector(pattern, scopePath)),
            ...listCodeTestFiles(scopeSettings.test_files),
            ...(scopeSettings.tables.javascript?.script_files ?? []),
            ...(scopePath === '' ? [KNIP_ESLINT_CONFIG] : []),
        ]);
    const entries: string[] = [];
    const patterns = new Set([...authored, ...nearest]);
    for (const pattern of patterns) {
        const sign = pattern.startsWith('!') ? '!' : '';
        const source = sign === '' ? pattern : pattern.slice(1);
        if (scopePath === '' || source.startsWith('**/')) entries.push(pattern);
        else if (source.startsWith(`${scopePath}/`)) entries.push(`${sign}${source.slice(scopePath.length + 1)}`);
    }
    return entries;
}

function buildWorkspaces(root: string, settings: Settings, scopes: Scope[]) {
    const selected = scopes.filter(({ settings: scopeSettings }) =>
        scopeSettings.configurations.includes(JAVASCRIPT_CONFIGURATION),
    );
    const paths = [...new Set(['', ...listWorkspaceFolders(root)])];
    return Object.fromEntries(
        paths.map((path) => {
            const workspace = selected.find((each) => each.path === path);
            const ignored =
                workspace === undefined
                    ? undefined
                    : getTable(workspace.settings, 'javascript').allowed_unused_dependencies;
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
    const words = text.replaceAll(UNQUOTED_COMMENT, '$1').split(COMMAND_WORD_SEPARATORS);
    return words.flatMap((_word, index) => {
        const target = findRunPackage(words, index);
        return target === undefined ? [] : (splitIdentity(target)?.[0] ?? target);
    });
}

function listFileTaskPackages(planned: PlannedConfig, dependencyNames: Set<string>): string[] {
    const { files } = planned.session.repository;
    const isFileTask = buildPathMatcher([...MISE_FILE_TASK_GLOBS]);
    const names = files
        .filter((file) => file.kind === 'source' && isFileTask(file.path))
        .flatMap((file) => listRunPackages(read(planned.session.cache, file.path)));
    return [...new Set(names)]
        .filter((name) => dependencyNames.has(name))
        .toSorted((left, right) => compareText(left, right));
}

/**
Build knip.json: the workspace entry points, project selectors, and dependency exclusions.

@param planned the config file to build.
*/
export function buildKnipFile(planned: PlannedConfig): string {
    const { scope } = planned;
    const { scopes, toolConfigurations: configurations } = planned.session;
    const { settings, root, startRunner } = planned.session;
    const options = getTable(scope.settings, 'javascript');
    const scanner = getTable(scope.settings, 'dependencies').bun_scanner;
    const ignoredGlobs = convertToGlobs([
        ...planned.ignoreSections,
        ...listCheckIgnoreSections(planned.scope.settings, KNIP_CHECK),
    ]);
    const { dependencyFiles } = planned.session.repository;
    const dependencyNames = new Set(dependencyFiles.flatMap((file) => Object.keys(file.dependencies)));
    const scriptWords = new Set(
        dependencyFiles
            .flatMap((file) => file.scripts ?? [])
            .flatMap((script) => script.split(COMMAND_WORD_SEPARATORS)),
    );
    const tools = listDistinctTools(configurations);
    const toolBinaries = [
        ...tools.filter((tool) => tool.kind !== 'package').map((tool) => tool.name),
        startRunner.name,
    ];
    const importedPackages = tools
        .filter((tool) => tool.kind === 'package')
        .flatMap((tool) => tool.installers['npm']?.name ?? [])
        .filter((name) => !dependencyNames.has(name));
    const workspaces = buildWorkspaces(root, settings, scopes);
    const externals = [...new Set(scopes.flatMap(({ settings }) => settings.tables.javascript?.externals ?? []))];
    return JSON.stringify(
        {
            ignore: listCodeTestFiles(ignoredGlobs).filter(
                (pattern) => pattern !== KNIP_ESLINT_CONFIG && !HIDDEN_FILE_GLOB.test(posix.basename(pattern)),
            ),
            ignoreDependencies: [
                ...new Set([
                    ...KNIP_IGNORED_DEPENDENCIES,
                    ...importedPackages,
                    ...(scanner === undefined ? [] : [scanner]),
                    ...options.allowed_unused_dependencies,
                    ...listFileTaskPackages(planned, dependencyNames),
                ]),
            ],
            ignoreBinaries: [...new Set(toolBinaries)].filter((name) => scriptWords.has(name)),
            ...(planned.level === 'all' ? {} : { ignoreExportsUsedInFile: true }),
            ...(externals.length > 0 && { ignoreUnresolved: externals }),
            workspaces,
        },
        null,
        JSON_INDENT,
    );
}
