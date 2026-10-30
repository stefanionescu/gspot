import type { z } from 'zod';
import type { ciJobSchema } from '#cli/schemas/repository/setup.ts';

export type RepositorySetup = {
    conflictingConfigFiles: ConflictingConfigFile[];
    hooks: {
        kind: 'githooks' | 'husky' | 'lefthook' | 'simple-git-hooks' | 'pre-commit' | 'hooksPath';
        path: string;
        files: string[];
    }[];
    ci: string[];
    agentFiles: string[];
    ruleFolders: string[];
    lintFolders: string[];
    toolOnlyPackages: string[];
};

export type ConflictingConfigFile = {
    tool: string;
    path: string;
    shared: boolean;
    table?: string;
    key?: string;
};

export type CiJob = z.infer<typeof ciJobSchema>;

export type RepositoryHooks = { hooksPath: string; hooks: RepositorySetup['hooks'] };
