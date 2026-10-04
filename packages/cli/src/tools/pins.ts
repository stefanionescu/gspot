import { GspotError } from '#cli/platform/errors.ts';
import type { PinRequirement } from '#cli/types/tools/install.ts';
import { privateToolInstallation } from '#cli/tools/installation.ts';
import type { ToolPin, Manifest, CheckSpec } from '#cli/types/configurations.ts';

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
        privateToolInstallation(tool)?.kind === 'python' ? (tool.installers['pypi']?.constraints ?? []) : [],
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
 * The npm tools the private tool project pins, as package name to version.
 * @param manifests the selected manifests.
 * @param runner the task runner; under mise, tools mise can pin stay out.
 * @returns package name to version, sorted.
 */
export function npmPins(manifests: Manifest[], runner: string | undefined): Record<string, string> {
    const pins: [string, string][] = [];
    for (const tool of collectPins(manifests)) {
        const installation = privateToolInstallation(tool, runner);
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
        const installation = privateToolInstallation(tool);
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
 * Read the declared executable or the first argument of a manifest command.
 * @param check the validated check declaration.
 * @returns the executable name, absent for an internal check without a tool.
 */
export function toolName(check: CheckSpec): string | undefined {
    return check.tool ?? check.command?.[0];
}
