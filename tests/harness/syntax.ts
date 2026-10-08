import { parseSource } from '#cli/parsers/tree-sitter.ts';
import type { GrammarName } from '#cli/types/parsers/source.ts';
import type { OwnedSyntaxTree } from '#tests/types/harness/syntax.ts';

/**
 * Parse sample source and release its tree when the caller leaves its scope.
 * @param language the grammar used by this sample
 * @param source the exact source text
 * @returns the tree owned by the caller
 */
export async function parseTestSource(language: GrammarName, source: string): Promise<OwnedSyntaxTree> {
    const tree = await parseSource(language, source);
    return Object.assign(tree, {
        [Symbol.dispose]() {
            tree.delete();
        },
    });
}
