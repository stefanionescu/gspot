import { compareText } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { stringify } from '@decimalturn/toml-patch';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { LintCommandSearch } from '#cli/types/repository.ts';
import type { Tool, Check, Configuration } from '#cli/types/manifests.ts';
import { LINT_PACKAGE, OVERLAPPING_TOOLS } from '#cli/config/repository/setup.ts';
import { UV_TOOL, NODE_TOOL, CONFIG_TOML_FORMAT, PYTHON_TOOL_PROJECT } from '#cli/config/tools/installers.ts';

import type {
    Host,
    Session,
    PackagePin,
    MiseToolPin,
    PackagePins,
    GeneratedFile,
    PythonToolProject,
} from '#cli/types/tools.ts';

/**
List the tools that mise installs, apart from those in the npm and Python tool projects, and add uv when a Python
tool project needs it.

@param configurations the configurations in use.
*/
export function listMisePins(configurations: Configuration[]): MiseToolPin[] {
    const tools = listDistinctTools(configurations);
    const pins = tools.flatMap((tool) => findMisePin(tool) ?? []);
    if (tools.some((tool) => findPackagePin(tool)?.kind === 'python') && tools.every((tool) => tool.name !== UV_TOOL))
        pins.push(getUvPin());
    return pins;
}

/**
Read the mise pin of uv, which installs the Python tool project.
*/
export function getUvPin(): MiseToolPin {
    const pin = findMisePin(getTool(readConfigurations().values(), UV_TOOL));
    if (pin === undefined) throw new Error('The uv manifest has no mise pin.');
    return pin;
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
        content: stringify({ tools }, { ...CONFIG_TOML_FORMAT, inlineTableStart: 1 }),
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
    const npm: Array<[string, string]> = [];
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
List the npm pins of the tool project: the shipped tools, and the plugin packages that the settings name. A shipped pin
wins over a plugin record that names the same package.

@param session the configurations in use, and the settings of each scope.
*/
export function listNpmProjectPins(session: Pick<Session, 'scopes' | 'toolConfigurations'>): PackagePins['npm'] {
    const plugins = session.scopes.flatMap(({ settings }) => [
        ...(settings.tables['tools.eslint']?.plugins ?? []),
        ...(settings.tables['tools.stylelint']?.plugins ?? []),
    ]);
    const pluginPins = plugins.flatMap(({ package: name, version }) =>
        name === undefined ? [] : [[name, version as string] as const],
    );
    const pinsByName = Map.groupBy(pluginPins, ([name]) => name);
    for (const [name, pins] of pinsByName)
        if (new Set(pins.map(([, version]) => version)).size > 1)
            throw new GspotError('settings', `The plugin records name ${name} at two versions. Use one version.`);
    return { ...Object.fromEntries(pluginPins), ...listPackagePins(session.toolConfigurations).npm };
}

/**
List the tools that gspot replaces, the tools that they cover, and the npm pins of their stack.

@param configurations the configurations in use.
@returns the command names to look for, and the pins that a root devDependency may repeat.
*/
export function listReplacedTools(configurations: Configuration[]): Pick<LintCommandSearch, 'tools' | 'pins'> {
    const replaced = listDistinctTools(configurations).filter(
        ({ replace, replace_key }) => replace !== undefined || replace_key !== undefined,
    );
    const names = new Set(replaced.map(({ name }) => name));
    const covered = OVERLAPPING_TOOLS.filter(({ owner }) => names.has(owner)).map(({ name }) => name);
    const stack = configurations.map((configuration) => ({
        ...configuration,
        tools: configuration.tools.filter(
            ({ name, kind }) => names.has(name) || (kind === 'package' && LINT_PACKAGE.test(name)),
        ),
    }));
    return { tools: new Set([...names, ...covered]), pins: listPackagePins(stack).npm };
}

/**
Build the project table of the Python tool project: its name, its Python version, and the tool pins.

@param configurations the configurations in use.
*/
export function buildPythonProjectTable(configurations: Configuration[]): PythonToolProject {
    return { ...PYTHON_TOOL_PROJECT, dependencies: listPackagePins(configurations).python };
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
    if (python !== undefined && tool.system !== true)
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
    return named.includes(platform)
        ? undefined
        : (OPERATING_SYSTEMS.find((system) => system.name === platform)?.label ?? platform);
}
