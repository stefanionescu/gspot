// The length of Go files and functions, read from the Go grammar.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { Node } from 'web-tree-sitter';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { parserFor } from '#cli/naming/parsers.ts';

const DEFAULT_FILE_LINES = 300;
const DEFAULT_FUNCTION_LINES = 60;
const FUNCTION_NODES = ['function_declaration', 'method_declaration'];

function sources(input: EngineInput): { path: string; text: string }[] {
    return input.files
        .filter((file) => file.nature === 'source' && file.path.endsWith('.go'))
        .map((file) => ({ path: file.path, text: readFileSync(join(input.root, file.path), 'utf8') }));
}

function isCode(line: string): boolean {
    const trimmed = line.trim();
    return trimmed !== '' && !trimmed.startsWith('//');
}

// The functions and methods of one file that run past the ceiling.
function longFunctions(input: EngineInput, path: string, root: Node, ceiling: number): Finding[] {
    return root.descendantsOfType(FUNCTION_NODES).flatMap((node): Finding[] => {
        const lines = node.endPosition.row - node.startPosition.row + 1;
        if (lines <= ceiling) return [];
        const name = node.childForFieldName('name')?.text ?? 'This function';
        const text = `${name} is ${String(lines)} lines long, and the ceiling is ${String(ceiling)}.`;
        return [
            {
                check: input.spec.id,
                file: path,
                line: node.startPosition.row + 1,
                rule: 'function-lines',
                message: text,
                fixable: false,
            },
        ];
    });
}

/**
 * One finding for each Go file with more code lines than limits.file_lines allows.
 * @param input the engine input
 * @returns the findings
 */
export function goFileLength(input: EngineInput): Promise<Finding[]> {
    const ceiling = input.view.limit('file_lines', 'go') ?? DEFAULT_FILE_LINES;
    const found = sources(input).flatMap((source): Finding[] => {
        const lines = source.text.split('\n').filter((line) => isCode(line)).length;
        if (lines <= ceiling) return [];
        const text = `This file holds ${String(lines)} code lines, and the ceiling is ${String(ceiling)}.`;
        return [
            { check: input.spec.id, file: source.path, line: 1, rule: 'file-lines', message: text, fixable: false },
        ];
    });
    return Promise.resolve(found);
}

/**
 * One finding for each Go function or method with more lines than limits.function_lines allows.
 * @param input the engine input
 * @returns the findings
 */
export async function goFunctionLength(input: EngineInput): Promise<Finding[]> {
    const ceiling = input.view.limit('function_lines', 'go') ?? DEFAULT_FUNCTION_LINES;
    const parser = await parserFor('go');
    const findings: Finding[] = [];
    for (const source of sources(input)) {
        const tree = parser.parse(source.text);
        if (tree === null) continue;
        findings.push(...longFunctions(input, source.path, tree.rootNode, ceiling));
        tree.delete();
    }
    return findings;
}
