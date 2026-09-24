// Shell scripts through tree-sitter: the functions with their line ranges and bodies.
import type { EngineInput } from '#cli/checks/input.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { executableStatements } from '#cli/structure/statements.ts';

/**
 * The functions a shell script declares, in order.
 * @param text the script text
 * @param context optional execution observations and their resource owner
 * @returns the functions with one-based start and end lines and the lines between the braces
 */
export async function scriptFunctions(
    text: string,
    context?: Pick<EngineInput, 'observations' | 'resources'>,
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
export function functionAt(functions: ScriptFunction[], line: number): ScriptFunction | undefined {
    return functions.find((entry) => entry.start <= line && line <= entry.end);
}

/** One shell function: its name, its declaration line and closing line (one-based), and the lines between the braces. */
export type ScriptFunction = { name: string; start: number; end: number; body: string[]; statements: number };

/** One shell script the engine reads. */
export type ScriptFile = {
    path: string;
    text: string;
    lines: string[];
    functions: ScriptFunction[];
    isExecutable: boolean;
    /** Identifier tokens outside declaration lines, by name, with the lines they appear on. */
    references: Map<string, number[]>;
    /** Names assigned at the top level, outside every function. */
    assignments: Set<string>;
};

/** The shell scripts of one scope, with the function owners across them. */
export type ScriptIndex = { files: ScriptFile[]; owners: Map<string, string> };

/** How an analysis reports one problem in one file. */
export type ScriptReport = (line: number, rule: string, message: string) => void;
