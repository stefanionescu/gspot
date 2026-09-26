import type { Manifest, ToolPin } from '#cli/types/configurations.ts';

/**
 * Select the private installation used by both generated projects and tool resolution.
 * @param tool the pin
 * @param runner the task runner; under mise, tools mise can pin stay out
 * @returns the package to install privately, or undefined for a host tool or one mise pins
 */
export function privateToolInstallation(
    tool: ToolPin,
    runner?: string,
): { kind: 'npm' | 'python'; name: string; version: string } | undefined {
    if (tool.provider === 'host') return undefined;
    const python = tool.installers['pypi'];
    if (python?.version !== undefined) return { kind: 'python', name: python.name, version: python.version };
    const npm = tool.installers['npm'];
    if (npm?.version === undefined || (runner === 'mise' && tool.installers['mise'] !== undefined)) return undefined;
    return { kind: 'npm', name: npm.name, version: npm.version };
}

/**
 * Every distinct tool pin across the selection, sorted by name.
 * @param manifests the selected manifests
 * @returns the pins
 */
export function collectPins(manifests: Manifest[]): ToolPin[] {
    const pins = new Map<string, ToolPin>();
    for (const manifest of manifests)
        for (const tool of manifest.tools) if (!pins.has(tool.name)) pins.set(tool.name, tool);
    return pins
        .values()
        .toArray()
        .toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * The devDependencies an npm-family task runner pins.
 * @param manifests the selected manifests
 * @param runner the task runner; under mise, tools mise can pin stay out
 * @returns package name to version, sorted
 */
export function npmPins(manifests: Manifest[], runner = 'npm'): Record<string, string> {
    const pins: [string, string][] = [];
    for (const tool of collectPins(manifests)) {
        const installation = privateToolInstallation(tool, runner);
        if (installation?.kind === 'npm') pins.push([installation.name, installation.version]);
    }
    return Object.fromEntries(pins.toSorted(([a], [b]) => a.localeCompare(b)));
}

/**
 * Select exact Python tool requirements from their implementation owners.
 * @param manifests the selected manifests
 * @returns one pinned requirement per Python tool
 */
export function pythonPins(manifests: Manifest[]): string[] {
    return collectPins(manifests).flatMap((tool) => {
        const installation = privateToolInstallation(tool);
        return installation?.kind === 'python' ? [`${installation.name}==${installation.version}`] : [];
    });
}

/** An installer could not make the already validated, locked tools available. */
export class InstallationError extends Error {
    /**
     * Names the installation that failed.
     * @param message what the installer reported
     */
    constructor(message: string) {
        super(message);
        this.name = 'InstallationError';
    }
}
