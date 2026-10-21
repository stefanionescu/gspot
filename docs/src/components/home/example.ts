import assert from 'node:assert/strict';
import { CODE_TOKENS } from '../../config/home.ts';
import type { ExampleLine, ExampleToken } from '../../types/home.ts';

function tokenizeExampleLine(text: string): ExampleToken[] {
    if (text.trimStart().startsWith('//')) return [{ text, kind: 'comment' }];
    const tokens: ExampleToken[] = [];
    let offset = 0;
    for (const token of text.matchAll(CODE_TOKENS)) {
        tokens.push({ text: text.slice(offset, token.index), kind: '' });
        assert.ok(token.groups !== undefined, 'The syntax pattern must name its token groups.');
        const kind = Object.entries(token.groups).find(([, value]) => value === token[0])?.[0];
        assert.ok(kind !== undefined, 'The syntax token must have a token group.');
        tokens.push({ text: token[0], kind });
        offset = token.index + token[0].length;
    }
    tokens.push({ text: text === '' ? ' ' : text.slice(offset), kind: '' });
    return tokens;
}

/**
 * Build the numbered syntax tokens shown in the home-page example.
 *
 * @param code the complete example source.
 * @returns the numbered lines and their syntax tokens.
 */
export function buildExampleLines(code: string): ExampleLine[] {
    return code
        .trimEnd()
        .split('\n')
        .map((text, index) => ({
            number: index + 1,
            tokens: tokenizeExampleLine(text),
        }));
}
