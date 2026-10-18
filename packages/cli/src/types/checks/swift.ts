import type { Files } from '#cli/types/system/files.ts';

/** The build of one Swift scope. */
export type SwiftBuildPlan = {
    /** The build folder of this scope. */
    folder: string;
    /** The compiler log destination. */
    log: string;
    commandArguments: string[];
    /** The analyzer clears this folder so its log includes every compiler call. */
    scratch?: string;
};

/** The read build status and its compiler output. */
export type SwiftBuildOutput = { code: number; output: string; source: string };

/** The separate build state for each Swift task. */
export type SwiftBuildPurpose = 'compile' | 'analyze' | 'coverage' | 'periphery';

/** The prepared source copy and its locked root, which the caller disposes. */
export type PreparedSwiftBuild = { files: Files; source: string };

/** Target coverage accepted by the xccov report schema. */
export type CoverageReport = { targets: { name: string; lineCoverage: number }[] };
