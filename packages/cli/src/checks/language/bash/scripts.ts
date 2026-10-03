import { readSource } from '#cli/repository/sources.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import type { EngineInput } from '#cli/types/execution/execution.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';
import { executableStatements } from '#cli/checks/general/structure/statements.ts';
import { IDENTIFIER, TOP_LEVEL_ASSIGNMENT } from '#cli/config/checks/language/bash.ts';
import { withoutComment, withoutDeclaration } from '#cli/checks/language/bash/code-lines.ts';
import type { ScriptFile, ScriptIndex, ScriptFunction } from '#cli/types/checks/language/bash.ts';

const cache = new WeakMap<object, Map<string, Promise<ScriptIndex>>>();

function referencesOf(lines: string[], functions: ScriptFunction[]): Map<string, number[]> {
    const references = new Map<string, number[]>();
    const declarations = new Set(functions.map((entry) => entry.start));
    for (const [index, line] of lines.entries()) {
        const number = index + 1;
        if (declarations.has(number)) continue;
        for (const match of withoutComment(line).matchAll(IDENTIFIER)) {
            const found = references.get(match[0]) ?? [];
            found.push(number);
            references.set(match[0], found);
        }
    }
    return references;
}

function assignmentsOf(lines: string[], functions: ScriptFunction[]): Set<string> {
    const names = new Set<string>();
    for (const [index, line] of lines.entries()) {
        if (functionAt(functions, index + 1) !== undefined) continue;
        const code = withoutDeclaration(withoutComment(line).trim());
        const name = TOP_LEVEL_ASSIGNMENT.exec(code)?.groups?.['name'];
        if (name !== undefined) names.add(name);
    }
    return names;
}

async function readScript(input: EngineInput, file: TrackedFile): Promise<ScriptFile> {
    const text = readSource(input.root, file.path, input.reads).toString('utf8');
    const lines = text.split('\n');
    const functions = await scriptFunctions(text, input);
    return {
        path: file.path,
        text,
        lines,
        functions,
        isExecutable: file.executable,
        references: referencesOf(lines, functions),
        assignments: assignmentsOf(lines, functions),
    };
}

async function build(input: EngineInput, files: TrackedFile[]): Promise<ScriptIndex> {
    const read: ScriptFile[] = [];
    for (const file of files) read.push(await readScript(input, file));
    const owners = new Map<string, string>();
    for (const file of read)
        for (const entry of file.functions) if (!owners.has(entry.name)) owners.set(entry.name, file.path);
    return { files: read, owners };
}

/**
 * The shell index of a scope, built on first use and shared by every analysis of the run.
 * @param input the engine input
 * @param files the shell files the check runs over
 * @returns the index
 */
export function scriptIndex(input: EngineInput, files: TrackedFile[]): Promise<ScriptIndex> {
    let perScope = cache.get(input.reads);
    if (perScope === undefined) {
        perScope = new Map();
        cache.set(input.reads, perScope);
    }
    const key = JSON.stringify([input.scope, files.map((file) => file.path)]);
    let index = perScope.get(key);
    if (index === undefined) {
        index = build(input, files);
        perScope.set(key, index);
    }
    return index;
}

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
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Four script checks find the function that holds a line by this one containment rule.
export function functionAt(functions: ScriptFunction[], line: number): ScriptFunction | undefined {
    return functions.find((entry) => entry.start <= line && line <= entry.end);
}
