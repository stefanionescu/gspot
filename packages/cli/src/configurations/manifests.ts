import type { z } from 'zod';
import { parse as parseToml } from 'smol-toml';
import { compact } from '#cli/policy/normalize.ts';
import { PRIVATE_PATHS } from '#cli/platform/paths.ts';
import { listAssets, readAsset } from '#cli/platform/assets.ts';
import { INSTALLER_KEYS, manifestSchema } from '#cli/configurations/schema.ts';
import type { Manifest, ToolPin, CheckSpec, RawCheck, RawTool } from '#cli/types/configurations.ts';

import {
    checkProblems,
    configurationProblems,
    ManifestError,
    validateManifests,
} from '#cli/configurations/manifest-problems.ts';

const state: { cache: Map<string, Manifest> | undefined } = { cache: undefined };

// The pin fields a manifest may leave out, copied when declared.
const OPTIONAL_TOOL_KEYS = [
    'version',
    'floor',
    'provider',
    'version_command',
    'version_exit_code',
    'version_regex',
    'crash_pattern',
    'rule_page',
    'suppression',
    'env',
    'takeover',
    'query_packs',
    'prettier',
] as const;

function issueLines(issue: z.core.$ZodIssue): string[] {
    const line = `${issue.path.map(String).join('.')}: ${issue.message}`;
    return issue.code === 'invalid_union'
        ? [line, ...issue.errors.flatMap((branch) => branch.flatMap((nested) => issueLines(nested)))]
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
    const declared = OPTIONAL_TOOL_KEYS.filter((key) => raw[key] !== undefined).map((key) => [key, raw[key]] as const);
    return {
        name: raw.name,
        kind: raw.kind,
        windows: raw.windows,
        installers: installerPins(raw),
        ...(Object.fromEntries(declared) as Partial<ToolPin>),
    };
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

// Appends each referenced check, declared by another configuration, to the manifest that references it.
function appendReferences(manifests: Map<string, Manifest>): void {
    const declared = new Map(
        [...manifests.values()].flatMap((manifest) => manifest.checks.map((check) => [check.name, check] as const)),
    );
    for (const manifest of manifests.values())
        for (const reference of new Set(manifest.configuration.check_references)) {
            const check = declared.get(reference);
            if (check !== undefined) manifest.checks.push(check);
        }
}

// Parses one embedded manifest and registers it under its folder name, which its declared name must match.
function registerManifest(manifests: Map<string, Manifest>, path: string): void {
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

/** A manifest that the schema or the design refuses. */
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
        throw new ManifestError(configurationName, [
            ...new Set(result.error.issues.flatMap((issue) => issueLines(issue))),
        ]);
    const raw = result.data;
    const problems = [
        ...raw.checks.flatMap((check) => checkProblems(check)),
        ...configurationProblems(raw),
        ...raw.configs
            .filter((config) => config.imports !== undefined && !config.fragment)
            .map((config) => `config ${config.target} declares imports, which only a fragment renders.`),
        ...raw.configs
            .filter((config) => !config.fragment && (config.code_files.length > 0 || config.selectors.length > 0))
            .map((config) => `config ${config.target} declares code files or selectors, which only a fragment adds.`),
    ];
    if (raw.checks.some((check) => raw.configuration.check_references.includes(check.name)))
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
        entry_files: raw.entry_files,
        naming: raw.naming,
        coverage: raw.coverage,
        rule_files: raw.rule_files,
        required_rules: raw.required_rules,
        dir,
    };
}

/**
 * Every embedded manifest by configuration name. Read once per process.
 * @returns the manifests
 */
export function configurationManifests(): Map<string, Manifest> {
    if (state.cache) return state.cache;
    const manifests = new Map<string, Manifest>();
    for (const path of listAssets('packages/cli/configurations/'))
        if (path.endsWith('/manifest.toml')) registerManifest(manifests, path);
    validateManifests(manifests);
    appendReferences(manifests);
    state.cache = new Map([...manifests].toSorted(([first], [second]) => first.localeCompare(second)));
    return state.cache;
}

/**
 * The .gitignore block: the paths gspot writes that git never tracks.
 * @param manifests the manifests whose untracked paths count, every one by default
 * @returns the block body
 */
export function gitignoreBlock(
    manifests: Iterable<Pick<Manifest, 'untracked'>> = configurationManifests().values(),
): string {
    return [...new Set([...PRIVATE_PATHS, ...[...manifests].flatMap((manifest) => manifest.untracked)])].join('\n');
}
