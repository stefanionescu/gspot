import { compareText } from '#cli/system/text/order.ts';
import type { Tool, Check, Configuration } from '#cli/types/manifests.ts';

export function findToolName(check: Pick<Check, 'tool' | 'command'>): string | undefined {
    return check.tool ?? check.command?.[0];
}

export function listToolNames(configurations: Configuration[]): Set<string> {
    return new Set(configurations.flatMap((configuration) => configuration.tools.map((tool) => tool.name)));
}

export function listDistinctTools(configurations: Configuration[]): Tool[] {
    const tools = new Map<string, Tool>();
    for (const configuration of configurations)
        for (const tool of configuration.tools) {
            if (!tools.has(tool.name)) tools.set(tool.name, tool);
        }
    return tools
        .values()
        .toArray()
        .toSorted((first, second) => compareText(first.name, second.name));
}

export function findTool(configurations: Iterable<Configuration>, name: string): Tool | undefined {
    for (const configuration of configurations) {
        const tool = configuration.tools.find((declaration) => declaration.name === name);
        if (tool !== undefined) return tool;
    }
    return undefined;
}

/**
Get a tool that gspot ships by its name.

@throws Error when no configuration declares it.
*/
export function getTool(configurations: Iterable<Configuration>, name: string): Tool {
    const tool = findTool(configurations, name);
    if (tool === undefined) throw new Error(`No configuration declares the tool ${name}.`);
    return tool;
}

/**
Find the tool that runs the program of a written command, such as a [[command_check]] or its fix: the tool that a
configuration declares under that name, or else the program on the PATH.
*/
export function findCommandTool(configurations: Iterable<Configuration>, name: string): Tool {
    return findTool(configurations, name) ?? { name, kind: 'program', system: true, installers: {} };
}
