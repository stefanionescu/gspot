import type { Files } from '#cli/types/system/files.ts';

/** The build of one Swift scope. */
export type SwiftBuildPlan =
    | { kind: 'package'; folder: string; log: string; scratch: string; commandArguments: string[] }
    | { kind: 'xcode'; folder: string; log: string; commandArguments: string[] };

/** The read build status and its compiler output. */
export type SwiftBuildOutput = { code: number; output: string; source: string };

/** The separate build state for each Swift task. */
export type SwiftBuildPurpose = 'compile' | 'analyze' | 'coverage' | 'periphery';

/** The prepared source copy and its locked root, which the caller disposes. */
export type PreparedSwiftBuild = { files: Files; source: string };

/** Target coverage accepted by the xccov report schema. */
export type CoverageReport = { targets: { name: string; lineCoverage: number }[] };

export type SwiftPackageCoverage = {
    targets: { name: string; path: string; type: string; module_type: string; sources: string[] }[];
};

export type SwiftCoverage = {
    data: { files: { filename: string; summary: { lines: { count: number; covered: number } } }[] }[];
};
