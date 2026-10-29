import { CODE_TOKENS } from '#docs/config/home.ts';
import { type ExampleToken } from '#docs/types/components.ts';

/**
Split one example line into syntax tokens.

@param text the source line
@returns its syntax tokens
*/
export function tokenizeExampleLine(text: string): ExampleToken[] {
    if (text.trimStart().startsWith('//')) return [{ text, kind: 'comment' }];
    const tokens: ExampleToken[] = [];
    let offset = 0;
    for (const token of text.matchAll(CODE_TOKENS)) {
        tokens.push({ text: text.slice(offset, token.index), kind: '' });
        const kind =
            Object.entries(token.groups as Record<string, string>).find(([, value]) => value === token[0])?.[0] ?? '';
        tokens.push({ text: token[0], kind });
        offset = token.index + token[0].length;
    }
    tokens.push({ text: text === '' ? ' ' : text.slice(offset), kind: '' });
    return tokens;
}
