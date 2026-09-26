// What makes a manifest invalid: a check that contradicts itself, a configuration nothing reads, or references
import semver from 'semver';
// between manifests that do not hold.
import { configurationName } from '#cli/configurations/targets.ts';
import type { CheckRule, Checks, Settings, Manifest, RawCheck, RawManifest } from '#cli/types/configurations.ts';

const CONFIG_PLACEHOLDER = /\{config:([a-z0-9-]+)\}/gu;
const SETTING_PLACEHOLDER = /\{setting:(?<name>[a-z\d_.-]+)\}/gu;

// Whether a check command carries a placeholder.
function commandHas(check: RawCheck, placeholder: string): boolean {
    return check.command?.includes(placeholder) === true;
}

// Each way a check declaration contradicts itself, with the sentence that reports it.
const CHECK_RULES: CheckRule[] = [
    {
        applies: (check) => check.nested_config !== undefined && check.cwd !== 'scope',
        problem: (check) => `check ${check.name} discovers nested configuration and requires cwd = scope.`,
    },
    {
        applies: (check) =>
            check.file_prefix !== undefined && (check.runs !== 'per-file-list' || !commandHas(check, '{files}')),
        problem: (check) =>
            `check ${check.name} prefixes file arguments and requires a per-file-list command with {files}.`,
    },
    {
        applies: (check) => {
            if (check.isolated_files !== true) return false;
            const perFile = check.runs === 'per-file-list' && commandHas(check, '{files}');
            const perScope = check.runs === 'per-scope' && commandHas(check, '{root}');
            return !perFile && !perScope;
        },
        problem: (check) =>
            `check ${check.name} isolates files and requires a per-file-list command with {files} or a per-scope command with {root}.`,
    },
    {
        applies: (check) =>
            check.reported_by !== undefined && (check.fix_command !== undefined || check.fix_order !== undefined),
        problem: (check) => `check ${check.name} is reported by another check and cannot declare a fixer.`,
    },
    {
        applies: (check) => check.fix_command !== undefined && check.fix_order === undefined,
        problem: (check) => `check ${check.name} has a fix_command and no fix_order.`,
    },
    {
        applies: (check) => check.fix_findings_exit_codes !== undefined && check.fix_command === undefined,
        problem: (check) => `check ${check.name} has fix_findings_exit_codes and no fix_command.`,
    },
    {
        applies: (check) => check.cached === true && check.engine === undefined && check.analysis === undefined,
        problem: (check) =>
            `check ${check.name} runs a command, which is cached unless cached = false; drop cached = true.`,
    },
    {
        applies: (check) => check.cached === false && (check.engine !== undefined || check.analysis !== undefined),
        problem: (check) =>
            `check ${check.name} is an analysis, which is not cached unless cached = true; drop cached = false.`,
    },
    {
        applies: (check) => check.requires !== undefined && check.stage === 'commit',
        problem: (check) => `check ${check.name} requires ${check.requires ?? ''} and cannot run at the commit stage.`,
    },
    {
        applies: (check) =>
            check.stage === 'manual' &&
            check.requires === undefined &&
            check.runs === 'per-file-list' &&
            check.command === undefined,
        problem: (check) => `check ${check.name} is manual with nothing that makes it slow.`,
    },
];

function configurationReaders(checks: RawCheck[]): Set<string> {
    const readers = new Set<string>();
    for (const check of checks)
        for (const argument of [
            ...(check.command ?? []),
            ...(check.fix_command ?? []),
            ...Object.values(check.env ?? {}),
        ])
            for (const match of argument.matchAll(CONFIG_PLACEHOLDER)) readers.add(match[1] ?? '');
    return readers;
}

// Refuses a manifest that requires a configuration no manifest declares.
function assertRequirementsExist(manifest: Manifest, manifests: Map<string, Manifest>): void {
    for (const required of manifest.configuration.requires)
        if (!manifests.has(required))
            throw new ManifestError(manifest.configuration.name, [
                `it requires \`${required}\`, which does not exist.`,
            ]);
}

// The checks a manifest declares itself, without the ones it references from another configuration.
function ownedChecks(manifest: Manifest): Manifest['checks'] {
    const references = manifest.configuration.check_references ?? [];
    return manifest.checks.filter((check) => !references.includes(check.name));
}

// Records the manifest as the owner of a check name, refusing a name another manifest already owns.
function claimOwner(owners: Map<string, string>, manifest: Manifest, check: Manifest['checks'][number]): void {
    const previous = owners.get(check.name);
    if (previous !== undefined)
        throw new ManifestError(manifest.configuration.name, [`check ${check.name} is already owned by ${previous}.`]);
    owners.set(check.name, manifest.configuration.name);
}

// The configuration that owns each check name, refusing a name two manifests declare.
function checkOwners(manifests: Map<string, Manifest>): Map<string, string> {
    const owners = new Map<string, string>();
    for (const manifest of manifests.values())
        for (const check of ownedChecks(manifest)) claimOwner(owners, manifest, check);
    return owners;
}

// Whether a check is a built-in engine check that runs once without a tool.
function isStandalone(check: Manifest['checks'][number] | undefined): boolean {
    if (check === undefined) return false;
    return check.engine !== undefined && check.runs === 'once' && check.tool === undefined;
}

// Whether a check runs a tool itself, not through the check that reports it.
function runsTool(check: Manifest['checks'][number] | undefined, tool: string): boolean {
    if (check === undefined || check.reported_by !== undefined) return false;
    return (check.tool ?? check.command?.[0]) === tool;
}

// Refuses a check reference that does not name another configuration's standalone built-in check.
function assertReferences(manifest: Manifest, checks: Checks, owners: Map<string, string>): void {
    for (const reference of manifest.configuration.check_references ?? []) {
        const owner = owners.get(reference);
        if (owner === undefined || owner === manifest.configuration.name || !isStandalone(checks.get(reference)))
            throw new ManifestError(manifest.configuration.name, [
                `Referenced check ${reference} must name another configuration's standalone built-in check that runs once.`,
            ]);
    }
}

// Refuses a takeover row whose check does not run the tool that declares it.
function assertTakeovers(manifest: Manifest, checks: Checks): void {
    for (const tool of manifest.tools)
        for (const takeover of tool.takeover ?? []) {
            if (takeover.check === undefined || runsTool(checks.get(takeover.check), tool.name)) continue;
            throw new ManifestError(manifest.configuration.name, [
                `takeover check ${takeover.check} must execute ${tool.name}.`,
            ]);
        }
}

// Refuses a chain of replacements that returns to a check it already passed.
function assertNoReplacementCycle(manifest: Manifest, check: Manifest['checks'][number], checks: Checks): void {
    const chain = [check.name];
    for (let next = check.takes_over; next !== undefined; next = checks.get(next)?.takes_over) {
        if (chain.includes(next))
            throw new ManifestError(manifest.configuration.name, [
                `Check replacement cycle: ${[...chain, next].join(' -> ')}.`,
            ]);
        chain.push(next);
    }
}

// Refuses a reporting or replacement target that is not a different executable check, or that forms a cycle.
function assertReporting(manifest: Manifest, check: Manifest['checks'][number], checks: Checks): void {
    for (const field of ['reported_by', 'takes_over'] as const) {
        const target = check[field];
        if (target === undefined) continue;
        const owner = checks.get(target);
        if (owner === undefined || target === check.name || owner.reported_by !== undefined)
            throw new ManifestError(manifest.configuration.name, [
                `check ${check.name} ${field} must name a different executable check; received ${target}.`,
            ]);
    }
    assertNoReplacementCycle(manifest, check, checks);
}

// Whether a pinned version sits below the floor the manifest names, comparing the versions both can coerce.
function isBelowFloor(tool: Manifest['tools'][number]): boolean {
    const pinned = semver.coerce(tool.version);
    const floor = semver.coerce(tool.floor);
    return pinned !== null && floor !== null && semver.lt(pinned, floor);
}

function assertToolPin(manifest: Manifest, tool: Manifest['tools'][number]): void {
    const isUnpinned =
        tool.version === undefined && Object.values(tool.installers).some((entry) => entry.version === undefined);
    if (isUnpinned && tool.floor === undefined)
        throw new ManifestError(manifest.configuration.name, [`tool ${tool.name} has no version and no floor.`]);
    if (isBelowFloor(tool))
        throw new ManifestError(manifest.configuration.name, [
            `tool ${tool.name} pins ${tool.version ?? ''}, below its floor ${tool.floor ?? ''}.`,
        ]);
}

// Refuses the tools nobody pins; a host tool needs no pin.
function assertToolPins(manifest: Manifest): void {
    for (const tool of manifest.tools) if (tool.provider !== 'host') assertToolPin(manifest, tool);
}

// Whether a setting's default is nothing: unset, empty, off, or an empty list.
function isEmptyDefault(spec: Manifest['settings'][number]): boolean {
    const value = spec.default;
    return value === undefined || value === '' || value === false || (Array.isArray(value) && value.length === 0);
}

// The settings a check's commands read through {setting:...} placeholders.
function settingsRead(check: Manifest['checks'][number]): string[] {
    const parts = [...(check.command ?? []), ...(check.fix_command ?? [])];
    const names = parts.flatMap((part) =>
        [...part.matchAll(SETTING_PLACEHOLDER)].map((match) => match.groups?.['name'] ?? ''),
    );
    return [...new Set(names)];
}

// Refuses a check that reads a setting with an empty default without waiting for it, or waits for a setting nobody declares.
function assertSettingWait(manifest: Manifest, check: Manifest['checks'][number], settings: Settings): void {
    if (check.waits_for !== undefined && !settings.has(check.waits_for))
        throw new ManifestError(manifest.configuration.name, [
            `check ${check.name} waits for ${check.waits_for}, which no configuration declares.`,
        ]);
    for (const name of settingsRead(check)) {
        const spec = settings.get(name);
        if (spec !== undefined && isEmptyDefault(spec) && check.waits_for !== name)
            throw new ManifestError(manifest.configuration.name, [
                `check ${check.name} reads ${name}, whose default is empty, and must wait for it.`,
            ]);
    }
}

// Refuses every check that reads an empty setting without waiting for it.
function assertSettingWaits(manifest: Manifest, settings: Settings): void {
    for (const check of manifest.checks) assertSettingWait(manifest, check, settings);
}

export class ManifestError extends Error {
    /**
     * Names the configuration and lists its problems.
     * @param configuration the configuration name
     * @param problems the problems in plain English
     */
    constructor(configuration: string, problems: string[]) {
        super(`The configuration manifest for \`${configuration}\` is not valid:\n${problems.join('\n')}`);
        this.name = 'ManifestError';
    }
}

/**
 * The sentences that say how a check declaration contradicts itself.
 * @param check the raw check
 * @returns the problems, empty when the declaration holds
 */
export function checkProblems(check: RawCheck): string[] {
    return CHECK_RULES.filter((rule) => rule.applies(check)).map((rule) => rule.problem(check));
}

/**
 * The generated configurations of a manifest that no check reads and no pointer names.
 * @param raw the parsed manifest
 * @returns the problems, empty when every configuration is read
 */
export function configurationProblems(raw: RawManifest): string[] {
    const readers = configurationReaders(raw.checks);
    const hasEngineCheck = raw.checks.some((check) => check.engine !== undefined);
    if (hasEngineCheck) return [];
    return raw.configs
        .filter((config) => !config.fragment && config.pointer === undefined)
        .filter((config) => {
            const name = configurationName(config.target);
            const isReadByTemplate = raw.configs.some(
                (other) => other !== config && other.template?.includes(name) === true,
            );
            return !readers.has(name) && !isReadByTemplate;
        })
        .map(
            (config) =>
                `config ${config.target} has no check that reads it ({config:${configurationName(config.target)}}) and no pointer.`,
        );
}

/**
 * Validate required configurations, tool pins, setting waits, unique checks, and executable reporting and replacement owners before accepting a manifest collection.
 * @param manifests every manifest by name
 */
export function validateManifests(manifests: Map<string, Manifest>): void {
    const settings: Settings = new Map(
        [...manifests.values()].flatMap((manifest) => manifest.settings.map((spec) => [spec.name, spec] as const)),
    );
    for (const manifest of manifests.values()) {
        assertRequirementsExist(manifest, manifests);
        assertToolPins(manifest);
        assertSettingWaits(manifest, settings);
    }
    const owners = checkOwners(manifests);
    const checks: Checks = new Map(
        [...manifests.values()].flatMap((manifest) => manifest.checks.map((check) => [check.name, check] as const)),
    );
    for (const manifest of manifests.values()) {
        assertReferences(manifest, checks, owners);
        assertTakeovers(manifest, checks);
        for (const check of manifest.checks) assertReporting(manifest, check, checks);
    }
} // Refuses a tool nobody pins: no version on the tool or on every installer, and no floor the repository supplies.
