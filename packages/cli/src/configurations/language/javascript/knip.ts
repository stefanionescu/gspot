import { posix } from 'node:path';

import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations/blocks.ts';
import {
    COMMAND_WORD_SEPARATORS,
    HIDDEN_FILE_GLOB,
    KNIP_CHECK,
    KNIP_ESLINT_CONFIG,
    KNIP_IGNORED_DEPENDENCIES,
    KNIP_JAVASCRIPT_ENTRY_FILES,
    MISE_FILE_TASK_GLOBS,
    PACKAGE_RUNNERS,
    UNQUOTED_COMMENT,
} from '#cli/config/configurations/javascript.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import { convertToGlobs, listCheckIgnoreSections } from '#cli/configurations/ignores.ts';
import { listCodeTestFiles } from '#cli/configurations/language/javascript/eslint/files.ts';
import { splitIdentity } from '#cli/parsers/projects/lockfiles.ts';
import { listWorkspaceFolders } from '#cli/repository/javascript/workspaces.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import { listApplicableTables } from '#cli/settings/inherit.ts';
import { joinScopeSelector } from '#cli/settings/paths.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { readText } from '#cli/system/files/reads.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { compareText } from '#cli/system/text.ts';
import { listDistinctTools } from '#cli/tools/pins.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';
import type { Scope, Settings } from '#cli/types/settings.ts';

function buildScopePattern(pattern: string, scopePath: string): string | undefined {
    const sign = pattern.startsWith('!') ? '!' : '';
    const source = sign === '' ? pattern : pattern.slice(1);
    if (scopePath === '' || source.startsWith('**/')) return pattern;
    return source.startsWith(`${scopePath}/`) ? `${sign}${source.slice(scopePath.length + 1)}` : undefined;
}

function selectEntryFiles(settings: Settings, scopes: Scope[], scopePath: string): string[] {
    const authored = listApplicableTables(settings, scopePath).flatMap(({ table, scopePath: tableScopePath = '' }) =>
        (table.javascript?.entry_files ?? []).map((pattern) => joinScopeSelector(pattern, tableScopePath)),
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
    const entries = new Set([...authored, ...nearest]);
    return [...entries].flatMap((entry) => buildScopePattern(entry, scopePath) ?? []);
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
        .flatMap((file) => listRunPackages(readText(planned.session.cache, file.path)));
    return [...new Set(names)]
        .filter((name) => dependencyNames.has(name))
        .toSorted((left, right) => compareText(left, right));
}

/**
Build knip.json: the workspace entry points, project selectors, and dependency exclusions.

@param planned the config file to build.
*/
function buildKnipFile(planned: PlannedConfig): string {
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
            ignoreBinaries: [...new Set(toolBinaries).intersection(scriptWords)],
            ...(planned.level !== 'all' && { ignoreExportsUsedInFile: true }),
            ...(externals.length > 0 && { ignoreUnresolved: externals }),
            workspaces,
        },
        null,
        JSON_INDENT,
    );
}

export const KNIP_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'javascript/knip.json': buildKnipFile,
};
