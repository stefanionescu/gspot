import { GspotError } from '#cli/system/errors.ts';
import { NODE_TOOL } from '#cli/config/tools/npm.ts';
import { UV_TOOL } from '#cli/config/tools/python.ts';
import { stripUndefined } from '#cli/system/values.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/operating-systems.ts';
import { MISE_BACKENDS, PYTHON_CONFIGURATION } from '#cli/config/configurations.ts';

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
 * Find the mise package and version, with the backend that the manifest names.
 * @param tool the declaration to read.
 * @returns the installer pin with its backend prefix, or undefined for a system tool.
 */
function findMiseInstaller(tool: ToolDeclaration): InstallerPin | undefined {
    if (tool.system === true) return undefined;
    for (const { installer, prefix } of MISE_BACKENDS) {
        const pin = tool.installers[installer];
        if (pin !== undefined) return { ...pin, name: `${prefix}${pin.name}` };
    }
    return undefined;
}

/**
 * Select the tools that mise installs, apart from those in the npm and Python tool projects.
 * @param manifests the configurations in use.
 * @param reads the run cache.
 * @returns the mise pins.
 */
export function listMisePins(manifests: Manifest[], reads: ReadCache): MisePin[] {
    const tools = listDistinctTools(manifests);
    const pins = tools.flatMap((tool) => findMisePin(tool) ?? []);
    if (
        tools.some((tool) => findToolProjectPackage(tool)?.kind === 'python') &&
        !tools.some((tool) => tool.name === UV_TOOL)
    ) {
        const tool = readManifests(reads)
            .get(PYTHON_CONFIGURATION)
            ?.tools.find((entry) => entry.name === UV_TOOL);
        const pin = tool === undefined ? undefined : findMisePin(tool);
        if (pin === undefined)
            throw new GspotError(
                'manifest',
                `The configuration manifest for \`${PYTHON_CONFIGURATION}\` is not valid:\ntool uv requires a pinned mise installer version.`,
            );
        pins.push(pin);
    }
    return pins;
}

/**
 * Find the mise pin of one tool: its version, its systems, and its backend options.
 * @param tool the declaration to read.
 * @returns the mise pin, or undefined when mise does not install the tool.
 */
export function findMisePin(tool: ToolDeclaration): MisePin | undefined {
    const excluded = findToolProjectPackage(tool) !== undefined;
    const pin = excluded ? undefined : findMiseInstaller(tool);
    if (pin?.version === undefined) return undefined;
    return { name: pin.name, version: pin.version, ...stripUndefined({ options: pin.options }) };
}

/**
 * List the npm and Python tool project pins of the configurations.
 * @param manifests the configurations in use.
 * @returns the npm and Python pins.
 */
export function listToolProjectPins(manifests: Manifest[]): ToolProjectPins {
    const npm: [string, string][] = [];
    const python: string[] = [];
    for (const tool of listDistinctTools(manifests)) {
        const installation = findToolProjectPackage(tool);
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
 * List each tool once, sorted by name.
 * @param manifests the configurations in use.
 * @returns the tool declarations.
 */
export function listDistinctTools(manifests: Manifest[]): ToolDeclaration[] {
    const tools = new Map<string, ToolDeclaration>();
    for (const manifest of manifests)
        for (const tool of manifest.tools) {
            if (!tools.has(tool.name)) tools.set(tool.name, tool);
        }
    return tools
        .values()
        .toArray()
        .toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * Resolve a pin from the owning configuration, shared declarations, or a repository command.
 * @param manifests the configurations that may declare the tool.
 * @param name the executable to find.
 * @param owner the configuration whose check or fixer runs the tool.
 * @returns the declaration, or a system command when no configuration declares the tool.
 */
export function getToolDeclaration(manifests: Iterable<Manifest>, name: string, owner?: Manifest): ToolDeclaration {
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
 * @param check the validated declaration.
 * @returns the executable, or undefined for a built-in check without a tool.
 */
export function getToolName(check: CheckDeclaration): string | undefined {
    return typeof check.tool === 'string' ? check.tool : check.command?.[0];
}

/**
 * Find the npm or Python package that installs a tool. Generated projects and lookup both use it.
 * @param tool the declaration to read.
 * @returns the package to install, or undefined when the system or mise gives the tool.
 */
export function findToolProjectPackage(tool: ToolDeclaration): ToolProjectPackage | undefined {
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
 * @param manifests the configuration declarations.
 * @returns the names, for tool-only package detection.
 */
export function listNpmToolNames(manifests: Iterable<Manifest>): Set<string> {
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
 * Find the build that a tool lacks on a system such as Windows or arm64 Linux.
 * @param tool the declaration with its builds.
 * @param platform the system name: macos, linux, or windows.
 * @param arch x64 or arm64.
 * @returns the words for the missing build, or undefined when the tool has a build.
 */
export function findMissingBuild(tool: ToolDeclaration, platform: string, arch: string): string | undefined {
    const named: readonly string[] = tool.builds ?? [];
    if (tool.builds === undefined || named.includes(platform) || named.includes(`${platform}-${arch}`))
        return undefined;
    const label = OPERATING_SYSTEMS.find((system) => system.name === platform)?.label ?? platform;
    // A pin that names the system with another architecture lacks only this architecture.
    return named.some((entry) => entry.startsWith(`${platform}-`)) ? `${arch} ${label}` : label;
}
