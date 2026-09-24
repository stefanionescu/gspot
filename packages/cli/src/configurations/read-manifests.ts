// Read every embedded manifest, validate it, and refuse the shapes the design forbids.
import type { z } from 'zod';
import { parse as parseToml } from 'smol-toml';
import { compact } from '#cli/policy/normalize.ts';
import { configurationName } from '#cli/run/scope-paths.ts';
import { listAssets, readAsset } from '#cli/platform/assets.ts';
import { manifestSchema, INSTALLER_KEYS } from '#cli/configurations/schema.ts';
import type { SettingSpec, RawCheck, RawManifest, RawTool, CheckSpec } from '#cli/configurations/schema.ts';

const CONFIG_PLACEHOLDER = /\{config:([a-z0-9-]+)\}/gu;

const state: { cache: Map<string, Manifest> | undefined } = { cache: undefined };

function issueLines(issue: z.core.$ZodIssue): string[] {
    const line = `${issue.path.map(String).join('.')}: ${issue.message}`;
    return issue.code === 'invalid_union'
        ? [line, ...issue.errors.flatMap((branch) => branch.flatMap(issueLines))]
        : [line];
}

function installerPins(raw: RawTool): ToolPin['installers'] {
    const installers: ToolPin['installers'] = {};
    for (const key of INSTALLER_KEYS) {
        const value = raw[key];
        if (value === undefined) continue;
        installers[key] = typeof value === 'string' ? { name: value } : value;
        if (typeof value === 'string' && raw.version !== undefined) installers[key].version = raw.version;
    }
    return installers;
}

function toTool(raw: RawTool): ToolPin {
    const tool: ToolPin = { name: raw.name, kind: raw.kind, windows: raw.windows, installers: installerPins(raw) };
    if (raw.version !== undefined) tool.version = raw.version;
    if (raw.floor !== undefined) tool.floor = raw.floor;
    if (raw.provider !== undefined) tool.provider = raw.provider;
    if (raw.version_command !== undefined) tool.version_command = raw.version_command;
    if (raw.version_exit_code !== undefined) tool.version_exit_code = raw.version_exit_code;
    if (raw.version_regex !== undefined) tool.version_regex = raw.version_regex;
    if (raw.suppression !== undefined) tool.suppression = raw.suppression;
    if (raw.env !== undefined) tool.env = raw.env;
    if (raw.takeover !== undefined) tool.takeover = raw.takeover;
    if (raw.query_packs !== undefined) tool.query_packs = raw.query_packs;
    return tool;
}

function toCheck(raw: RawCheck): CheckSpec {
    const { claims, ...rest } = raw;
    const check = compact(rest) as CheckSpec;
    if (claims) {
        const { extensions, filenames, tags, paths, from_languages: isFromLanguages, natures } = claims;
        check.claims = { extensions, filenames, tags, paths, from_languages: isFromLanguages, natures };
    }
    return check;
}

function checkProblems(check: RawCheck): string[] {
    const problems: (string | undefined)[] = [
        check.nested_config !== undefined && check.cwd !== 'scope'
            ? `check ${check.name} discovers nested configuration and requires cwd = scope.`
            : undefined,
        check.file_prefix !== undefined && (check.runs !== 'per-file-list' || !check.command?.includes('{files}'))
            ? `check ${check.name} prefixes file arguments and requires a per-file-list command with {files}.`
            : undefined,
        check.isolated_files === true &&
        !(
            (check.runs === 'per-file-list' && check.command?.includes('{files}')) ||
            (check.runs === 'per-scope' && check.command?.includes('{root}'))
        )
            ? `check ${check.name} isolates files and requires a per-file-list command with {files} or a per-scope command with {root}.`
            : undefined,
        check.reported_by !== undefined && (check.fix_command !== undefined || check.fix_order !== undefined)
            ? `check ${check.name} is reported by another check and cannot declare a fixer.`
            : undefined,
        check.fix_command !== undefined && check.fix_order === undefined
            ? `check ${check.name} has a fix_command and no fix_order.`
            : undefined,
        check.fix_findings_exit_codes !== undefined && check.fix_command === undefined
            ? `check ${check.name} has fix_findings_exit_codes and no fix_command.`
            : undefined,
        check.requires !== undefined && check.stage === 'commit'
            ? `check ${check.name} requires ${check.requires} and cannot run at the commit stage.`
            : undefined,
        check.stage === 'manual' &&
        check.requires === undefined &&
        check.runs === 'per-file-list' &&
        check.command === undefined
            ? `check ${check.name} is manual with nothing that makes it slow.`
            : undefined,
    ];
    return problems.filter((problem) => problem !== undefined);
}

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

function configurationProblems(raw: RawManifest): string[] {
    const readers = configurationReaders(raw.checks);
    const hasEngineCheck = raw.checks.some((check) => check.engine !== undefined);
    if (hasEngineCheck) return [];
    return raw.configs
        .filter((config) => !config.fragment && config.stub === undefined)
        .filter((config) => {
            const name = configurationName(config.target);
            const isReadByTemplate = raw.configs.some((other) => other !== config && other.template.includes(name));
            return !readers.has(name) && !isReadByTemplate;
        })
        .map(
            (config) =>
                `config ${config.target} has no check that reads it ({config:${configurationName(config.target)}}) and no stub.`,
        );
}

function refusals(raw: RawManifest): string[] {
    return [...raw.checks.flatMap((check) => checkProblems(check)), ...configurationProblems(raw)];
}

/** A manifest that the schema or the design refuses. */
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
 * Parses one manifest text into a Manifest. Throws ManifestError.
 * @param text the manifest.toml text
 * @param dir the configuration directory inside the assets
 * @returns the manifest
 */
export function parseManifest(text: string, dir: string): Manifest {
    const parsed = parseToml(text);
    const result = manifestSchema.safeParse(parsed);
    const configurationName = result.success ? result.data.configuration.name : dir;
    if (!result.success)
        throw new ManifestError(configurationName, [...new Set(result.error.issues.flatMap(issueLines))]);
    const raw = result.data;
    const problems = refusals(raw);
    if (raw.checks.some((check) => raw.configuration.check_references?.includes(check.name)))
        problems.push('A configuration cannot both declare and reference the same check.');
    if (problems.length > 0) throw new ManifestError(raw.configuration.name, problems);
    return {
        configuration: raw.configuration,
        untracked: raw.untracked,
        detect: raw.detect,
        claims: raw.claims,
        tools: raw.tools.map((tool) => toTool(tool)),
        configs: raw.configs,
        checks: raw.checks.map((check) => toCheck(check)),
        settings: raw.settings.map((setting) => compact(setting)),
        coverage: raw.coverage,
        rule_files: raw.rule_files,
        required_rules: raw.required_rules,
        dir,
    };
}

/**
 * Validate required configurations, unique checks, and executable reporting and replacement owners before accepting a manifest collection.
 * @param manifests
 */
export function validateManifests(manifests: Map<string, Manifest>): void {
    const owners = new Map<string, string>();
    for (const manifest of manifests.values()) {
        for (const required of manifest.configuration.requires)
            if (!manifests.has(required))
                throw new ManifestError(manifest.configuration.name, [
                    `it requires \`${required}\`, which does not exist.`,
                ]);
        for (const check of manifest.checks) {
            if (manifest.configuration.check_references?.includes(check.name)) continue;
            const previous = owners.get(check.name);
            if (previous !== undefined)
                throw new ManifestError(manifest.configuration.name, [
                    `check ${check.name} is already owned by ${previous}.`,
                ]);
            owners.set(check.name, manifest.configuration.name);
        }
    }
    const checks = new Map(
        [...manifests.values()].flatMap((manifest) => manifest.checks.map((check) => [check.name, check] as const)),
    );
    for (const manifest of manifests.values()) {
        for (const reference of manifest.configuration.check_references ?? []) {
            const target = checks.get(reference);
            if (
                target === undefined ||
                !owners.has(reference) ||
                owners.get(reference) === manifest.configuration.name ||
                target.engine === undefined ||
                target.runs !== 'once' ||
                target.command !== undefined ||
                target.tool !== undefined ||
                target.reported_by !== undefined
            )
                throw new ManifestError(manifest.configuration.name, [
                    `Referenced check ${reference} must name another configuration's standalone built-in check that runs once.`,
                ]);
        }
        for (const tool of manifest.tools) {
            for (const takeover of tool.takeover ?? []) {
                if (takeover.check === undefined) continue;
                const target = checks.get(takeover.check);
                if (
                    target === undefined ||
                    target.reported_by !== undefined ||
                    (target.tool ?? target.command?.[0]) !== tool.name
                )
                    throw new ManifestError(manifest.configuration.name, [
                        `takeover check ${takeover.check} must execute ${tool.name}.`,
                    ]);
            }
        }
        for (const check of manifest.checks) {
            for (const field of ['reported_by', 'takes_over'] as const) {
                const target = check[field];
                if (target === undefined) continue;
                const owner = checks.get(target);
                if (owner === undefined || target === check.name || owner.reported_by !== undefined)
                    throw new ManifestError(manifest.configuration.name, [
                        `check ${check.name} ${field} must name a different executable check; received ${target}.`,
                    ]);
            }
            const chain = [check.name];
            let next = check.takes_over;
            while (next !== undefined) {
                if (chain.includes(next))
                    throw new ManifestError(manifest.configuration.name, [
                        `Check replacement cycle: ${[...chain, next].join(' -> ')}.`,
                    ]);
                chain.push(next);
                next = checks.get(next)?.takes_over;
            }
        }
    }
}

/**
 * Every embedded manifest by configuration name. Read once per process.
 * @returns the manifests
 */
export function configurationManifests(): Map<string, Manifest> {
    if (state.cache) return state.cache;
    const manifests = new Map<string, Manifest>();
    for (const path of listAssets('packages/cli/configurations/')) {
        if (!path.endsWith('/manifest.toml')) continue;
        const dir = path.slice(0, -'/manifest.toml'.length);
        const manifest = parseManifest(readAsset(path), dir);
        const folder = dir.slice(dir.lastIndexOf('/') + 1);
        if (folder !== manifest.configuration.name)
            throw new ManifestError(manifest.configuration.name, [
                `the folder is \`${folder}\` and the name is \`${manifest.configuration.name}\`; they must match.`,
            ]);
        if (manifests.has(manifest.configuration.name))
            throw new ManifestError(manifest.configuration.name, ['The configuration name is already registered.']);
        manifests.set(manifest.configuration.name, manifest);
    }
    validateManifests(manifests);
    const declaredChecks = new Map(
        [...manifests.values()].flatMap((manifest) => manifest.checks.map((check) => [check.name, check] as const)),
    );
    for (const manifest of manifests.values())
        for (const reference of new Set(manifest.configuration.check_references)) {
            const check = declaredChecks.get(reference);
            if (check !== undefined) manifest.checks.push(check);
        }
    state.cache = new Map([...manifests].toSorted(([first], [second]) => first.localeCompare(second)));
    return state.cache;
}

type NpmInstallerDefinition = Exclude<NonNullable<RawTool['npm']>, string>;

export type ConfigurationHeader = Omit<RawManifest['configuration'], 'check_references'> & {
    check_references?: RawManifest['configuration']['check_references'];
};

export type InstallerPin = Pick<NpmInstallerDefinition, 'name'> & Partial<Omit<NpmInstallerDefinition, 'name'>>;

export type ToolPin = {
    name: string;
    kind?: 'binary' | 'library';
    version?: string;
    floor?: string;
    provider?: 'host';
    windows: boolean;
    version_command?: string[];
    version_exit_code?: number;
    version_regex?: string;
    suppression?: NonNullable<RawTool['suppression']>;
    takeover?: NonNullable<RawTool['takeover']>;
    query_packs?: NonNullable<RawTool['query_packs']>;
    env?: Record<string, string>;
    installers: Record<string, InstallerPin>;
};

export type Manifest = Omit<RawManifest, 'configuration' | 'tools' | 'checks' | 'settings'> & {
    configuration: ConfigurationHeader;
    tools: ToolPin[];
    checks: CheckSpec[];
    settings: SettingSpec[];
    dir: string;
};
