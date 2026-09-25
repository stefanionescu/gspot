// The tooling discovery result the adoption tests start from: the named configurations and nothing else.
import type { ExistingTooling } from '#cli/repository/existing-tooling.ts';

/**
 * A discovery result holding only the given configuration files.
 * @param configs the discovered configuration files
 * @returns the tooling
 */
export function discoveredTooling(configs: ExistingTooling['configs']): ExistingTooling {
    return {
        configs,
        hooks: [],
        ci: [],
        agentFiles: [],
        rulesDirectories: [],
        lintFolders: [],
        lintOnlyManifests: [],
        runner: 'none',
    };
}

/** One discovered root Prettier configuration. */
export const PRETTIER_TOOLING = discoveredTooling([
    { tool: 'prettier', path: '.prettierrc.json', carries: 'rules-table' },
]);
