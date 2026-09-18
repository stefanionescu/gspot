// The accept list Vale reads: tool names from the shipped list and [prose] vocabulary.
import type { Policy } from '#types/config.ts';
import type { Vocabulary } from '#types/prose.ts';
import { SHIPPED_VOCABULARY } from '#config/prose.ts';

function sorted(words: Iterable<string>): string[] {
    return [...new Set(words)].toSorted((a, b) => a.localeCompare(b));
}

/**
 * The vocabulary for a repository.
 * @param policy the repository policy
 * @returns the accept list (shipped names plus [prose] vocabulary)
 */
export function vocabularyFor(policy: Policy): Vocabulary {
    return { accept: sorted([...SHIPPED_VOCABULARY, ...policy.prose.vocabulary]) };
}

/**
 * The text of one vocabulary file: one word per line.
 * @param words the words
 * @returns the file text
 */
export function vocabularyText(words: string[]): string {
    return words.length === 0 ? '' : `${words.join('\n')}\n`;
}
