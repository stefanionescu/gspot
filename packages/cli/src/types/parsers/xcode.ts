type ProjectRoot = ProjectEntry & { mainGroup: string };

export type ProjectEntry = {
    isa: string;
    buildSettings?: { SDKROOT?: string | undefined; SWIFT_VERSION?: string | undefined } | undefined;
    name?: string | undefined;
    path?: string | undefined;
    sourceTree?: string | undefined;
    children?: string[] | undefined;
    fileRef?: string | undefined;
    files?: string[] | undefined;
    buildPhases?: string[] | undefined;
    fileSystemSynchronizedGroups?: string[] | undefined;
    exceptions?: string[] | undefined;
    membershipExceptions?: string[] | undefined;
    target?: string | undefined;
    productType?: string | undefined;
    mainGroup?: string | undefined;
    targets?: string[] | undefined;
    projectDirPath?: string | undefined;
};

export type ProjectMetadata = { objects: Record<string, ProjectEntry>; root: ProjectEntry };

export type XcodeProject = {
    objects: Record<string, ProjectEntry>;
    root: ProjectRoot;
    folder: string;
    parents: Map<string, string>;
    visiting: Set<string>;
};

export type Folder = { path: string; excluded: Set<string> };

/** Source membership and synchronized folder exclusions read from project targets. */
export type ProjectSources = { sources: Set<string>; folders: Folder[] };

/** Native compiler and SDK choices authored in Xcode build configurations. */
export type ProjectBuildSettings = { sdkRoot: string | undefined; swiftVersion: string | undefined };

/** Token stream for the UTF-8 project property-list reader. */
export type ProjectTokens = { tokens: string[]; index: number };
