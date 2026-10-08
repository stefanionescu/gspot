/** The destination and preview choice of a template export. */
export type ExportOptions = { cwd: string; file: string; isDryRun: boolean };

/** The authored template preview and repository-local command warnings. */
export type ExportJson = { file: string; leftOut: string[]; warnings: string[]; text?: string };
