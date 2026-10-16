import { compact } from '#cli/system/values.ts';
import { NODE_TOOL } from '#cli/config/tools/npm.ts';
import { UV_TOOL } from '#cli/config/tools/python.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/operating-systems.ts';
import { MISE_BACKENDS, PYTHON_CONFIGURATION } from '#cli/config/configurations.ts';
import { manifestError, configurationManifests } from '#cli/configurations/manifests.ts';

import {
    type MisePin,
    type Manifest,
    type InstallerPin,
    type ToolDeclaration,
    type ToolProjectPins,
    type CheckDeclaration,
    type ToolProjectPackage,
} from '#cli/types/configurations.ts';

/**
 * The pinned uv installer used for Python tools.
 * @returns the declared uv mise pin
 */
function uvPin(): MisePin {
    const tool = configurationManifests()
        .get(PYTHON_CONFIGURATION)
        ?.tools.find((entry) => entry.name === UV_TOOL);
    const pin = tool === undefined ? undefined : pinOf(tool);
    if (pin === undefined)
        throw manifestError(PYTHON_CONFIGURATION, ['tool uv requires a pinned mise installer version.']);
    return pin;
}

/**
 * The mise package and version, using the backend the manifest names.
 * @param tool the pin.
 * @returns the installer pin with its backend prefix, or undefined for a host tool.
 */
function misePin(tool: ToolDeclaration): InstallerPin | undefined {
    if (tool.system === true) return undefined;
    for (const { installer, prefix } of MISE_BACKENDS) {
        const pin = tool.installers[installer];
        if (pin !== undefined) return { ...pin, name: `${prefix}${pin.name}` };
    }
    return undefined;
}

/**
 * Select tools that mise installs. Omit tools in npm and Python tool projects.
 * @param manifests the selected manifests.
 * @returns pins installed by mise.
 */
export function misePins(manifests: Manifest[]): MisePin[] {
    const tools = collectPins(manifests);
    const pins = tools.flatMap((tool) => pinOf(tool) ?? []);
    if (
        tools.some((tool) => toolProjectPackage(tool)?.kind === 'python') &&
        !tools.some((tool) => tool.name === UV_TOOL)
    )
        pins.push(uvPin());
    return pins;
}

/**
 * The pin mise installs for one tool: its version, its platforms, and its backend options.
 * @param tool the pin.
 * @returns the mise pin, or undefined when mise does not install the tool.
 */
export function pinOf(tool: ToolDeclaration): MisePin | undefined {
    const excluded = toolProjectPackage(tool) !== undefined;
    const pin = excluded ? undefined : misePin(tool);
    if (pin?.version === undefined) return undefined;
    return { name: pin.name, version: pin.version, ...compact({ options: pin.options }) };
}

/**
 * The npm and Python project requirements declared by the selected configurations.
 * @param manifests the selected manifests
 * @returns npm versions, Python pins
 */
export function toolProjectPins(manifests: Manifest[]): ToolProjectPins {
    const npm: [string, string][] = [];
    const python: string[] = [];
    for (const tool of collectPins(manifests)) {
        const installation = toolProjectPackage(tool);
        if (installation === undefined) continue;
        if (installation.kind === 'npm') npm.push([installation.name, installation.version]);
        if (installation.kind !== 'python') continue;
        python.push(`${installation.name}==${installation.version}`);
    }
    return {
        npm: Object.fromEntries(npm.toSorted(([a], [b]) => a.localeCompare(b))),
        python,
    };
}

/**
 * Every distinct tool pin across the selection, sorted by name.
 * @param manifests the selected manifests.
 * @returns the pins.
 */
export function collectPins(manifests: Manifest[]): ToolDeclaration[] {
    const pins = new Map<string, ToolDeclaration>();
    for (const manifest of manifests)
        for (const tool of manifest.tools) {
            if (!pins.has(tool.name)) pins.set(tool.name, tool);
        }
    return pins
        .values()
        .toArray()
        .toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * Resolve a pin from the owning configuration, shared declarations, or a repository-owned command.
 * @param manifests the manifests that may declare the tool.
 * @param name the executable name.
 * @param owner the configuration whose check or fixer consumes the tool.
 * @returns the declared pin or a host command when no configuration declares it.
 */
export function toolDeclaration(manifests: Iterable<Manifest>, name: string, owner?: Manifest): ToolDeclaration {
    const own = owner?.tools.find((tool) => tool.name === name);
    if (own !== undefined) return own;
    for (const manifest of manifests) {
        const pin = manifest.tools.find((tool) => tool.name === name);
        if (pin !== undefined) return pin;
    }
    return { name, kind: 'program', system: true, installers: {} };
}

/**
 * Read the declared executable or the first argument of a manifest command.
 * @param check the validated check declaration.
 * @returns the executable name, absent for an internal check without a tool.
 */
export function toolName(check: CheckDeclaration): string | undefined {
    return typeof check.tool === 'string' ? check.tool : check.command?.[0];
}

/**
 * Select the tool project installation used by both generated projects and tool resolution.
 * @param tool the pin
 * @returns the package to install, or undefined when the host or mise supplies it.
 */
export function toolProjectPackage(tool: ToolDeclaration): ToolProjectPackage | undefined {
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
 * Exact npm package names declared by the supplied configurations.
 * @param manifests the configuration declarations
 * @returns installer package names for tooling-only package detection
 */
export function npmToolNames(manifests: Iterable<Manifest>): Set<string> {
    return new Set(
        [...manifests].flatMap((manifest) =>
            manifest.tools.flatMap((tool) => {
                const npm = tool.installers['npm'];
                return npm === undefined ? [] : [npm.name];
            }),
        ),
    );
}

/**
 * The build a tool lacks on a host, such as Windows or arm64 Linux, or undefined when the tool ships for it.
 * @param tool the tool pin
 * @param platform the host platform name: macos, linux, or windows
 * @param arch the host architecture: x64 or arm64
 * @returns the words for the missing build, or undefined
 */
export function missingBuild(tool: ToolDeclaration, platform: string, arch: string): string | undefined {
    const named: readonly string[] = tool.builds ?? [];
    if (tool.builds === undefined || named.includes(platform) || named.includes(`${platform}-${arch}`))
        return undefined;
    const label = OPERATING_SYSTEMS.find((system) => system.name === platform)?.label ?? platform;
    // A pin that names the operating system with another architecture lacks this architecture only.
    return named.some((entry) => entry.startsWith(`${platform}-`)) ? `${arch} ${label}` : label;
}
