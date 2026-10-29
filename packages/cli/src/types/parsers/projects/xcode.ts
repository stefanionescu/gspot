export type PbxElement = {
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
    mainGroup?: string | undefined;
    targets?: string[] | undefined;
    projectDirPath?: string | undefined;
};

export type ParsedPbxproj = { objects: Record<string, PbxElement>; root: PbxElement };

export type XcodeProject = {
    objects: Record<string, PbxElement>;
    root: PbxElement & { mainGroup: string };
    folder: string;
    parents: Map<string, string>;
    visiting: Set<string>;
};

export type TargetFolder = { path: string; excluded: Set<string> };

export type ProjectSources = {
    sources: Set<string>;
    folders: TargetFolder[];
    targets: { name: string; sources: string[]; folders: TargetFolder[] }[];
};

export type ProjectBuildSettings = { sdkRoot: string | undefined; swiftVersion: string | undefined };

export type ProjectTokens = { tokens: string[]; index: number };
