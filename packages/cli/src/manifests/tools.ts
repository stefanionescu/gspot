import { posix } from 'node:path';
import { UV_TOOL } from '#cli/config/tools/uv.ts';
import { compareText } from '#cli/system/text.ts';
import type { Host } from '#cli/types/planning.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { NODE_TOOL } from '#cli/config/installers/npm/project.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/environment.ts';

import type {
    Tool,
    Check,
    MiseToolPin,
    Configuration,
    ToolProjectPins,
    ToolProjectPackage,
} from '#cli/types/manifests.ts';

/**
Get the name that a config-file placeholder uses for a config file.

@param file the path that the manifest names.
@returns the file name without its folder and extensions.
*/
export function extractConfigFileName(file: string): string {
    const name = posix.basename(file);
    const dot = name.indexOf('.');
    return dot === -1 ? name : name.slice(0, dot);
}

/**
List the tools that mise installs, apart from those in the npm and Python tool projects, and add uv when a Python
tool project needs it.

@param configurations the configurations in use.
*/
export function listMisePins(configurations: Configuration[]): MiseToolPin[] {
    const tools = listDistinctTools(configurations);
    const pins = tools.flatMap((tool) => findMisePin(tool) ?? []);
    if (
        tools.some((tool) => findToolProjectPackage(tool)?.kind === 'python') &&
        tools.every((tool) => tool.name !== UV_TOOL)
    ) {
        pins.push(getUvPin());
    }
    return pins;
}

/**
Get the mise pin that the shipped Python configuration declares for uv.

@returns the uv installer pin.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The mise pins and the CI install take the uv pin of the Python configuration through it.
export function getUvPin(): MiseToolPin {
    return findMisePin(getTool(readConfigurations().values(), UV_TOOL)) as MiseToolPin;
}

/**
Find the mise pin of one tool: its version, its systems, and its backend options.

@param tool the tool to read.
@returns undefined when mise does not install the tool.
*/
export function findMisePin(tool: Tool): MiseToolPin | undefined {
    if (tool.system === true || findToolProjectPackage(tool) !== undefined) return undefined;
    const pin = tool.installers['mise'];
    return pin === undefined
        ? undefined
        : {
              name: pin.name,
              version: pin.version,
              options: pin.options,
              checksums: pin.checksums,
          };
}

/**
List the npm and Python tool project pins of the configurations.

@param configurations the configurations in use.
*/
export function listToolProjectPins(configurations: Configuration[]): ToolProjectPins {
    const npm: [string, string][] = [];
    const python: string[] = [];
    for (const tool of listDistinctTools(configurations)) {
        const installation = findToolProjectPackage(tool);
        if (installation === undefined) continue;
        if (installation.kind === 'npm') npm.push([installation.name, installation.version]);
        else python.push(`${installation.name}==${installation.version}`);
    }
    return {
        npm: Object.fromEntries(npm.toSorted(([first], [second]) => compareText(first, second))),
        python,
    };
}

/**
List each tool once, sorted by name.

@param configurations the configurations in use.
@returns the first declaration of each tool name.
*/
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

/**
Get the first declaration of a tool, in the order of the configurations.

@param configurations the configurations that may declare the tool, the owning configuration first.
@param name the executable to find.
@returns the tool, or a system program when no configuration declares the tool.
*/
export function getTool(configurations: Iterable<Configuration>, name: string): Tool {
    for (const configuration of configurations) {
        const tool = configuration.tools.find((declaration) => declaration.name === name);
        if (tool !== undefined) return tool;
    }
    return { name, kind: 'program', system: true, installers: {} };
}

/**
Get the tool that a check names, or the first word of its command.

@param check the validated check.
@returns undefined for a built-in check without a tool.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Inlining this step puts its callers over the complexity limit.
export function getToolName(check: Check): string | undefined {
    return typeof check.tool === 'string' ? check.tool : check.command?.[0];
}

/**
Find the npm or Python package that installs a tool.

@param tool the tool to read.
@returns undefined when the system or mise gives the tool.
*/
export function findToolProjectPackage(tool: Tool): ToolProjectPackage | undefined {
    const python = tool.installers['pypi'];
    if (tool.system !== true && python !== undefined)
        return { kind: 'python', name: python.name, version: python.version };
    const npm = tool.installers['npm'];
    if (npm?.version === undefined) return undefined;
    return {
        kind: 'npm',
        name: npm.name,
        version: npm.version,
        requires: [[NODE_TOOL], tool.requires].flatMap((peers) => peers ?? []),
    };
}

/**
List the exact npm package names that the configurations declare.

@param configurations the configurations in use.
*/
export function listNpmToolNames(configurations: Iterable<Configuration>): Set<string> {
    return new Set(
        [...configurations].flatMap((configuration) =>
            configuration.tools.flatMap((tool) => {
                const npm = tool.installers['npm'];
                return npm === undefined ? [] : npm.name;
            }),
        ),
    );
}

/**
Find the build that a tool lacks on a system such as Windows or arm64 Linux.

@param tool the tool with its builds.
@param host the system name and architecture.
@returns undefined when the tool has a build.
*/
export function findMissingBuild(tool: Tool, host: Host): string | undefined {
    if (tool.builds === undefined) return undefined;
    const { platform, arch } = host;
    const named: readonly string[] = tool.builds;
    if (named.includes(platform) || named.includes(`${platform}-${arch}`)) return undefined;
    const label = OPERATING_SYSTEMS.find((system) => system.name === platform)?.label ?? platform;
    return named.some((systemName) => systemName.startsWith(`${platform}-`)) ? `${arch} ${label}` : label;
}

/**
Read the plugin prefix of a qualified lint rule.

@param rule the rule name, optionally prefixed by its plugin.
@returns undefined for an unqualified rule.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Inlined, its slash rule repeats at each call.
export function extractRulePrefix(rule: string): string | undefined {
    const slash = rule.lastIndexOf('/');
    return slash === -1 ? undefined : rule.slice(0, slash);
}

/**
Tell whether the output of a check names the lint rule of each finding.

@param check the output format and field mappings to inspect.
@returns whether each finding of the check holds a rule.
*/
export function hasRuleOutput(check: Check): boolean {
    const { output } = check;
    if (['semgrep', 'knip', 'markdownlint'].includes(output.format)) return true;
    if (output.format === 'json') return output.fields?.rule !== undefined;
    if (output.format === 'regex' || output.format === 'grouped')
        return output.fields?.rule !== undefined || output.pattern.includes('(?<rule>');
    return false;
}
