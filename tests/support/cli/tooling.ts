// What the adoption and selection tests start from: a discovery result naming configurations, and a minimal manifest.
import type { Manifest } from '#cli/types/kits.ts';
import { parseManifest } from '#cli/kits/manifests.ts';
import type { ExistingTooling } from '#cli/types/repository/repository.ts';

/** One discovered root Prettier configuration. */
export const PRETTIER_TOOLING: ExistingTooling = {
    configs: [{ tool: 'prettier', path: '.prettierrc.json', keeps: 'rules-table' }],
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
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Two test files build manifests through it ten times; one owner keeps the fixture shape.
export function testManifest(name: string, requires: string[] = []): Manifest {
    return parseManifest(
        `[kit]\nname = "${name}"\nkind = "language"\ntitle = "${name}"\nrequires = ${JSON.stringify(requires)}\ndescription = "A configuration for the tests, long enough."\n`,
        `kits/${name}`,
    );
}
