// Validated file declarations and native tool pin calculations.
import semver from 'semver';
import { posix } from 'node:path';
import { compact } from '#cli/platform/contracts.ts';
import { GspotError } from '#cli/platform/public.ts';
import type { ToolPin, InstallerPin } from '#cli/types/parsers/tool.ts';
import { OPERATING_SYSTEMS } from '#cli/config/platform/operating-systems.ts';
import { NPM_REQUIRES, CONFIG_PREFIX, MISE_BACKENDS } from '#cli/config/configurations.ts';

import type {
    MisePin,
    Manifest,
    OwnedCheck,
    PinRequirement,
    ToolProjectPins,
    CheckDeclaration,
    ToolProjectPackage,
    ToolFileDeclaration,
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
 * Every declared check by ID, with the configuration that ships it.
 * @param manifests the manifests to index
 * @returns the declared checks by ID
 */
export function allChecks(manifests: Iterable<Manifest>): Map<string, OwnedCheck> {
    const checks = new Map<string, OwnedCheck>();
    for (const manifest of manifests) {
        for (const check of manifest.checks) {
            if (checks.has(check.name)) throw new Error(`Duplicate check identity: ${check.name}`);
            checks.set(check.name, { check, configuration: manifest });
        }
    }
    return checks;
}

/**
 * The repository-relative path of a tool file generated for a scope.
 * @param scope the scope path, empty for the root
 * @param toolFile the tool-file declaration
 * @returns the path of the generated tool file
 */
export function targetInScope(scope: string, toolFile: ToolFileDeclaration): string {
    if (scope === '' || !toolFile.per_scope) return toolFile.target;
    if (toolFile.target.startsWith(CONFIG_PREFIX))
        return posix.join(CONFIG_PREFIX, scope, toolFile.target.slice(CONFIG_PREFIX.length));
    return `${scope}/${toolFile.target}`;
}

/**
 * The name a `{tool_file:<name>}` placeholder uses for a tool file.
 * @param target the target path
 * @returns the file name under .gspot/config without its extensions
 */
export function toolFileName(target: string): string {
    const bare = target.startsWith(CONFIG_PREFIX) ? target.slice(CONFIG_PREFIX.length) : target;
    const dot = bare.indexOf('.');
    return dot === -1 ? bare : bare.slice(0, dot);
}

/**
 * The selected Semgrep packs and repository rule paths for one scope.
 * @param selected the configurations this scope selects
 * @param scope the repository-relative scope path
 * @param authored the resolved repository rule paths
 * @returns the required native rule paths, relative to the repository
 */
export function semgrepRuleFiles(selected: Manifest[], scope: string, authored: string[]): string[] {
    const declared = selected.flatMap((manifest) =>
        manifest.toolFiles
            .filter((file) => file.tool.includes('semgrep') && file.rule_keys?.includes('rules') === true)
            .map((file) => targetInScope(scope, file)),
    );
    return [...new Set([...declared, ...authored])];
}

/**
 * The pin mise installs for one tool: its version, its platforms, and its backend options.
 * @param tool the pin.
 * @returns the mise pin, or undefined when mise does not install the tool.
 */
export function pinOf(tool: ToolPin): MisePin | undefined {
    const excluded = toolProjectPackage(tool, 'mise') !== undefined;
    const pin = excluded ? undefined : misePin(tool);
    if (pin?.version === undefined) return undefined;
    return { name: pin.name, version: pin.version, ...compact({ os: miseOs(tool), options: pin.options }) };
}

/**
 * The npm and Python project requirements declared by a selection, in native package order.
 * @param manifests the selected manifests
 * @param runner the runner that owns mise-installed npm tools
 * @returns npm versions, Python pins, and distinct Python constraints
 */
export function toolProjectPins(manifests: Manifest[], runner?: string): ToolProjectPins {
    const npm: [string, string][] = [];
    const python: string[] = [];
    const constraints: string[] = [];
    for (const tool of collectPins(manifests)) {
        const installation = toolProjectPackage(tool, runner);
        if (installation === undefined) continue;
        if (installation.kind === 'npm') npm.push([installation.name, installation.version]);
        if (installation.kind !== 'python') continue;
        python.push(`${installation.name}==${installation.version}`);
        constraints.push(...(tool.installers['pypi']?.constraints ?? []));
    }
    return {
        npm: Object.fromEntries(npm.toSorted(([a], [b]) => a.localeCompare(b))),
        python,
        constraints: [...new Set(constraints)].toSorted((a, b) => a.localeCompare(b)),
    };
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
    return typeof check.tool === 'string' ? check.tool : check.command?.[0];
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
    return {
        kind: 'npm',
        name: npm.name,
        version: npm.version,
        requires: [NPM_REQUIRES, tool.requires].flatMap((peers) => peers ?? []),
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

// The accepted floor applies equally to host tools and pinned tool-project tools.
/**
 * Compare a native version with its accepted floor.
 * @param found the observed version
 * @param floor the accepted minimum
 * @returns whether the observed version is below the floor
 */
export function isBelowFloor(found: string | undefined, floor: string | undefined): boolean {
    const version = semver.coerce(found);
    const lowest = semver.coerce(floor);
    return version !== null && lowest !== null && semver.lt(version, lowest);
}
