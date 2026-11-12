import semver from 'semver';

import { JAVASCRIPT_LOCKFILES, PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { ESLINT_MANIFEST_TOOL } from '#cli/config/repository/setup.ts';
import { hasFilesToCheck } from '#cli/engine/files.ts';
import { hasCoverageArguments, isCoverageOff } from '#cli/engine/plan.ts';
import { findSystemSkip, isSettingEmpty } from '#cli/engine/skips.ts';
import { findTool, getTool, listToolNames, readConfigurations } from '#cli/manifests/read.ts';
import { listSelectedConfigurations } from '#cli/manifests/select.ts';
import { readLockedVersions } from '#cli/parsers/projects/lockfiles.ts';
import { listTrackedPaths } from '#cli/repository/files/tracked.ts';
import { readHost } from '#cli/system/environment.ts';
import { findText } from '#cli/system/files/reads.ts';
import { findPackagePin } from '#cli/tools/pins.ts';
import type { PrettierPlugin } from '#cli/types/engine/plan.ts';
import type { Check, Configuration, Tool } from '#cli/types/manifests.ts';
import type { Scope } from '#cli/types/settings.ts';
import type { ScopeCheck, SessionBase } from '#cli/types/tools.ts';

const TYPESCRIPT_PACKAGE = 'typescript';

const TYPESCRIPT_ESLINT_TOOL = 'typescript-eslint';

/**
Read the TypeScript version that the tracked root lockfile resolves. An untracked lockfile does not count, so every
clone reads the same version.
*/
function readLockedTypescript(session: Pick<SessionBase, 'cache' | 'repository'>): string | undefined {
    const { cache, repository } = session;
    const tracked = new Set(listTrackedPaths(repository));
    const lockfile = JAVASCRIPT_LOCKFILES.find((name) => findText(cache, name) !== undefined);
    if (lockfile === undefined || !tracked.has(lockfile)) return undefined;
    return semver.valid(readLockedVersions(cache, '')?.get(TYPESCRIPT_PACKAGE)) ?? undefined;
}

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

// The program of a [[command_check]] is a name that no configuration declares, and it has no peers.
function addPeerPackages(names: Set<string>, configurations: readonly Configuration[]): void {
    const pending = [...names];
    for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
        const tool = findTool(configurations, name);
        const peers = (tool === undefined ? undefined : findPackagePin(tool)?.requires) ?? [];
        for (const peer of peers) {
            if (names.has(peer)) continue;
            names.add(peer);
            pending.push(peer);
        }
    }
}

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
List the tools of the checks that run on this machine and have a file to read: the mise tools that gspot install
installs. The tool projects still pin every tool, so the committed files do not depend on which files exist.
*/
export function listHostCheckTools({
    configuredChecks,
    repository,
}: Pick<SessionBase, 'configuredChecks' | 'repository'>): Set<string> {
    const host = readHost();
    const runnable = configuredChecks.filter(
        (planned) =>
            findSystemSkip(planned.check, planned.tool, host) === undefined &&
            hasFilesToCheck(repository.files, planned),
    );
    return new Set(runnable.flatMap((planned) => listCheckTools(planned)));
}

/**
Select the tools that checks, fixers, and their config files use. The tools cover every supported system, so committed
output does not depend on this machine.
*/
export function selectToolConfigurations(session: SessionBase, checks: ScopeCheck[]): Configuration[] {
    const toolNames = new Set(checks.flatMap((check) => listCheckTools(check)));
    const prettierPlugins = listPrettierPlugins(session.scopes.flatMap(({ configurations }) => configurations));
    for (const { name } of prettierPlugins.keys()) toolNames.add(name);
    const configurations = listSelectedConfigurations(session.scopes);
    const selectedTools = listToolNames(configurations);
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
*/
export function pinProjectTypescript(
    configurations: Configuration[],
    session: Pick<SessionBase, 'cache' | 'repository'>,
): Configuration[] {
    const range = findTool(configurations, TYPESCRIPT_ESLINT_TOOL)?.peers?.[TYPESCRIPT_PACKAGE];
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
