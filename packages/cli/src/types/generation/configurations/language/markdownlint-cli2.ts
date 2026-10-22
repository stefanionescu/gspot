/** What markdownlint-cli2 passes to an output formatter. */
export type MarkdownlintFormatterInput = { results: unknown; logMessage: (message: string) => void };
