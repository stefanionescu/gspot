// The types of acceptance/source/configurations/react in this package.

/** One planted defect: the check that reads it, where it is, and the file that corrects it. */
export type LintCase = { check: string; rule: string; path: string; text: string; line: number; corrected: string };
