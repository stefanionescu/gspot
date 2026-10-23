import { posix } from 'node:path';
import type { Host } from '#cli/types/planning.ts';
import { UV_TOOL } from '#cli/config/tools/python.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { NODE_TOOL } from '#cli/config/install/npm/project.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/environment.ts';
import { PYTHON_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { readConfigurations, buildManifestError } from '#cli/configurations/manifests.ts';

import type {
    Tool,
    Check,
    MisePin,
    InstallerPin,
    Configuration,
    ToolProjectPins,
    ToolProjectPackage,
} from '#cli/types/configurations.ts';

/**
 * Find the mise package and version, with the backend that the manifest names.
 *
 * @param tool the tool to read.
 * @returns the installer pin with its backend prefix, or undefined for a system tool.
 */
function findMiseInstaller(tool: Tool): InstallerPin | undefined {
    if (tool.system === true) return undefined;
    return tool.installers['mise'];
}

/**
 * Get the name that a config-file placeholder uses for a config file.
 *
 * @param file the path that the manifest names.
 * @returns the file name without its folder and extensions.
 */
export function extractConfigFileName(file: string): string {
    const name = posix.basename(file);
    const dot = name.indexOf('.');
    return dot === -1 ? name : name.slice(0, dot);
}

/**
 * Check whether gspot installs a tool through mise or a pinned tool project.
 *
 * @param tool the declaration to read.
 * @returns whether gspot uses one of its installers.
 */
export function isInstalledByGspot(tool: Tool): boolean {
    return findToolProjectPackage(tool) !== undefined || findMiseInstaller(tool) !== undefined;
}

/**
 * List the tools that mise installs, apart from those in the npm and Python tool projects, and add uv when a Python
 * tool project needs it.
 *
 * @param configurations the configurations in use.
 * @returns the name and version of each mise tool.
 */
export function listMisePins(configurations: Configuration[]): MisePin[] {
    const tools = listDistinctTools(configurations);
    const pins = tools.flatMap((tool) => findMisePin(tool) ?? []);
    if (
        tools.some((tool) => findToolProjectPackage(tool)?.kind === 'python') &&
        !tools.some((tool) => tool.name === UV_TOOL)
    ) {
        const tool = getTool(readConfigurations().values(), UV_TOOL);
        const pin = findMisePin(tool);
        if (pin === undefined)
            throw buildManifestError(PYTHON_CONFIGURATION, ['tool uv requires a pinned mise installer version.']);
        pins.push(pin);
    }
    return pins;
}

/**
 * Find the mise pin of one tool: its version, its systems, and its backend options.
 *
 * @param tool the tool to read.
 * @returns the mise pin, or undefined when mise does not install the tool.
 */
export function findMisePin(tool: Tool): MisePin | undefined {
    const excluded = findToolProjectPackage(tool) !== undefined;
    const pin = excluded ? undefined : findMiseInstaller(tool);
    if (pin?.version === undefined) return undefined;
    return { name: pin.name, version: pin.version, ...stripUndefined({ options: pin.options }) };
}

/**
 * List the npm and Python tool project pins of the configurations.
 *
 * @param configurations the configurations in use.
 * @returns the npm and Python pins.
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
        npm: Object.fromEntries(npm.toSorted(([first], [second]) => first.localeCompare(second))),
        python,
    };
}

/**
 * List each tool once, sorted by name.
 *
 * @param configurations the configurations in use.
 * @returns the first declaration of each tool name.
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
        .toSorted((first, second) => first.name.localeCompare(second.name));
}

/**
 * Find a tool in the owning configuration first, then in any configuration.
 *
 * @param configurations the configurations that may declare the tool.
 * @param name the executable to find.
 * @returns the tool, or a system program when no configuration declares the tool.
 */
export function getTool(configurations: Iterable<Configuration>, name: string): Tool {
    for (const configuration of configurations) {
        const pin = configuration.tools.find((tool) => tool.name === name);
        if (pin !== undefined) return pin;
    }
    return { name, kind: 'program', system: true, installers: {} };
}

/**
 * Get the tool that a check names, or the first word of its command.
 *
 * @param check the validated check.
 * @returns the executable, or undefined for a built-in check without a tool.
 */
export function getToolName(check: Check): string | undefined {
    return typeof check.tool === 'string' ? check.tool : check.command?.[0];
}

/**
 * Find the npm or Python package that installs a tool. Generated projects and lookup both use it.
 *
 * @param tool the tool to read.
 * @returns the package to install, or undefined when the system or mise gives the tool.
 */
export function findToolProjectPackage(tool: Tool): ToolProjectPackage | undefined {
    const python = tool.installers['pypi'];
    if (tool.system !== true && python?.version !== undefined)
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
 * List the exact npm package names that the configurations declare.
 *
 * @param configurations the configurations in use.
 * @returns the names, for tool-only package detection.
 */
export function listNpmToolNames(configurations: Iterable<Configuration>): Set<string> {
    return new Set(
        [...configurations].flatMap((configuration) =>
            configuration.tools.flatMap((tool) => {
                const npm = tool.installers['npm'];
                return npm === undefined ? [] : [npm.name];
            }),
        ),
    );
}

/**
 * Find the build that a tool lacks on a system such as Windows or arm64 Linux.
 *
 * @param tool the tool with its builds.
 * @param host the system name and architecture.
 * @returns the words for the missing build, or undefined when the tool has a build.
 */
export function findMissingBuild(tool: Tool, host: Host): string | undefined {
    if (tool.builds === undefined) return undefined;
    const { platform, arch } = host;
    const named: readonly string[] = tool.builds;
    if (named.includes(platform) || named.includes(`${platform}-${arch}`)) return undefined;
    const label = OPERATING_SYSTEMS.find((system) => system.name === platform)?.label ?? platform;
    // A pin that names the system with another architecture lacks only this architecture.
    return named.some((systemName) => systemName.startsWith(`${platform}-`)) ? `${arch} ${label}` : label;
}

/**
 * Read the plugin prefix of a qualified lint rule.
 *
 * @param rule the rule name, optionally prefixed by its plugin.
 * @returns the prefix before the last slash, or undefined for an unqualified rule.
 */
export function extractRulePrefix(rule: string): string | undefined {
    const slash = rule.lastIndexOf('/');
    return slash === -1 ? undefined : rule.slice(0, slash);
}
