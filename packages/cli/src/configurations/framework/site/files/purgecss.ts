import { readFileSync } from 'node:fs';

/**
Split a built page or script into the words that can name a selector, without the colons that end a word.

@param content the text of a built page or script.
@returns the words.
*/
export const defaultExtractor = (content: string): string[] =>
    (content.match(/[^<>"'`\s]+/gu) ?? [])
        .map((token) => {
            let end = token.length;
            while (end > 0 && token[end - 1] === ':') end--;
            return token.slice(0, end);
        })
        .filter((token) => token !== '');

export const safelist = {
    standard: [
        /^:[\w-]+$/u,
        ...(JSON.parse(readFileSync(new URL('purgecss-safelist.json', import.meta.url), 'utf8')) as string[]),
    ],
};
