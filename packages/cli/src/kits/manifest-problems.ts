// What makes a manifest invalid: a check that contradicts itself, a configuration nothing reads, or references
// between manifests that do not hold.
import semver from 'semver';
import { kitName } from '#cli/kits/targets.ts';
import { MANIFEST_CONFIG_PLACEHOLDER } from '#cli/config/kits.ts';
import { SETTING_PLACEHOLDER } from '#cli/config/execution/execution.ts';
import type { Checks, Manifest, RawCheck, Settings, CheckRule, RawManifest } from '#cli/types/kits.ts';
// Each way a check declaration contradicts itself, with the sentence that reports it.
const CHECK_RULES: CheckRule[] = [
    {
        applies: (check) => check.nested_config !== undefined && check.cwd !== 'scope',
        problem: (check) => `check ${check.name} discovers nested configuration and requires cwd = scope.`,
    },
    {
        applies: (check) =>
            check.file_prefix !== undefined &&
            (check.runs !== 'per-file-list' || check.command?.includes('{files}') !== true),
        problem: (check) =>
            `check ${check.name} prefixes file arguments and requires a per-file-list command with {files}.`,
    },
    {
        applies: (check) => {
            if (check.isolated_files !== true) return false;
            const perFile = check.runs === 'per-file-list' && check.command?.includes('{files}') === true;
            const perScope = check.runs === 'per-scope' && check.command?.includes('{root}') === true;
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
            for (const match of argument.matchAll(MANIFEST_CONFIG_PLACEHOLDER)) readers.add(match[1] ?? '');
    return readers;
}

// Refuses a manifest that requires a configuration no manifest declares.
function assertRequirementsExist(manifest: Manifest, manifests: Map<string, Manifest>): void {
    for (const required of manifest.kit.requires)
        if (!manifests.has(required))
            throw new ManifestError(manifest.kit.name, [`it requires \`${required}\`, which does not exist.`]);
}

// Records the manifest as the owner of a check name, refusing a name another manifest already owns.
function claimOwner(owners: Map<string, string>, manifest: Manifest, check: Manifest['checks'][number]): void {
    const previous = owners.get(check.name);
    if (previous !== undefined)
        throw new ManifestError(manifest.kit.name, [`check ${check.name} is already owned by ${previous}.`]);
    owners.set(check.name, manifest.kit.name);
}

// The configuration that owns each check name, refusing a name two manifests declare.
function checkOwners(manifests: Map<string, Manifest>): Map<string, string> {
    const owners = new Map<string, string>();
    for (const manifest of manifests.values()) {
        const references = manifest.kit.check_references ?? [];
        for (const check of manifest.checks.filter((entry) => !references.includes(entry.name)))
            claimOwner(owners, manifest, check);
    }
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

// Refuses a check reference that does not name another kit's standalone built-in check.
function assertReferences(manifest: Manifest, checks: Checks, owners: Map<string, string>): void {
    for (const reference of manifest.kit.check_references ?? []) {
        const owner = owners.get(reference);
        if (owner === undefined || owner === manifest.kit.name || !isStandalone(checks.get(reference)))
            throw new ManifestError(manifest.kit.name, [
                `Referenced check ${reference} must name another kit's standalone built-in check that runs once.`,
            ]);
    }
}

// Refuses a replace row whose check does not run the tool that declares it.
function assertReplaces(manifest: Manifest, checks: Checks): void {
    for (const tool of manifest.tools)
        for (const replace of tool.replace ?? []) {
            if (replace.check === undefined || runsTool(checks.get(replace.check), tool.name)) continue;
            throw new ManifestError(manifest.kit.name, [`replace check ${replace.check} must execute ${tool.name}.`]);
        }
}

// Refuses a chain of replacements that returns to a check it already passed.
function assertNoReplacementCycle(manifest: Manifest, check: Manifest['checks'][number], checks: Checks): void {
    const chain = [check.name];
    for (let next = check.replaces; next !== undefined; next = checks.get(next)?.replaces) {
        if (chain.includes(next))
            throw new ManifestError(manifest.kit.name, [`Check replacement cycle: ${[...chain, next].join(' -> ')}.`]);
        chain.push(next);
    }
}

// Refuses a reporting or replacement target that is not a different executable check, or that forms a cycle.
function assertReporting(manifest: Manifest, check: Manifest['checks'][number], checks: Checks): void {
    for (const field of ['reported_by', 'replaces'] as const) {
        const target = check[field];
        if (target === undefined) continue;
        const owner = checks.get(target);
        if (owner === undefined || target === check.name || owner.reported_by !== undefined)
            throw new ManifestError(manifest.kit.name, [
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
        throw new ManifestError(manifest.kit.name, [`tool ${tool.name} has no version and no floor.`]);
    if (isBelowFloor(tool))
        throw new ManifestError(manifest.kit.name, [
            `tool ${tool.name} pins ${tool.version ?? ''}, below its floor ${tool.floor ?? ''}.`,
        ]);
}

// The settings a check's commands read through `{setting:...}` placeholders.
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
        throw new ManifestError(manifest.kit.name, [
            `check ${check.name} waits for ${check.waits_for}, which no configuration declares.`,
        ]);
    const missing = settingsRead(check).filter((name) => {
        if (name === check.waits_for) return false;
        const spec = settings.get(name);
        if (spec === undefined) return false;
        const value = spec.default;
        return value === undefined || value === '' || value === false || (Array.isArray(value) && value.length === 0);
    });
    for (const name of missing)
        throw new ManifestError(manifest.kit.name, [
            `check ${check.name} reads ${name}, whose default is empty, and must wait for it.`,
        ]);
}

export class ManifestError extends Error {
    /**
     * Names the configuration and lists its problems.
     * @param configuration the configuration name
     * @param problems the problems in plain English
     */
    constructor(configuration: string, problems: string[]) {
        super(`The kit manifest for \`${configuration}\` is not valid:\n${problems.join('\n')}`);
        this.name = 'ManifestError';
    }
}

/**
 * Contradictory check declarations and generated configurations with no reader or pointer.
 * @param raw the parsed manifest
 * @returns the problems, empty when every kit is read
 */
export function manifestProblems(raw: RawManifest): string[] {
    const checks = raw.checks.flatMap((check) =>
        CHECK_RULES.filter((rule) => rule.applies(check)).map((rule) => rule.problem(check)),
    );
    const readers = configurationReaders(raw.checks);
    const hasEngineCheck = raw.checks.some((check) => check.engine !== undefined);
    if (hasEngineCheck) return checks;
    const configurations = raw.configs
        .filter((config) => !config.fragment && config.pointer === undefined)
        .filter((config) => {
            const name = kitName(config.target);
            const isReadByTemplate = raw.configs.some(
                (other) => other !== config && other.template?.includes(name) === true,
            );
            return !readers.has(name) && !isReadByTemplate;
        })
        .map(
            (config) =>
                `config ${config.target} has no check that reads it ({config:${kitName(config.target)}}) and no pointer.`,
        );
    return [...checks, ...configurations];
}

/**
 * Validate required kits, tool pins, setting waits, unique checks, and executable reporting and replacement owners before accepting a manifest collection.
 * @param manifests every manifest by name
 */
export function validateManifests(manifests: Map<string, Manifest>): void {
    const settings: Settings = new Map(
        [...manifests.values()].flatMap((manifest) => manifest.settings.map((spec) => [spec.name, spec] as const)),
    );
    for (const manifest of manifests.values()) {
        assertRequirementsExist(manifest, manifests);
        for (const tool of manifest.tools.filter((entry) => entry.provider !== 'host')) assertToolPin(manifest, tool);
        for (const check of manifest.checks) assertSettingWait(manifest, check, settings);
    }
    const owners = checkOwners(manifests);
    const checks: Checks = new Map(
        [...manifests.values()].flatMap((manifest) => manifest.checks.map((check) => [check.name, check] as const)),
    );
    for (const manifest of manifests.values()) {
        assertReferences(manifest, checks, owners);
        assertReplaces(manifest, checks);
        for (const check of manifest.checks) assertReporting(manifest, check, checks);
    }
}
