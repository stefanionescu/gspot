import { splitByCase } from 'scule';
import { NUMERIC_WORDS, DIGIT_BOUNDARY, WORD_SEPARATORS } from '#cli/config/configurations/naming.ts';

export function splitWords(name: string): string[] {
    return name
        .split(WORD_SEPARATORS)
        .filter((segment) => segment !== '')
        .flatMap((segment) => splitByCase(segment))
        .flatMap((word) => (NUMERIC_WORDS.has(word.toLowerCase()) ? [word] : word.split(DIGIT_BOUNDARY)))
        .map((word) => word.toLowerCase())
        .filter((word) => word !== '');
}
