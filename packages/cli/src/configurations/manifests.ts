// Load the built-in configuration registry and resolve its references once per process.
import type { z } from 'zod';
import { posix } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { compact, isRecord } from '#cli/platform/objects.ts';
import { allChecks } from '#cli/configurations/declarations.ts';
import { readAsset, listAssets } from '#cli/platform/assets.ts';
import { manifestSchema } from '#cli/parsers/schema/configurations/manifest.ts';
import { manifestError, manifestProblems } from '#cli/configurations/problems.ts';
import type { Manifest, CheckSpec, ManifestRegistryState } from '#cli/types/configurations.ts';

function issueLines(issue: z.core.$ZodIssue): string[] {
    const line = `${issue.path.map(String).join('.')}: ${issue.message}`;
    return issue.code === 'invalid_union'
        ? [line, ...issue.errors.flatMap((branch) => branch.flatMap((nested) => issueLines(nested)))]
        : [line];
}

// The [configuration] table with the name and the kind its folder gives, as configurations/general/docs gives docs and general.
function locatedConfiguration(configuration: unknown, dir: string): Record<string, unknown> {
    const declared = isRecord(configuration) ? configuration : {};
    if ('name' in declared || 'kind' in declared)
        throw manifestError(posix.basename(dir), [
            '[configuration] declares a name or a kind, which its folder already gives.',
        ]);
    return { ...declared, name: posix.basename(dir), kind: posix.basename(posix.dirname(dir)) };
}

const state: ManifestRegistryState = { cache: undefined };

// Appends each referenced check, declared by another configuration, to the manifest that references it.
function appendReferences(manifests: Map<string, Manifest>): void {
    const declared = new Map(
        [...manifests.values()].flatMap((manifest) => manifest.checks.map((check) => [check.name, check] as const)),
    );
    for (const manifest of manifests.values())
        for (const reference of new Set(manifest.configuration.borrowed_checks)) {
            const check = declared.get(reference);
            if (check !== undefined) manifest.checks.push(check);
        }
}

// Parses one embedded manifest and registers it under its folder name.
function registerManifest(manifests: Map<string, Manifest>, path: string): void {
    const dir = path.slice(0, -'/manifest.toml'.length);
    const manifest = parseManifest(readAsset(path), dir);
    if (manifests.has(manifest.configuration.name))
        throw manifestError(manifest.configuration.name, ['The configuration name is already registered.']);
    manifests.set(manifest.configuration.name, manifest);
}

/**
 * Parse one manifest text into resolved declarations; invalid input throws GspotError with code manifest.
 * @param text the manifest.toml text
 * @param dir the configuration folder inside the assets, such as configurations/general/docs, which gives the configuration its name and kind
 * @returns the manifest
 */
export function parseManifest(text: string, dir: string): Manifest {
    const parsed = parseToml(text);
    const result = manifestSchema.safeParse({
        ...parsed,
        configuration: locatedConfiguration(parsed['configuration'], dir),
    });
    if (!result.success)
        throw manifestError(posix.basename(dir), [
            ...new Set(result.error.issues.flatMap((issue) => issueLines(issue))),
        ]);
    const declared = result.data;
    // A check's ID is the configuration's name, a slash, and the check's own name.
    const raw = {
        ...declared,
        checks: declared.checks.map((check) => ({ ...check, name: `${declared.configuration.name}/${check.name}` })),
    };
    const problems = manifestProblems(raw);
    if (problems.length > 0) throw manifestError(raw.configuration.name, problems);
    return {
        ...raw,
        checks: raw.checks.map((check) => compact(check)),
        settings: raw.settings.map((setting) => compact(setting)),
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
    // The checks across manifests run at build time and in the tests, not on every start.
    for (const path of listAssets('configurations/'))
        if (path.endsWith('/manifest.toml')) registerManifest(manifests, path);
    appendReferences(manifests);
    state.cache = new Map([...manifests].toSorted(([first], [second]) => first.localeCompare(second)));
    return state.cache;
}

/**
 * Lists bundled check IDs alongside the repository's custom executable check IDs.
 * @param checks the custom checks declared by this repository
 * @returns the available check names
 */
export function knownChecks(checks: readonly Pick<CheckSpec, 'name'>[]): string[] {
    const bundled = [...allChecks(configurationManifests().values()).keys()];
    const authored = checks.map((check) => check.name);
    return [...new Set([...bundled, ...authored])];
}
