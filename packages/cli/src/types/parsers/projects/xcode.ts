import type { z } from 'zod';
import type { pbxprojSchema } from '#cli/schemas/parsers/projects/xcode.ts';

export type PbxElement = z.infer<typeof pbxprojSchema>['objects'][string];

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
