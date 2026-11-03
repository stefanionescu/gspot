import semver from 'semver';
import type { Scope } from '#cli/types/settings.ts';
import { findText } from '#cli/system/files/reads.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool, findPackagePin } from '#cli/tools/pins.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import type { PrettierPlugin } from '#cli/types/engine/plan.ts';
import type { ScopeCheck, SessionBase } from '#cli/types/tools.ts';
import { isSettingEmpty, findSystemSkip } from '#cli/engine/skips.ts';
import { listSelectedConfigurations } from '#cli/manifests/select.ts';
import { ESLINT_MANIFEST_TOOL } from '#cli/config/repository/setup.ts';
import { readLockedVersions } from '#cli/parsers/projects/lockfiles.ts';
import { isCoverageOff, hasCoverageArguments } from '#cli/engine/plan.ts';
import type { Tool, Check, Configuration } from '#cli/types/manifests.ts';
import { PACKAGE_JSON, JAVASCRIPT_LOCKFILES } from '#cli/config/parsers.ts';

const TYPESCRIPT_PACKAGE = 'typescript';

const TYPESCRIPT_ESLINT_TOOL = 'typescript-eslint';

/**
Read the TypeScript version that the tracked root lockfile resolves. An untracked lockfile does not count, so every
clone reads the same version.

@param session the repository files and the run cache.
*/
function readLockedTypescript(session: Pick<SessionBase, 'cache' | 'repository'>): string | undefined {
    const { cache, repository } = session;
    const tracked = new Set(
        (repository.index.length === 0 ? repository.files : repository.index).map(({ path }) => path),
    );
    const lockfile = JAVASCRIPT_LOCKFILES.find((name) => findText(cache, name) !== undefined);
    if (lockfile === undefined || !tracked.has(lockfile)) return undefined;
    return semver.valid(readLockedVersions(cache, '')?.get(TYPESCRIPT_PACKAGE)) ?? undefined;
}

/**
Read the TypeScript version that the root package.json declares: an exact version as written, or for a range the
version that the tracked root lockfile resolves.

@param session the repository files and the run cache.
@returns undefined when the root declares no TypeScript, or no version can be read.
*/
function readProjectTypescript(session: Pick<SessionBase, 'cache' | 'repository'>): string | undefined {
    const root = session.repository.dependencyFiles.find(({ path }) => path === PACKAGE_JSON);
    const specifier = root?.installed[TYPESCRIPT_PACKAGE];
    if (specifier === undefined) return undefined;
    return semver.valid(specifier) ?? readLockedTypescript(session);
}

function isToolUsed(scopes: Scope[], conditions: Tool['when']): boolean {
    return (
        conditions === undefined ||
        scopes.some((scope) => {
            const values = scope.settings.valuesByKey;
            return conditions.some(
                (condition) =>
                    (condition.level === undefined || condition.level === values['level']) &&
                    (condition.setting === undefined || !isSettingEmpty(values[condition.setting])),
            );
        })
    );
}

function addPeerPackages(names: Set<string>, configurations: readonly Configuration[]): void {
    const pending = [...names];
    for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
        const peers = findPackagePin(getTool(configurations, name))?.requires ?? [];
        for (const peer of peers) {
            if (names.has(peer)) continue;
            names.add(peer);
            pending.push(peer);
        }
    }
}

/**
List the secondary tools that the command and the configuration of a check use.

@param scope where the check runs.
@param check the check to read.
@param command the arguments that run, if known.
@returns each secondary tool once.
*/
export function listSecondaryTools(scope: Scope, check: Check, command?: string[]): string[] {
    const isCoverageDropped =
        hasCoverageArguments(check.command, check.coverage_arguments) &&
        isCoverageOff(scope) &&
        !hasCoverageArguments(command, check.coverage_arguments);
    const secondaryTools = isCoverageDropped ? [] : (check.secondary_tools ?? []);
    const tools = [
        check.tool,
        ...[check.command, check.fix].flatMap((commandArguments) =>
            commandArguments === undefined ? [] : [commandArguments[0]],
        ),
        ...secondaryTools,
    ];
    const plugins = tools.includes(ESLINT_MANIFEST_TOOL)
        ? scope.configurations.flatMap((configuration) => configuration.eslint.required_tools)
        : [];
    return [...new Set([...secondaryTools, ...plugins])].filter((name) =>
        isToolUsed([scope], getTool(scope.configurations, name).when),
    );
}

/**
List the tool that a check runs, its fixer, its secondary tools, and the packages they require.

@param planned the plan with resolved conditions, scopes, and exclusions.
*/
export function listCheckTools(planned: ScopeCheck): string[] {
    const names = new Set(
        [planned.tool?.name, ...listSecondaryTools(planned.scope, planned.check), planned.check.fix?.[0]].filter(
            (name) => name !== undefined,
        ),
    );
    addPeerPackages(names, planned.scope.configurations);
    return [...names];
}

/**
List the tools for checks that this machine can run.

@param checks the configured checks across all scopes.
@returns each required tool once.
*/
export function listHostCheckTools(checks: ScopeCheck[]): Set<string> {
    const host = { platform: getOperatingSystem(), arch: process.arch };
    const runnable = checks.filter((planned) => findSystemSkip(planned.check, planned.tool, host) === undefined);
    return new Set(runnable.flatMap((planned) => listCheckTools(planned)));
}

/**
Select the tools that checks, fixers, and their config files use. The tools cover every supported system, so committed
output does not depend on this machine.

@param session the repository and its settings.
@param checks the plans for every supported system.
@returns the configurations with only the tools they need.
*/
export function selectToolConfigurations(session: SessionBase, checks: ScopeCheck[]): Configuration[] {
    const toolNames = new Set(checks.flatMap((check) => listCheckTools(check)));
    const prettierPlugins = listPrettierPlugins(session.scopes.flatMap(({ configurations }) => configurations));
    for (const { name } of prettierPlugins.keys()) toolNames.add(name);
    const configurations = listSelectedConfigurations(session.scopes);
    const selectedTools = new Set(
        configurations.flatMap((configuration) => configuration.tools.map(({ name }) => name)),
    );
    const shipped = readConfigurations().values().toArray();
    addPeerPackages(toolNames, shipped);
    const unselected = [...toolNames].flatMap((name) =>
        selectedTools.has(name)
            ? []
            : (shipped.find((configuration) => configuration.tools.some((tool) => tool.name === name)) ?? []),
    );
    const owners = new Set([...configurations, ...unselected]);
    return [...owners].map((configuration) => ({
        ...configuration,
        tools: configuration.tools
            .filter(({ when: conditions }) => isToolUsed(session.scopes, conditions))
            .filter((tool) => toolNames.has(tool.name)),
    }));
}

/**
Pin the TypeScript of the tool project to the version that the root package.json declares, when typescript-eslint
supports that version, so that type-aware ESLint reads the project with the compiler that builds it. Otherwise the
shipped pin stays. The tool project, its lockfile, doctor, and the TypeScript checks all read this pin.

@param configurations the tool configurations of the session.
@param session the repository files and the run cache.
*/
export function pinProjectTypescript(
    configurations: Configuration[],
    session: Pick<SessionBase, 'cache' | 'repository'>,
): Configuration[] {
    const range = getTool(configurations, TYPESCRIPT_ESLINT_TOOL).peers?.[TYPESCRIPT_PACKAGE];
    const version = range === undefined ? undefined : readProjectTypescript(session);
    if (range === undefined || version === undefined || !semver.satisfies(version, range)) return configurations;
    return configurations.map((configuration) => ({
        ...configuration,
        tools: configuration.tools.map((tool) => {
            const npm = tool.installers['npm'];
            return npm?.name === TYPESCRIPT_PACKAGE
                ? { ...tool, version, installers: { ...tool.installers, npm: { ...npm, version } } }
                : tool;
        }),
    }));
}

/**
Map each tool that declares a Prettier plugin to its npm package name, module, and overrides.

@param configurations the configurations in use.
*/
export function listPrettierPlugins(configurations: Iterable<Configuration>): Map<Tool, PrettierPlugin> {
    return new Map(
        [...configurations].flatMap(({ tools }) =>
            tools.flatMap((tool): Array<[Tool, PrettierPlugin]> => {
                const name = tool.installers['npm']?.name;
                return name === undefined || tool.prettier === undefined
                    ? []
                    : [[tool, { name, module: tool.prettier.module, overrides: tool.prettier.overrides }]];
            }),
        ),
    );
}
