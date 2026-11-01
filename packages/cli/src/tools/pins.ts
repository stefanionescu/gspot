import { compareText } from '#cli/system/text.ts';
import { stringify } from '@decimalturn/toml-patch';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { Tool, Check, Configuration } from '#cli/types/manifests.ts';
import { UV_TOOL, NODE_TOOL, CONFIG_TOML_FORMAT } from '#cli/config/tools/installers.ts';
import type { Host, PackagePin, MiseToolPin, PackagePins, GeneratedFile } from '#cli/types/tools.ts';

/**
List the tools that mise installs, apart from those in the npm and Python tool projects, and add uv when a Python
tool project needs it.

@param configurations the configurations in use.
*/
export function listMisePins(configurations: Configuration[]): MiseToolPin[] {
    const tools = listDistinctTools(configurations);
    const pins = tools.flatMap((tool) => findMisePin(tool) ?? []);
    if (tools.some((tool) => findPackagePin(tool)?.kind === 'python') && tools.every((tool) => tool.name !== UV_TOOL)) {
        pins.push(findMisePin(getTool(readConfigurations().values(), UV_TOOL)) as MiseToolPin);
    }
    return pins;
}

/**
Build the mise install of the tools, without the runtime pins of the repository.

@param configurations the configurations in use.
*/
export function buildMiseInstall(configurations: Configuration[]): GeneratedFile {
    const tools = Object.fromEntries(
        listMisePins(configurations)
            .toSorted((left, right) => compareText(left.name, right.name))
            .map((pin) => [
                pin.name,
                pin.options === undefined ? pin.version : { version: pin.version, ...pin.options },
            ]),
    );
    return {
        path: GSPOT_PATHS.miseProject,
        content: stringify({ tools, settings: { lockfile: true } }, { ...CONFIG_TOML_FORMAT, inlineTableStart: 1 }),
    };
}

/**
Find the mise pin of one tool: its version, its systems, and its backend options.

@param tool the tool to read.
@returns undefined when mise does not install the tool.
*/
export function findMisePin(tool: Tool): MiseToolPin | undefined {
    if (tool.system === true || findPackagePin(tool) !== undefined) return undefined;
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
export function listPackagePins(configurations: Configuration[]): PackagePins {
    const npm: [string, string][] = [];
    const python: string[] = [];
    for (const tool of listDistinctTools(configurations)) {
        const installation = findPackagePin(tool);
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
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Planning, explain, the gspot check, and the docs read the program of a check through it.
export function findToolName(check: Check): string | undefined {
    return typeof check.tool === 'string' ? check.tool : check.command?.[0];
}

/**
Find the npm or Python package that installs a tool.

@param tool the tool to read.
@returns undefined when the system or mise gives the tool.
*/
export function findPackagePin(tool: Tool): PackagePin | undefined {
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
Find the operating system that a tool does not support.

@param tool the tool with its builds.
@param host the operating system.
@returns undefined when the tool has a build.
*/
export function findMissingBuild(tool: Tool, host: Host): string | undefined {
    if (tool.builds === undefined) return undefined;
    const { platform } = host;
    const named: readonly string[] = tool.builds;
    if (named.includes(platform)) return undefined;
    return OPERATING_SYSTEMS.find((system) => system.name === platform)?.label ?? platform;
}
