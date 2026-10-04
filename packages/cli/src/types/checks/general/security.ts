export type AcceptedResult = { rule: string; paths: string[]; reason: string };

/** Selected source copy and repository-relative file for a SARIF character offset. */
export type SourceLocationFile = { root: string; file: string };

/** The resolved CodeQL language and its pinned query-pack version. */
export type CodeqlLanguage = { language: string; version: string };

/** One shared source copy and the query settings for a CodeQL run. */
export type CodeqlAnalysis = { source: string; work: string; suite: string; accepted: AcceptedResult[] };
