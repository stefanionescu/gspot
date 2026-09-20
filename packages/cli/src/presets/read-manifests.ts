// Read every embedded manifest, validate it, and refuse the shapes the design forbids.
import { parse as parseToml } from 'smol-toml';
import { compact } from '#cli/policy/normalize.ts';
import { TOOL_ANALYSES } from '#cli/run/analyses.ts';
import { listAssets, readAsset } from '#cli/platform/assets.ts';
import { manifestSchema, INSTALLER_KEYS } from '#cli/presets/manifest-schema.ts';
import type { RawCheck, RawManifest, RawTool, CheckSpec, Manifest, ToolPin } from '#types/manifest.ts';

const CONFIG_PLACEHOLDER = /\{config:([a-z0-9-]+)\}/gu;
const GSPOT_DIRECTORY = '.gspot/';

const state: { cache: Map<string, Manifest> | undefined } = { cache: undefined };

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
    if (raw.env !== undefined) tool.env = raw.env;
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

function isIdleManual(check: RawCheck): boolean {
    return (
        check.stage === 'manual' &&
        check.requires === undefined &&
        check.runs === 'per-file-list' &&
        check.command === undefined
    );
}

function hasNoRunner(check: RawCheck): boolean {
    const hasAnalysis = check.tool !== undefined && TOOL_ANALYSES[check.analysis ?? ''] !== undefined;
    return !hasAnalysis && check.command === undefined && check.engine === undefined && check.reported_by === undefined;
}

function checkProblems(check: RawCheck): string[] {
    const problems: (string | undefined)[] = [
        hasNoRunner(check) ? `check ${check.name} has neither a command nor an engine.` : undefined,
        check.fix_command !== undefined && check.fix_order === undefined
            ? `check ${check.name} has a fix_command and no fix_order.`
            : undefined,
        check.requires !== undefined && check.stage === 'commit'
            ? `check ${check.name} requires ${check.requires} and cannot run at the commit stage.`
            : undefined,
        isIdleManual(check) ? `check ${check.name} is manual with nothing that makes it slow.` : undefined,
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

function checkRequires(manifests: Map<string, Manifest>): void {
    for (const manifest of manifests.values())
        for (const required of manifest.preset.requires)
            if (!manifests.has(required))
                throw new ManifestError(manifest.preset.name, [`it requires \`${required}\`, which does not exist.`]);
}

/**
 * The name a `{config:<name>}` placeholder uses for a target: the file name under .gspot without its extensions.
 * @param target the target path
 * @returns the name
 */
export function configurationName(target: string): string {
    const bare = target.startsWith(GSPOT_DIRECTORY) ? target.slice(GSPOT_DIRECTORY.length) : target;
    const dot = bare.indexOf('.');
    return dot === -1 ? bare : bare.slice(0, dot);
}

/** A manifest that the schema or the design refuses. */
export class ManifestError extends Error {
    /**
     * Names the preset and lists its problems.
     * @param preset the preset name
     * @param problems the problems in plain English
     */
    constructor(preset: string, problems: string[]) {
        super(`The preset manifest for \`${preset}\` is not valid:\n${problems.join('\n')}`);
        this.name = 'ManifestError';
    }
}

/**
 * Parses one manifest text into a Manifest. Throws ManifestError.
 * @param text the manifest.toml text
 * @param dir the preset directory inside the assets
 * @returns the manifest
 */
export function parseManifest(text: string, dir: string): Manifest {
    const parsed = parseToml(text);
    const result = manifestSchema.safeParse(parsed);
    const presetName = result.success ? result.data.preset.name : dir;
    if (!result.success)
        throw new ManifestError(
            presetName,
            result.error.issues.map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`),
        );
    const raw = result.data;
    const problems = refusals(raw);
    if (problems.length > 0) throw new ManifestError(raw.preset.name, problems);
    return {
        preset: raw.preset,
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
 * Every embedded manifest by preset name. Read once per process.
 * @returns the manifests
 */
export function presetManifests(): Map<string, Manifest> {
    if (state.cache) return state.cache;
    const manifests = new Map<string, Manifest>();
    for (const path of listAssets('presets/')) {
        if (!path.endsWith('/manifest.toml')) continue;
        const dir = path.slice(0, -'/manifest.toml'.length);
        const manifest = parseManifest(readAsset(path), dir);
        const folder = dir.slice(dir.lastIndexOf('/') + 1);
        if (folder !== manifest.preset.name)
            throw new ManifestError(manifest.preset.name, [
                `the folder is \`${folder}\` and the name is \`${manifest.preset.name}\`; they must match.`,
            ]);
        manifests.set(manifest.preset.name, manifest);
    }
    checkRequires(manifests);
    state.cache = manifests;
    return manifests;
}
