// Parse shipped configuration manifests into validated declarations and resolved tool pins.
import type { z } from 'zod';
import { posix } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import type { Manifest } from '#cli/types/configurations.ts';
import { compact, isRecord } from '#cli/platform/objects.ts';
import { manifestSchema } from '#cli/parsers/schema/configurations/manifest.ts';
import { manifestError, manifestProblems } from '#cli/configurations/problems.ts';

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
