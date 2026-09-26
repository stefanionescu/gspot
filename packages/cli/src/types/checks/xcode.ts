// The types of checks/xcode in this package.
import type { z } from 'zod';
import type { projectSchema } from '#cli/checks/xcode/project-reader.ts';

/** The part of an xccov report the coverage check reads. */
export type XcodeCoverageReport = { targets?: { name: string; lineCoverage: number }[] };
export type Plist = string | Plist[] | { [key: string]: Plist };
export type Token = { text: string; quoted: boolean; at: number };
export type ProjectObject = z.infer<typeof projectSchema>['objects'][string];
export type ProjectRoot = ProjectObject & { mainGroup: string };
export type XcodeProject = {
    objects: Record<string, ProjectObject>;
    root: ProjectRoot;
    directory: string;
    parents: Map<string, string>;
    visiting: Set<string>;
};
export type Folder = { path: string; excluded: Set<string> };
/** The part of a string catalog the checks read. */
export type StringsFile = {
    sourceLanguage?: string;
    strings?: Record<string, { shouldTranslate?: boolean; localizations?: Record<string, unknown> }>;
};
/** The part of an asset Contents.json the checks read. */
export type AssetContents = { images?: { filename?: string }[] };
/** The part of a test plan the checks read. */
export type TestPlan = {
    testTargets?: { target?: { name?: string }; skippedTests?: string[] }[];
};
/** One coverage floor of the policy. */
export type CoverageFloor = { target: string; percent: number };
