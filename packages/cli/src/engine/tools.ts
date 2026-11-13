import { ESLINT_MANIFEST_TOOL } from '#cli/config/tools/programs.ts';
import { hasFilesToCheck } from '#cli/engine/files.ts';
import { hasCoverageArguments, isCoverageOff } from '#cli/engine/plan.ts';
import { findSystemSkip } from '#cli/engine/skips.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { findTool, getTool, listToolNames } from '#cli/manifests/tools.ts';
import { listSelectedConfigurations } from '#cli/settings/scopes.ts';
import { isSettingEmpty } from '#cli/settings/values/written.ts';
import { readHost } from '#cli/system/environment.ts';
import { findPackagePin } from '#cli/tools/pins.ts';
import type { PrettierPlugin } from '#cli/types/engine/plan.ts';
import type { Check, Configuration, Tool } from '#cli/types/manifests.ts';
import type { Scope } from '#cli/types/settings.ts';
import type { ScopeCheck, SessionBase } from '#cli/types/tools.ts';

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
