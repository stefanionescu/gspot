/** The resolved CodeQL language and its pinned query-pack version. */
export type CodeqlLanguage = { language: string; version: string };

/** One shared source copy and the query settings for a CodeQL run. */
export type CodeqlAnalysis = { source: string; work: string; suite: string };
