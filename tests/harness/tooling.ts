// Builds minimal manifests for the init and selection tests.
import type { Manifest } from '#cli/types/configurations.ts';
import type { TestManifest } from '#tests/types/harness/tooling.ts';
import { parseManifest, linkManifestTools } from '#cli/configurations/public.ts';

/**
 * Parse an isolated configuration with the declarations its scenario needs.
 * @param name the configuration name
 * @param project the extra declarations, required configurations and asset kind
 * @returns the parsed manifest
 */

export function parseConfigurationManifest(name: string, project: TestManifest = {}): Manifest {
    const manifest = parseManifest(
        `[configuration]\ntitle = "${name}"\nrequires = ${JSON.stringify(project.requires ?? [])}\ndescription = "A configuration for the tests, long enough."\n${project.tables ?? ''}`,
        `configurations/${project.kind ?? 'language'}/${name}`,
    );
    return linkManifestTools([manifest]).get(name)!;
}
