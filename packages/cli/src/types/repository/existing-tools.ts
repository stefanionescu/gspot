export type ExistingTools = {
    replacedFiles: ReplacedFile[];
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

export type ReplacedFile = {
    tool: string;
    path: string;
    shared: boolean;
    table?: string;
    key?: string;
};

/** The continuous integration fields for lint job discovery. */
export type CiJob = {
    script?: string | string[] | undefined;
    steps?: { run?: string | undefined }[] | undefined;
    extends?: unknown;
};
