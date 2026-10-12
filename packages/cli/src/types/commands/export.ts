/** The destination of a template export. */
export type ExportOptions = { cwd: string; file: string };

/** The written template destination and repository-local command warnings. */
export type ExportJson = { file: string; leftOut: string[]; warnings: string[] };
