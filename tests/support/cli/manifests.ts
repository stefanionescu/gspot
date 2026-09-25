// A minimal configuration manifest for tests of selection and manifest validation.
import type { Manifest } from '#cli/configurations/manifests.ts';
import { parseManifest } from '#cli/configurations/manifests.ts';

/**
 * A language manifest with a name and the configurations it requires, and nothing else.
 * @param name the configuration name
 * @param requires the configurations it requires
 * @returns the parsed manifest
 */
export function testManifest(name: string, requires: string[] = []): Manifest {
    return parseManifest(
        `[configuration]\nname = "${name}"\nkind = "language"\ntitle = "${name}"\nrequires = ${JSON.stringify(requires)}\ndescription = "A configuration for the tests, long enough."\n`,
        `configurations/${name}`,
    );
}
