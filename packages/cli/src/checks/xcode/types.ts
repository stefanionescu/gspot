// Types of the xcode and xctest checks.

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

/** The part of an xccov report the coverage check reads. */
export type CoverageReport = { targets?: { name: string; lineCoverage: number }[] };
