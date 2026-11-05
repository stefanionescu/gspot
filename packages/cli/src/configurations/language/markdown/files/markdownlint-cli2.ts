import { fileURLToPath } from 'node:url';

import type { MarkdownlintFormatterInput } from '#cli/types/configurations/language.ts';

const rulesFile = fileURLToPath(new URL('markdownlint.jsonc', import.meta.url));

export default {
    config: { extends: rulesFile },
    frontMatter: String.raw`^(?:(?:---[^\S\r\n]*\r?\n[\s\S]*?\r?\n---|\+\+\+[^\S\r\n]*\r?\n[\s\S]*?\r?\n(?:\+\+\+|\.\.\.)|\{[^\S\r\n]*\r?\n[\s\S]*?\r?\n\})[^\S\r\n]*(?:\r?\n|$))?(?:(?:[^\S\r\n]*\r?\n)*(?:import|export) [^\r\n]*(?:\r?\n[^\S\r\n]*\S[^\r\n]*)*(?:\r?\n|$))*`,
    noBanner: true,
    noProgress: true,
    outputFormatters: [
        [
            ({ results, logMessage }: MarkdownlintFormatterInput): void => {
                logMessage(JSON.stringify(results));
            },
        ],
    ],
};
