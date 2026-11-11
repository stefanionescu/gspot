import { stringify } from '@decimalturn/toml-patch';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { LINT_PACKAGE, OVERLAPPING_TOOLS } from '#cli/config/repository/setup.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system.ts';
import { CONFIG_TOML_FORMAT, NODE_TOOL, PYTHON_TOOL_PROJECT, UV_TOOL } from '#cli/config/tools/installers.ts';
import { getTool, listDistinctTools, readConfigurations } from '#cli/manifests/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import { compareText } from '#cli/system/text.ts';
import type { Configuration, Tool } from '#cli/types/manifests.ts';
import type { LintCommandSearch } from '#cli/types/repository.ts';
import type {
    GeneratedFile,
    Host,
    MiseToolPin,
    PackagePin,
    PackagePins,
    PythonToolProject,
    Session,
} from '#cli/types/tools.ts';

export function listMisePins(configurations: Configuration[]): MiseToolPin[] {
    const tools = listDistinctTools(configurations);
    const pins = tools.flatMap((tool) => findMisePin(tool) ?? []);
    if (tools.some((tool) => findPackagePin(tool)?.kind === 'python') && tools.every((tool) => tool.name !== UV_TOOL))
        pins.push(getUvPin());
    return pins;
}

export function getUvPin(): MiseToolPin {
    const pin = findMisePin(getTool(readConfigurations().values(), UV_TOOL));
    if (pin === undefined) throw new Error('The uv manifest has no mise pin.');
    return pin;
}

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

export function buildPythonProjectTable(configurations: Configuration[]): PythonToolProject {
    return { ...PYTHON_TOOL_PROJECT, dependencies: listPackagePins(configurations).python };
}

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

export function findMissingBuild(tool: Tool, host: Host): string | undefined {
    if (tool.builds === undefined) return undefined;
    const { platform } = host;
    const named: readonly string[] = tool.builds;
    return named.includes(platform)
        ? undefined
        : (OPERATING_SYSTEMS.find((system) => system.name === platform)?.label ?? platform);
}
