/** Target coverage accepted by the xccov report schema. */
export type CoverageReport = { targets: { name: string; lineCoverage: number }[] };
