// The types of output in this package.

export type ReporterOptions = { quiet: boolean; verbose: boolean };
export type OutputOptions = { verbosity: 'quiet' | 'normal' | 'verbose'; json: boolean; color: boolean };
export type Columns = { scope: number; check: number };
