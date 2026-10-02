// The types of checks/tool/xctest in this package.

/** The part of an xccov report the coverage check reads. */
export type XcodeCoverageReport = { targets?: { name: string; lineCoverage: number }[] };

/** One coverage floor of the policy. */
export type CoverageFloor = { target: string; percent: number };
