// The types of acceptance/source/configurations/configurations in this package.

/** One framework of component files in the planted components test: its check, its configurations, its files and its planted cases. */
export type ComponentShape = {
    check: string;
    configurations: string[];
    dependencies: Record<string, string>;
    files: Record<string, string>;
    planted: string;
    cases: [string, string][];
};
