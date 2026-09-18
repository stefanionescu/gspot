// Shell scripts through tree-sitter: the functions with their line ranges and bodies.
import { parserFor } from '#cli/naming/parsers.ts';
import type { ShellFunction } from '#types/structure.ts';

/**
 * The functions a shell script declares, in order.
 * @param text the script text
 * @returns the functions with one-based start and end lines and the lines between the braces
 */
export async function shellFunctions(text: string): Promise<ShellFunction[]> {
    const parser = await parserFor('bash');
    const tree = parser.parse(text);
    if (tree === null) return [];
    const lines = text.split('\n');
    try {
        return tree.rootNode.descendantsOfType('function_definition').flatMap((node) => {
            const name = node.childForFieldName('name')?.text ?? '';
            if (name === '') return [];
            const start = node.startPosition.row + 1;
            const end = node.endPosition.row + 1;
            return [{ name, start, end, body: lines.slice(start, end - 1) }];
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
export function functionAt(functions: ShellFunction[], line: number): ShellFunction | undefined {
    return functions.find((entry) => entry.start <= line && line <= entry.end);
}
