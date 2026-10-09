import type { Tooling } from '#cli/types/repository/inventory.ts';

/** An empty inventory leaves each scenario to supply only the evidence its question reads. */
export const EMPTY_TOOLING: Tooling = {
    toolFiles: [],
    hooks: [],
    ci: [],
    agentFiles: [],
    rulesDirectories: [],
    lintFolders: [],
    lintOnlyManifests: [],
    runner: 'npm',
};
