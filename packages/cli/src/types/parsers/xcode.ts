import type { z } from 'zod';
import type { pbxprojSchema } from '#cli/parsers/schema/xcode.ts';

export type ProjectRoot = ProjectEntry & { mainGroup: string };

export type Plist = string | Plist[] | { [key: string]: Plist };

export type ProjectEntry = z.infer<typeof pbxprojSchema>['objects'][string];

export type XcodeProject = {
    objects: Record<string, ProjectEntry>;
    root: ProjectRoot;
    directory: string;
    parents: Map<string, string>;
    visiting: Set<string>;
};

export type Folder = { path: string; excluded: Set<string> };

export type PlistToken = { text: string; quoted: boolean; at: number };

/** One token and the cursor immediately after it in the project source. */
export type ProjectToken = { token: PlistToken; end: number };
/** Source membership and synchronized folder exclusions read from project targets. */
export type ProjectSources = { sources: Set<string>; folders: Folder[] };
