import { splitByCase } from 'scule';

import { DIGIT_BOUNDARY, NUMERIC_WORDS, WORD_SEPARATORS } from '#cli/config/configurations/naming.ts';

export function splitWords(name: string): string[] {
    return name
        .split(WORD_SEPARATORS)
        .filter((segment) => segment !== '')
        .flatMap((segment) => splitByCase(segment))
        .flatMap((word) => (NUMERIC_WORDS.has(word.toLowerCase()) ? [word] : word.split(DIGIT_BOUNDARY)))
        .map((word) => word.toLowerCase())
        .filter((word) => word !== '');
}
