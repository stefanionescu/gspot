import type { GrammarName } from '#cli/types/parsers/code.ts';
import { maskGrammarComments } from '#cli/parsers/code/comments.ts';

/**
Skip blank lines and lines that hold only a comment of the grammar.

@param text the source.
@param grammar the language whose comments count as no code.
*/
export async function countCodeLines(text: string, grammar: GrammarName | 'sql'): Promise<number> {
    const code = await maskGrammarComments(grammar, text);
    return code.split('\n').filter((line) => line.trim() !== '').length;
}
