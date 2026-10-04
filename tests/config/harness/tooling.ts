/** Required public documentation for an otherwise isolated check declaration. */
import type { Tooling } from '#cli/types/repository/inventory.ts';

export const CHECK_FIELDS = `level = "recommended"
stage = "commit"
example = "A rejected input is corrected before rerunning the parser."
summary = "Parses the project input."
why = "Invalid input cannot run."
help = "Correct the reported input."
`;

/** An empty inventory leaves each scenario to supply only the evidence its question reads. */
export const EMPTY_TOOLING: Tooling = {
    configs: [],
    hooks: [],
    ci: [],
    agentFiles: [],
    rulesDirectories: [],
    lintFolders: [],
    lintOnlyManifests: [],
    runner: 'npm',
};
