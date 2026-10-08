import semver from 'semver';
import { compact } from '#cli/platform/objects.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { MISE_BACKENDS } from '#cli/config/configurations.ts';
import { manifestError } from '#cli/configurations/problems.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { OPERATING_SYSTEMS } from '#cli/config/platform/operating-systems.ts';

import type {
    MisePin,
    ToolPin,
    Manifest,
    InstallerPin,
    PinRequirement,
    CheckDeclaration,
    ToolProjectPackage,
} from '#cli/types/configurations.ts';

/**
 * The operating systems mise installs a tool on, from the platforms its manifest names.
 * @param tool the pin.
 * @returns the mise os list, or undefined when every platform has a build.
 */
function miseOs(tool: ToolPin): string[] | undefined {
    if (tool.platforms === undefined) return undefined;
    const os = [...new Set(tool.platforms.map((platform) => platform.replace(/-(?:x64|arm64)$/u, '')))];
    return os.length === OPERATING_SYSTEMS.length ? undefined : os;
}

/**
 * The pin mise installs for one tool: its version, its platforms, and its backend options.
 * @param tool the pin.
 * @returns the mise pin, or undefined when mise does not install the tool.
 */
function pinOf(tool: ToolPin): MisePin | undefined {
    const excluded = toolProjectPackage(tool, 'mise') !== undefined;
    const pin = excluded ? undefined : misePin(tool);
    if (pin?.version === undefined) return undefined;
    return { name: pin.name, version: pin.version, ...compact({ os: miseOs(tool), options: pin.options }) };
}

// Reject conflicting tool and installer versions with both configuration owners.
function recordPinVersions(tool: ToolPin, owner: string, owners: Map<string, PinRequirement>): void {
    const declared = [
        ...(tool.version === undefined ? [] : [[`tool:${tool.name}`, tool.version] as const]),
        ...Object.entries(tool.installers).flatMap(([installer, pin]) =>
            pin.version === undefined ? [] : [[`${installer}:${pin.name}`, pin.version] as const],
        ),
    ];
    for (const [name, version] of declared) {
        const previous = owners.get(name);
        if (previous !== undefined && previous.version !== version)
            throw new GspotError('installation', [
                `Tool pin ${name} conflicts: ${previous.owner} requires ${previous.version}; ${owner} requires ${version}.`,
            ]);
        owners.set(name, { version, owner });
    }
}

/**
 * The constraints the Python tools set on the packages they pull in, each once, in order.
 * @param manifests the selected manifests.
 * @returns the constraints, such as `pyjwt>=2.14.0`.
 */
export function pythonConstraints(manifests: Manifest[]): string[] {
    const constraints = collectPins(manifests).flatMap((tool) =>
        toolProjectPackage(tool)?.kind === 'python' ? (tool.installers['pypi']?.constraints ?? []) : [],
    );
    return [...new Set(constraints)].toSorted((left, right) => left.localeCompare(right));
}

/**
 * Every distinct tool pin across the selection, sorted by name.
 * @param manifests the selected manifests.
 * @returns the pins.
 */
export function collectPins(manifests: Manifest[]): ToolPin[] {
    const pins = new Map<string, ToolPin>();
    const owners = new Map<string, PinRequirement>();
    for (const manifest of manifests)
        for (const tool of manifest.tools) {
            recordPinVersions(tool, manifest.configuration.name, owners);
            if (!pins.has(tool.name)) pins.set(tool.name, tool);
        }
    return pins
        .values()
        .toArray()
        .toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * The npm tools the tool project pins, as package name to version.
 * @param manifests the selected manifests.
 * @param runner the task runner; under mise, tools mise can pin stay out.
 * @returns package name to version, sorted.
 */
export function npmPins(manifests: Manifest[], runner: string | undefined): Record<string, string> {
    const pins: [string, string][] = [];
    for (const tool of collectPins(manifests)) {
        const installation = toolProjectPackage(tool, runner);
        if (installation?.kind === 'npm') pins.push([installation.name, installation.version]);
    }
    return Object.fromEntries(pins.toSorted(([a], [b]) => a.localeCompare(b)));
}

/**
 * One pinned requirement per Python tool, in `package==version` form.
 * @param manifests the selected manifests.
 * @returns one pinned requirement per Python tool.
 */
export function pythonPins(manifests: Manifest[]): string[] {
    return collectPins(manifests).flatMap((tool) => {
        const installation = toolProjectPackage(tool);
        return installation?.kind === 'python' ? [`${installation.name}==${installation.version}`] : [];
    });
}

/**
 * Resolve a pin from the owning configuration, shared declarations, or a repository-owned command.
 * @param manifests the manifests that may declare the tool.
 * @param name the executable name.
 * @param owner the configuration whose check or fixer consumes the tool.
 * @param preferred the already selected pin, retained when it names the requested executable.
 * @returns the declared pin or a host command when no configuration declares it.
 */
export function toolPin(manifests: Iterable<Manifest>, name: string, owner?: Manifest, preferred?: ToolPin): ToolPin {
    if (preferred?.name === name) return preferred;
    const own = owner?.tools.find((tool) => tool.name === name);
    if (own !== undefined) return own;
    for (const manifest of manifests) {
        const pin = manifest.tools.find((tool) => tool.name === name);
        if (pin !== undefined) return pin;
    }
    return { name, kind: 'binary', system: true, installers: {} };
}

/**
 * Add a check's native version requirement while preserving a stricter tool-wide floor.
 * @param tool the declared native tool
 * @param check the consumer's prerequisites
 * @returns the pin with its effective minimum version
 */
export function checkToolPin(tool: ToolPin, check: CheckDeclaration): ToolPin {
    const floor = check.min_versions?.[tool.name];
    if (floor === undefined || (tool.min_version !== undefined && semver.gte(tool.min_version, floor))) return tool;
    return { ...tool, min_version: floor };
}

/**
 * Read the declared executable or the first argument of a manifest command.
 * @param check the validated check declaration.
 * @returns the executable name, absent for an internal check without a tool.
 */
export function toolName(check: CheckDeclaration): string | undefined {
    return check.tool ?? check.command?.[0];
}

/**
 * Select the tool project installation used by both generated projects and tool resolution.
 * @param tool the pin
 * @param runner the task runner; under mise, tools mise can pin stay out
 * @returns the package to install, or undefined when the host or mise supplies it.
 */
export function toolProjectPackage(tool: ToolPin, runner?: string): ToolProjectPackage | undefined {
    const python = tool.installers['pypi'];
    if (tool.system !== true && python?.version !== undefined)
        return { kind: 'python', name: python.name, version: python.version };
    const npm = tool.installers['npm'];
    if (npm?.version === undefined || (runner === 'mise' && tool.installers['mise'] !== undefined)) return undefined;
    return { kind: 'npm', name: npm.name, version: npm.version };
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
 * The mise package and version, using the backend the manifest names.
 * @param tool the pin.
 * @returns the installer pin with its backend prefix, or undefined for a host tool.
 */
export function misePin(tool: ToolPin): InstallerPin | undefined {
    if (tool.system === true) return undefined;
    const backend = MISE_BACKENDS.find(({ installer }) => tool.installers[installer] !== undefined);
    if (backend === undefined) return undefined;
    const pin = tool.installers[backend.installer];
    return pin === undefined ? undefined : { ...pin, name: `${backend.prefix}${pin.name}` };
}

/**
 * The bundled Python bootstrap pin, including its required installer version.
 * @returns the declared uv mise pin
 */
export function pythonInstallerPin(): MisePin {
    const tool = configurationManifests()
        .get('python')
        ?.tools.find((entry) => entry.name === 'uv');
    const pin = tool === undefined ? undefined : pinOf(tool);
    if (pin === undefined) throw manifestError('python', ['tool uv requires a pinned mise installer version.']);
    return pin;
}

/**
 * Select tools that mise installs. Omit tools in npm and Python tool projects.
 * @param manifests the selected manifests.
 * @returns pins installed by mise.
 */
export function misePins(manifests: Manifest[]): MisePin[] {
    const tools = collectPins(manifests);
    const pins = tools.flatMap((tool) => pinOf(tool) ?? []);
    if (pythonPins(manifests).length > 0 && !tools.some((tool) => tool.name === 'uv')) pins.push(pythonInstallerPin());
    return pins;
}
