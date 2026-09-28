// What the adoption and selection tests start from: a discovery result naming configurations, and a minimal manifest.
import type { Manifest } from '#cli/types/configurations.ts';
import { parseManifest } from '#cli/configurations/manifests.ts';
import type { ExistingTooling } from '#cli/types/repository/repository.ts';

/** One discovered root Prettier configuration. */
export const PRETTIER_TOOLING: ExistingTooling = {
    configs: [{ tool: 'prettier', path: '.prettierrc.json', carries: 'rules-table' }],
    hooks: [],
    ci: [],
    agentFiles: [],
    rulesDirectories: [],
    lintFolders: [],
    lintOnlyManifests: [],
    runner: 'none',
};

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
