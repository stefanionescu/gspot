import { parseSource } from '#cli/parsers/tree-sitter.ts';
import type { EngineInput } from '#cli/types/checks/checks.ts';
import type { ScriptFunction } from '#cli/types/checks/structure.ts';
import { executableStatements } from '#cli/checks/structure/statements.ts';

/**
 * The functions a shell script declares, in order.
 * @param text the script text
 * @param context optional execution reads and their resource owner
 * @returns the functions with one-based start and end lines and the lines between the braces
 */
export async function scriptFunctions(
    text: string,
    context?: Pick<EngineInput, 'reads' | 'resources'>,
): Promise<ScriptFunction[]> {
    const tree = await parseSource('bash', text, context);
    if (tree === null) throw new Error('The source parser returned no tree.');
    const lines = text.split('\n');
    try {
        return tree.rootNode.descendantsOfType('function_definition').flatMap((node) => {
            const name = node.childForFieldName('name')?.text ?? '';
            if (name === '') return [];
            const start = node.startPosition.row + 1;
            const end = node.endPosition.row + 1;
            return [
                {
                    name,
                    start,
                    end,
                    body: lines.slice(start, end - 1),
                    statements: executableStatements(node.childForFieldName('body')?.namedChildren ?? [], 'bash'),
                },
            ];
        });
    } finally {
        tree.delete();
    }
}

/**
 * The function whose lines include a line number.
 * @param functions the file's functions
 * @param line the one-based line
 * @returns the function, or undefined at the top level
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The function whose lines include a line number. 4 files make 5 calls; one owner keeps that behavior in one place.
export function functionAt(functions: ScriptFunction[], line: number): ScriptFunction | undefined {
    return functions.find((entry) => entry.start <= line && line <= entry.end);
}
