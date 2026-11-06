import { SETTING_ONLY_PLACEHOLDER } from '#cli/config/engine.ts';
import { WEAKENINGS_CHECK } from '#cli/config/settings/validation.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system.ts';
import { OUTPUT_FORMATS } from '#cli/engine/outputs/formats.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { findToolName, getTool } from '#cli/tools/pins.ts';
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
    const rule = explanations === undefined ? undefined : Object.keys(explanations).at(0);
    if (rule !== undefined)
        return `gspot ignore ${quoteArgument(check.id)} --rule ${quoteArgument(rule)} --reason "<why>"`;
    return OUTPUT_FORMATS[check.output.format].namesRules(check.output)
        ? `gspot ignore ${quoteArgument(check.id)} --rule <rule> --reason "<why>"`
        : undefined;
}

export function describeCheck(
    check: Check,
    configurations: Configuration[],
    explanations: CheckCode['explanations'],
): CheckDescription {
    const toolName = findToolName(check);
    const tool = toolName === undefined ? undefined : getTool(configurations, toolName);
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
                .map((name) => getTool(configurations, name))
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
    };
}
