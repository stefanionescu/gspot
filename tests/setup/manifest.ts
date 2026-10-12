// Parses the configuration declarations needed by a test.
import { parseManifest } from '#cli/configurations/manifests.ts';
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
    return parseManifest(
        `[configuration]\ntitle = "${name}"\nrequires = ${JSON.stringify(project.requires ?? [])}\ndescription = "A configuration for the tests, long enough."\n${project.tables ?? ''}`,
        `configurations/${project.group ?? 'language'}/${name}`,
    );
}
