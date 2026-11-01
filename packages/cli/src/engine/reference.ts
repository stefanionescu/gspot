import { quoteArgument } from '#cli/system/text.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system.ts';
import { getTool, findToolName } from '#cli/tools/pins.ts';
import { OUTPUT_FORMATS } from '#cli/engine/outputs/formats.ts';
import { SETTING_ONLY_PLACEHOLDER } from '#cli/config/engine.ts';
import type { CheckDescription } from '#cli/types/engine/plan.ts';
import type { Tool, Check, Configuration } from '#cli/types/manifests.ts';

function listCheckSystems(check: Check, tool: Tool | undefined): string[] | undefined {
    const limits = tool?.builds ?? check.operating_systems;
    return limits === undefined
        ? undefined
        : OPERATING_SYSTEMS.filter(
              ({ name }) => (check.operating_systems?.includes(name) ?? true) && (tool?.builds?.includes(name) ?? true),
          ).map(({ label }) => label);
}

/**
Collect tool requirements, supported systems, suppression syntax, and ignore commands for a shipped check.

@param check the manifest check.
@param configurations the available tools across configurations.
*/
export function describeCheck(check: Check, configurations: Configuration[]): CheckDescription {
    const toolName = findToolName(check);
    const tool = toolName === undefined ? undefined : getTool(configurations, toolName);
    const tools = [toolName, ...(check.other_tools ?? [])].filter((name): name is string => name !== undefined);
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
            paths: `gspot ignore ${quoteArgument(check.id)} --paths "<path>" --reason "<why>"`,
            rule: OUTPUT_FORMATS[check.output.format].namesRules(check.output)
                ? `gspot ignore ${quoteArgument(check.id)} --rule <rule> --reason "<why>"`
                : undefined,
        },
        suppression: tool?.suppression,
    };
}
