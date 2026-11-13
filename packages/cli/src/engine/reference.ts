import { SETTING_ONLY_PLACEHOLDER } from '#cli/config/engine.ts';
import { WEAKENINGS_CHECK } from '#cli/config/settings/validation.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system.ts';
import { canIgnoreRule } from '#cli/engine/results.ts';
import { findCommandTool, findToolName } from '#cli/manifests/tools.ts';
import { quoteArgument } from '#cli/system/text/quoting.ts';
import type { CheckDescription } from '#cli/types/engine/plan.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { Check, Configuration, Tool } from '#cli/types/manifests.ts';

function listCheckSystems(check: Check, tool: Tool | undefined): string[] | undefined {
    const limits = tool?.builds ?? check.operating_systems;
    return limits === undefined
        ? undefined
        : OPERATING_SYSTEMS.filter(
              ({ name }) => (check.operating_systems?.includes(name) ?? true) && (tool?.builds?.includes(name) ?? true),
          ).map(({ label }) => label);
}

function formatRuleIgnore(check: Check, explanations: CheckCode['explanations']): string | undefined {
    if (!canIgnoreRule(check, explanations === undefined ? undefined : { explanations })) return undefined;
    const rule = explanations === undefined ? undefined : Object.keys(explanations).at(0);
    return `gspot ignore ${quoteArgument(check.id)} --rule ${rule === undefined ? '<rule>' : quoteArgument(rule)} --reason "<why>"`;
}

export function describeCheck(
    check: Check,
    configurations: Configuration[],
    explanations: CheckCode['explanations'],
): CheckDescription {
    const toolName = findToolName(check);
    const tool = toolName === undefined ? undefined : findCommandTool(configurations, toolName);
    const tools = [toolName, ...(check.secondary_tools ?? [])].filter((name): name is string => name !== undefined);
    return {
        toolName,
        tools,
        programs: tools.map((name) => {
            const setting = SETTING_ONLY_PLACEHOLDER.exec(name)?.groups?.['name'];
            return setting === undefined ? name : `the command in \`${setting}\``;
        }),
        systems: listCheckSystems(check, tool),
        needs: check.needs ?? [],
        minVersions: Object.fromEntries(
            tools
                .map((name) => findCommandTool(configurations, name))
                .flatMap((pin) => (pin.min_version === undefined ? [] : [[pin.name, pin.min_version]])),
        ),
        turnOff: {
            paths:
                check.id === WEAKENINGS_CHECK
                    ? null
                    : `gspot ignore ${quoteArgument(check.id)} --paths "<path>" --reason "<why>"`,
            rule: formatRuleIgnore(check, explanations),
        },
        suppression: tool?.suppression,
        crashPattern: tool?.crash_pattern,
    };
}
