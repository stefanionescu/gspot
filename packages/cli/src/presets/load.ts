// Read every embedded manifest, validate it, and refuse the shapes the design forbids.
import { parse as parseToml } from 'smol-toml';

import { listAssets, readAsset } from '#cli/platform/assets.ts';
import { manifestSchema } from '#cli/presets/manifest-schema.ts';
import type { RawManifest } from '#cli/presets/manifest-schema.ts';
import type { CheckSpec, ConfigTarget, Manifest, ToolPin } from '#types/manifest.ts';

const INSTALLER_KEYS = ['npm', 'pypi', 'mise', 'brew', 'apt', 'cargo', 'github', 'winget', 'scoop', 'ubi'] as const;

export class ManifestError extends Error {
    constructor(preset: string, problems: string[]) {
        super(`The preset manifest for \`${preset}\` is not valid:\n${problems.join('\n')}`);
        this.name = 'ManifestError';
    }
}

type Compact<T> = { [K in keyof T]: Exclude<T[K], undefined> };

function compact<T extends object>(value: T): Compact<T> {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Compact<T>;
}

function toTool(raw: RawManifest['tools'][number]): ToolPin {
    const installers: Record<string, string> = {};
    for (const key of INSTALLER_KEYS) {
        const value = raw[key];
        if (value !== undefined) installers[key] = value;
    }
    const tool: ToolPin = { name: raw.name, windows: raw.windows, installers };
    if (raw.version !== undefined) tool.version = raw.version;
    if (raw.floor !== undefined) tool.floor = raw.floor;
    if (raw.provider !== undefined) tool.provider = raw.provider;
    if (raw.version_command !== undefined) tool.version_command = raw.version_command;
    if (raw.version_regex !== undefined) tool.version_regex = raw.version_regex;
    return tool;
}

function toCheck(raw: RawManifest['checks'][number]): CheckSpec {
    const { claims, ...rest } = raw;
    const check = compact(rest) as unknown as CheckSpec;
    if (claims)
        check.claims = {
            extensions: claims.extensions,
            filenames: claims.filenames,
            tags: claims.tags,
            paths: claims.paths,
            from_languages: claims.from_languages,
            natures: claims.natures,
        };
    return check;
}

function refusals(raw: RawManifest): string[] {
    const problems: string[] = [];
    const readers = new Set<string>();
    for (const check of raw.checks) {
        for (const argument of [...(check.command ?? []), ...(check.fix_command ?? [])]) {
            for (const match of argument.matchAll(/\{config:([a-z0-9-]+)\}/g)) readers.add(match[1]!);
        }
        if (check.command === undefined && check.engine === undefined)
            problems.push(`check ${check.id} has neither a command nor an engine.`);
        if (check.fix_command !== undefined && check.fix_order === undefined)
            problems.push(`check ${check.id} has a fix_command and no fix_order.`);
        if (check.requires !== undefined && check.stage === 'commit')
            problems.push(`check ${check.id} requires ${check.requires} and cannot run at the commit stage.`);
    }
    for (const config of raw.configs) {
        if (config.fragment) continue;
        const name = config.target.replace(/^\.gspot\//, '').replace(/\..*$/, '');
        const readByTemplate = raw.configs.some((other) => other !== config && other.template.includes(name));
        if (!readers.has(name) && !readByTemplate && !config.stub)
            problems.push(`config ${config.target} has no check that reads it ({config:${name}}) and no stub.`);
    }
    for (const check of raw.checks)
        if (
            check.stage === 'manual' &&
            check.requires === undefined &&
            check.takes === 'files' &&
            check.command === undefined
        )
            problems.push(`check ${check.id} is manual with nothing that makes it slow.`);
    return problems;
}

/** Parses one manifest text into a Manifest. Throws ManifestError. */
export function parseManifest(text: string, dir: string): Manifest {
    const data = parseToml(text);
    const result = manifestSchema.safeParse(data);
    const id = (data as { preset?: { id?: string } }).preset?.id ?? dir;
    if (!result.success)
        throw new ManifestError(
            id,
            result.error.issues.map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`),
        );
    const raw = result.data;
    const problems = refusals(raw);
    if (problems.length > 0) throw new ManifestError(raw.preset.id, problems);
    return {
        preset: raw.preset,
        detect: raw.detect,
        claims: raw.claims,
        tools: raw.tools.map(toTool),
        configs: raw.configs.map(
            (config) =>
                compact({
                    template: config.template,
                    target: config.target,
                    stub: config.stub === undefined ? undefined : compact(config.stub),
                    fragment: config.fragment,
                    per_scope: config.per_scope,
                    executable: config.executable,
                    header: config.header,
                }) as ConfigTarget,
        ),
        checks: raw.checks.map(toCheck),
        settings: raw.settings.map((setting) => compact(setting)),
        required: raw.required,
        rules: raw.rules,
        dir,
    };
}

let cache: Map<string, Manifest> | undefined;

/** Every embedded manifest by preset id. Loaded once per process. */
export function loadManifests(): Map<string, Manifest> {
    if (cache) return cache;
    const manifests = new Map<string, Manifest>();
    for (const path of listAssets('presets/')) {
        if (!path.endsWith('/manifest.toml')) continue;
        const dir = path.slice(0, -'/manifest.toml'.length);
        const manifest = parseManifest(readAsset(path), dir);
        const folder = dir.split('/').pop();
        if (folder !== manifest.preset.id)
            throw new ManifestError(manifest.preset.id, [
                `the folder is \`${folder}\` and the id is \`${manifest.preset.id}\`; they must match.`,
            ]);
        manifests.set(manifest.preset.id, manifest);
    }
    for (const manifest of manifests.values()) {
        for (const required of manifest.preset.requires)
            if (!manifests.has(required))
                throw new ManifestError(manifest.preset.id, [`it requires \`${required}\`, which does not exist.`]);
    }
    cache = manifests;
    return manifests;
}

/** Drops the cache; tests use it after planting a manifest. */
export function resetManifests(): void {
    cache = undefined;
}
