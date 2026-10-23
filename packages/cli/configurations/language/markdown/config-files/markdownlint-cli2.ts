// The markdownlint-cli2 options of the markdown/markdownlint-cli2 check. gspot transpiles this file to
// markdownlint-cli2.mjs.
import { fileURLToPath } from 'node:url';
import type { MarkdownlintFormatterInput } from '#cli/types/generation/markdownlint-cli2.ts';

export default {
    config: { extends: fileURLToPath(new URL('markdownlint.jsonc', import.meta.url)) },
    frontMatter: String.raw`^(?:(?:---[^\S\r\n]*\r?\n[\s\S]*?\r?\n---|\+\+\+[^\S\r\n]*\r?\n[\s\S]*?\r?\n(?:\+\+\+|\.\.\.)|\{[^\S\r\n]*\r?\n[\s\S]*?\r?\n\})[^\S\r\n]*(?:\r?\n|$))?(?:(?:[^\S\r\n]*\r?\n)*(?:import|export) [^\r\n]*(?:\r?\n[^\S\r\n]*\S[^\r\n]*)*(?:\r?\n|$))*`,
    noBanner: true,
    noProgress: true,
    // The check reads the findings as JSON.
    outputFormatters: [
        [
            ({ results, logMessage }: MarkdownlintFormatterInput): void => {
                logMessage(JSON.stringify(results));
            },
        ],
    ],
};
