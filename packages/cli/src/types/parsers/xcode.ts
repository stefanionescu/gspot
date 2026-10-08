import type { z } from 'zod';
import type { pbxprojSchema } from '#cli/parsers/schema/xcode.ts';

export type ProjectRoot = ProjectEntry & { mainGroup: string };

export type ProjectEntry = z.infer<typeof pbxprojSchema>['objects'][string];

export type ProjectMetadata = { objects: Record<string, ProjectEntry>; root: ProjectEntry };

export type XcodeProject = {
    objects: Record<string, ProjectEntry>;
    root: ProjectRoot;
    directory: string;
    parents: Map<string, string>;
    visiting: Set<string>;
};

export type Folder = { path: string; excluded: Set<string> };

/** Source membership and synchronized folder exclusions read from project targets. */
export type ProjectSources = { sources: Set<string>; folders: Folder[] };

/** Native compiler and SDK choices authored in Xcode build configurations. */
export type ProjectBuildSettings = { sdkRoot: string | undefined; swiftVersion: string | undefined };
