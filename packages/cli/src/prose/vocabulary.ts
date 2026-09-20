// The accept list Vale reads: tool names from the shipped list and [prose] vocabulary.
import type { Policy } from '#types/config.ts';
import type { Vocabulary } from '#types/prose.ts';
import { readAsset } from '#cli/platform/assets.ts';

function sorted(words: Iterable<string>): string[] {
    return [...new Set(words)].toSorted((a, b) => a.localeCompare(b));
}

/**
 * The vocabulary for a repository.
 * @param policy the repository policy
 * @returns the accept list (shipped names plus [prose] vocabulary)
 */
export function vocabularyFor(policy: Policy): Vocabulary {
    const shipped = readAsset('presets/concern/prose/vocabularies/gspot/accept.txt').trim().split(/\r?\n/u);
    return { accept: sorted([...shipped, ...policy.prose.vocabulary]) };
}
