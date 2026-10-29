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

export type CiJob = {
    script?: string | string[] | undefined;
    steps?: CiStep[] | undefined;
    extends?: unknown;
};

export type RepositoryHooks = { hooksPath: string; hooks: RepositorySetup['hooks'] };

export type CiStep = { run?: string | undefined };
