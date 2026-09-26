// The literal values integration/cli/policy/adoption reads: names, patterns, limits, and tables.
import type { ExistingTooling } from '#cli/types/repository/repository.ts';

export const TOOLING: Omit<ExistingTooling, 'configs'> = {
    hooks: [],
    ci: [],
    agentFiles: [],
    rulesDirectories: [],
    lintFolders: [],
    lintOnlyManifests: [],
    runner: 'none',
};
export const TEXT = 'function example() { return { first: "one", second: "two", third: "three" }; }';
