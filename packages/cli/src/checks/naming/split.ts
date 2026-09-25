import { splitByCase } from 'scule';

const SEPARATORS = /[^A-Za-z0-9]+/u;
const DIGIT = /\d/u;

/**
 * The parts of an identifier, lowercased. `HTMLParser` gives `html`, `parser`; `user_id` gives `user`, `id`; `v2` gives `v`, `2`.
 * @param name the identifier
 * @returns the parts
 */
export function splitParts(name: string): string[] {
    return name
        .split(SEPARATORS)
        .filter((segment) => segment !== '')
        .flatMap((segment) => splitByCase(segment))
        .flatMap((part) => part.split(/(?<=\D)(?=\d)|(?<=\d)(?=\D)/u))
        .map((part) => part.toLowerCase())
        .filter((part) => part !== '');
}

/**
 * The words of an identifier: its parts without the digit runs.
 * @param name the identifier
 * @returns the words
 */
export function wordsOf(name: string): string[] {
    return splitParts(name).filter((part) => !DIGIT.test(part));
}

/**
 * The first part that appears twice, if any.
 * @param parts the parts
 * @returns the repeated part
 */
export function repeatedPart(parts: string[]): string | undefined {
    const seen = new Set<string>();
    for (const part of parts) {
        if (seen.has(part)) return part;
        seen.add(part);
    }
    return undefined;
}
