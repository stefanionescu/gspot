import type { Files } from '#cli/types/system/files.ts';

/**
 * How to build one Swift scope: the build folder, the compiler log file, the command, and the folder that the analyzer
 * clears.
 */
export type SwiftBuildPlan =
    | { kind: 'package'; folder: string; log: string; scratch: string; commandArguments: string[] }
    | { kind: 'xcode'; folder: string; log: string; commandArguments: string[] };

/** The build exit code, its output, and the source copy it ran in. */
export type SwiftBuildOutput = { code: number; output: string; source: string };

/** The Swift task that a build folder serves; each task keeps its own folder. */
export type SwiftBuildPurpose = 'compile' | 'analyze' | 'coverage' | 'periphery';

/** The prepared source copy and its locked root, which the caller disposes. */
export type PreparedSwiftBuild = { files: Files; source: string };

/** The line coverage of each target. */
export type CoverageReport = { targets: { name: string; lineCoverage: number }[] };

export type SwiftPackageCoverage = {
    targets: { name: string; path: string; type: string; module_type: string; sources: string[] }[];
};

export type SwiftCoverage = {
    data: { files: { filename: string; summary: { lines: { count: number; covered: number } } }[] }[];
};
