import type { Scope } from '#cli/types/settings.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool, findPackagePin } from '#cli/tools/pins.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import type { PrettierPlugin } from '#cli/types/engine/plan.ts';
import type { ScopeCheck, SessionBase } from '#cli/types/tools.ts';
import { isSettingEmpty, findSystemSkip } from '#cli/engine/skips.ts';
import { listSelectedConfigurations } from '#cli/manifests/select.ts';
import { ESLINT_MANIFEST_TOOL } from '#cli/config/repository/setup.ts';
import { isCoverageOff, hasCoverageArguments } from '#cli/engine/plan.ts';
import type { Tool, Check, Configuration } from '#cli/types/manifests.ts';

function isToolConditionMet(scope: Scope, conditions: Tool['when']): boolean {
    return (
        conditions === undefined ||
        conditions.some((condition) => {
            if (condition.level !== undefined && condition.level !== scope.settings.valuesByKey['level']) return false;
            if (condition.setting === undefined) return true;
            return !isSettingEmpty(scope.settings.valuesByKey[condition.setting]);
        })
    );
}

function addPeerPackages(names: Set<string>, configurations: readonly Configuration[]): void {
    for (const name of names)
        for (const required of findPackagePin(getTool(configurations, name))?.requires ?? []) names.add(required);
}

/**
List the secondary tools that the command and the configuration of a check use.

@param scope where the check runs.
@param check the check to read.
@param command the arguments that run, if known.
@returns each secondary tool once.
*/
export function listSecondaryTools(scope: Scope, check: Check, command?: string[]): string[] {
    const withoutCoverage =
        hasCoverageArguments(check.command, check.coverage_arguments) &&
        isCoverageOff(scope) &&
        !hasCoverageArguments(command, check.coverage_arguments);
    const secondaryTools = withoutCoverage ? [] : (check.secondary_tools ?? []);
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
    return [...new Set([...secondaryTools, ...plugins])].filter((name) => {
        const pin = getTool(scope.configurations, name);
        return isToolConditionMet(scope, pin.when);
    });
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
    for (const { name } of listPrettierPlugins(session.scopes.flatMap(({ configurations }) => configurations)).keys())
        toolNames.add(name);
    const configurations = listSelectedConfigurations(session.scopes);
    const selectedTools = new Set(
        configurations.flatMap((configuration) => configuration.tools.map(({ name }) => name)),
    );
    addPeerPackages(toolNames, [...readConfigurations().values()]);
    const unselected = [...toolNames].flatMap((name) =>
        selectedTools.has(name)
            ? []
            : ([...readConfigurations().values()].find((configuration) =>
                  configuration.tools.some((tool) => tool.name === name),
              ) ?? []),
    );
    const owners = new Set([...configurations, ...unselected]);
    return [...owners].map((configuration) => ({
        ...configuration,
        tools: configuration.tools
            .filter(({ when: conditions }) => session.scopes.some((scope) => isToolConditionMet(scope, conditions)))
            .filter((tool) => toolNames.has(tool.name)),
    }));
}

/**
Map each tool that declares a Prettier plugin to its npm package name, module, and overrides.

@param configurations the configurations in use.
*/
export function listPrettierPlugins(configurations: Iterable<Configuration>): Map<Tool, PrettierPlugin> {
    return new Map(
        [...configurations].flatMap(({ tools }) =>
            tools.flatMap((tool): [Tool, PrettierPlugin][] => {
                const name = tool.installers['npm']?.name;
                return tool.prettier === undefined || name === undefined
                    ? []
                    : [[tool, { name, module: tool.prettier.module, overrides: tool.prettier.overrides }]];
            }),
        ),
    );
}
