// The path tokens of Markdown prose outside free-text fences, which the docs and structure checks both read.
import { visit } from 'unist-util-visit';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { readSource } from '#cli/repository/sources.ts';
import type { ProseLine, EngineInput } from '#cli/types/checks.ts';

import {
    PATH_CHARS,
    FREE_TEXT_FENCES,
    PATH_TOKEN_SKIPS,
    TOKEN_SEPARATORS,
    TRAILING_PUNCTUATION,
} from '#cli/config/checks/docs.ts';

function withoutTrailingPunctuation(token: string): string {
    let end = token.length;
    while (end > 0 && TRAILING_PUNCTUATION.includes(token.charAt(end - 1))) end -= 1;
    return token.slice(0, end);
}

/**
 * The lines of a Markdown text outside free-text fences, with their numbers.
 * @param text the Markdown text
 * @returns the lines a path check reads
 */
export function proseLines(text: string): ProseLine[] {
    const ignored = new Set<number>();
    visit(fromMarkdown(text), 'code', (node) => {
        if (!FREE_TEXT_FENCES.has(node.lang ?? '') || node.position === undefined) return;
        for (let line = node.position.start.line; line <= node.position.end.line; line += 1) ignored.add(line);
    });
    return text.split('\n').flatMap((line, index) => (ignored.has(index + 1) ? [] : [{ number: index + 1, line }]));
}

/**
 * The tokens of one line that look like paths.
 * @param line the line
 * @returns the path tokens
 */
export function pathTokens(line: string): string[] {
    return line
        .split(TOKEN_SEPARATORS)
        .map((token) => withoutTrailingPunctuation(token))
        .map((token) => {
            const marker = token.startsWith('**') ? '**' : '*';
            if (token.startsWith(marker) && token.endsWith(marker)) return token.slice(marker.length, -marker.length);
            return token;
        })
        .filter(
            (token) =>
                token.includes('/') && PATH_CHARS.test(token) && PATH_TOKEN_SKIPS.every((skip) => !skip.test(token)),
        );
}

/**
 * Documentation references that can justify an exception for an untracked output or external path.
 * @param input the repository inventory and source reader.
 * @returns the distinct path tokens in tracked Markdown prose.
 */
export function referencedPaths(input: EngineInput): Set<string> {
    const referenced = new Set<string>();
    const files = input.files.filter((file) => file.kind === 'source' && file.path.endsWith('.md'));
    for (const file of files) {
        const prose = proseLines(readSource(input.root, file.path, input.reads).toString('utf8'));
        for (const { line } of prose)
            for (const token of pathTokens(line)) referenced.add(token.replace(/^\.\//u, '').replace(/\/$/u, ''));
    }
    return referenced;
}
