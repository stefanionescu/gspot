import { fileURLToPath } from 'node:url';
import type { MarkdownlintFormatterInput } from '#cli/types/generation/markdownlint-cli2.ts';

export default {
    config: { extends: fileURLToPath(new URL('markdownlint.jsonc', import.meta.url)) },
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
