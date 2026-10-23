import type { Files } from '#cli/types/system/files.ts';

export type SwiftBuildPlan =
    | { kind: 'package'; folder: string; log: string; scratch: string; commandArguments: string[] }
    | { kind: 'xcode'; folder: string; log: string; commandArguments: string[] };

export type SwiftBuildOutput = { code: number; output: string; source: string };

export type SwiftBuildPurpose = 'compile' | 'analyze' | 'coverage' | 'periphery';

export type SwiftBuildSetup = { files: Files; source: string };

export type CoverageReport = { targets: { name: string; lineCoverage: number }[] };

export type SwiftPackageCoverage = {
    targets: { name: string; path: string; type: string; module_type: string; sources: string[] }[];
};

export type SwiftCoverage = {
    data: { files: { filename: string; summary: { lines: { count: number; covered: number } } }[] }[];
};
