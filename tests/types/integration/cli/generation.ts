// The types of integration/cli/generation in this package.

export type LicensesConfiguration = { licenses_allowed: string[]; packages_allowed: unknown[] };
export type Parser = (text: string, path: string) => void;
