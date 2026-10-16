// Parses the configuration declarations needed by a test.
import { parse } from 'smol-toml';
import { compact } from '#cli/objects.ts';
import { manifestSchema } from '#cli/configurations/schema/manifest.ts';
import type { ManifestDeclaration } from '#cli/types/configurations.ts';

/**
 * Parse an isolated configuration with the declarations its test needs.
 * @param name the configuration name.
 * @param project the extra declarations, required configurations, and configuration group.
 * @returns the parsed manifest.
 */

export function buildManifest(
    name: string,
    project: { requires?: string[]; tables?: string; group?: ManifestDeclaration['configuration']['group'] } = {},
): ManifestDeclaration {
    const declared = manifestSchema.parse({
        ...parse(project.tables ?? ''),
        configuration: {
            name,
            title: name,
            group: project.group ?? 'language',
            requires: project.requires ?? [],
            description: 'A configuration for the tests, long enough.',
        },
    });
    return {
        ...declared,
        checks: declared.checks.map((check) => compact({ ...check, name: `${name}/${check.name}` })),
        dir: `configurations/${project.group ?? 'language'}/${name}`,
    };
}
