import type { z } from 'zod';
import { parse as parseToml } from 'smol-toml';
import { compact } from '#cli/policy/normalize.ts';
import { INSTALLER_KEYS } from '#cli/kits/tools.ts';
import { manifestSchema } from '#cli/kits/schema.ts';
import { PRIVATE_PATHS } from '#cli/config/platform.ts';
import { OPTIONAL_TOOL_KEYS } from '#cli/config/kits.ts';
import { readAsset, listAssets } from '#cli/platform/assets.ts';
import type { RawTool, ToolPin, Manifest, RawCheck, CheckSpec } from '#cli/types/kits.ts';
import { manifestError, manifestProblems, validateManifests } from '#cli/kits/manifest-problems.ts';

const state: { cache: Map<string, Manifest> | undefined } = { cache: undefined };

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

function toCheck(raw: RawCheck): CheckSpec {
    const { owners, ...rest } = raw;
    const check = compact(rest) as CheckSpec;
    if (owners) {
        const { extensions, filenames, tags, paths, from_languages: isFromLanguages, kinds } = owners;
        check.owners = { extensions, filenames, tags, paths, from_languages: isFromLanguages, kinds };
    }
    return check;
}

// Appends each referenced check, declared by another configuration, to the manifest that references it.
function appendReferences(manifests: Map<string, Manifest>): void {
    const declared = new Map(
        [...manifests.values()].flatMap((manifest) => manifest.checks.map((check) => [check.name, check] as const)),
    );
    for (const manifest of manifests.values())
        for (const reference of new Set(manifest.kit.check_references)) {
            const check = declared.get(reference);
            if (check !== undefined) manifest.checks.push(check);
        }
}

// Parses one embedded manifest and registers it under its folder name, which its declared name must match.
function registerManifest(manifests: Map<string, Manifest>, path: string): void {
    const dir = path.slice(0, -'/manifest.toml'.length);
    const manifest = parseManifest(readAsset(path), dir);
    const folder = dir.slice(dir.lastIndexOf('/') + 1);
    if (folder !== manifest.kit.name)
        throw manifestError(manifest.kit.name, [
            `the folder is \`${folder}\` and the name is \`${manifest.kit.name}\`; they must match.`,
        ]);
    if (manifests.has(manifest.kit.name))
        throw manifestError(manifest.kit.name, ['The configuration name is already registered.']);
    manifests.set(manifest.kit.name, manifest);
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
    const kitName = result.success ? result.data.kit.name : dir;
    if (!result.success)
        throw manifestError(kitName, [...new Set(result.error.issues.flatMap((issue) => issueLines(issue)))]);
    const raw = result.data;
    const problems = [
        ...manifestProblems(raw),
        ...raw.configs
            .filter((config) => config.imports !== undefined && !config.fragment)
            .map((config) => `config ${config.target} declares imports, which only a fragment renders.`),
        ...raw.configs
            .filter((config) => !config.fragment && (config.code_files.length > 0 || config.selectors.length > 0))
            .map((config) => `config ${config.target} declares code files or selectors, which only a fragment adds.`),
    ];
    if (raw.checks.some((check) => raw.kit.check_references.includes(check.name)))
        problems.push('A configuration cannot both declare and reference the same check.');
    if (problems.length > 0) throw manifestError(raw.kit.name, problems);
    return {
        kit: raw.kit,
        untracked: raw.untracked,
        detect: raw.detect,
        owners: raw.owners,
        tools: raw.tools.map((tool) => {
            const declared = OPTIONAL_TOOL_KEYS.filter((key) => tool[key] !== undefined).map(
                (key) => [key, tool[key]] as const,
            );
            return {
                name: tool.name,
                kind: tool.kind,
                installers: installerPins(tool),
                ...(Object.fromEntries(declared) as Partial<ToolPin>),
            };
        }),
        configs: raw.configs,
        checks: raw.checks.map((check) => toCheck(check)),
        settings: raw.settings.map((setting) => compact(setting)),
        defaults: raw.defaults,
        defaults_all: raw.defaults_all,
        entry_files: raw.entry_files,
        naming: raw.naming,
        coverage: raw.coverage,
        guides: raw.guides,
        required_rules: raw.required_rules,
        rules_off: raw.rules_off,
        dir,
    };
}

/**
 * Every embedded manifest by configuration name. Read once per process.
 * @returns the manifests
 */
export function kitManifests(): Map<string, Manifest> {
    if (state.cache) return state.cache;
    const manifests = new Map<string, Manifest>();
    for (const path of listAssets('kits/')) if (path.endsWith('/manifest.toml')) registerManifest(manifests, path);
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
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Init and apply write the same .gitignore block of the untracked gspot paths.
export function gitignoreBlock(manifests: Iterable<Pick<Manifest, 'untracked'>> = kitManifests().values()): string {
    return [...new Set([...PRIVATE_PATHS, ...[...manifests].flatMap((manifest) => manifest.untracked)])].join('\n');
}
