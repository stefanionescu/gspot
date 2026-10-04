import type { Node } from 'web-tree-sitter';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { isTrivialFile, executableStatements } from '#cli/parsers/statements.ts';
import type { CodeLine, ScriptSyntax, BashParseOptions } from '#cli/types/parsers/bash.ts';
import { DECLARATION_WORDS, ALL_POSITIONAL_PARAMETERS } from '#cli/config/parsers/bash.ts';

// An inner function's parameters belong to it rather than to an enclosing function.
function functionOwner(node: Node): Node | undefined {
    let parent = node.parent;
    while (parent !== null) {
        if (parent.type === 'function_definition') return parent;
        parent = parent.parent;
    }
    return undefined;
}

function highestRead(node: Node): number {
    const expansions = node.descendantsOfType(['simple_expansion', 'expansion']);
    const positions = expansions.flatMap((expansion) => {
        if (functionOwner(expansion)?.id !== node.id) return [];
        const parameter = expansion.namedChildren[0]?.text;
        if (parameter === undefined) return [];
        if (ALL_POSITIONAL_PARAMETERS.has(parameter)) return [Number.POSITIVE_INFINITY];
        return /^[1-9]\d*$/u.test(parameter) ? [Number(parameter)] : [];
    });
    if (
        node
            .descendantsOfType('command')
            .some(
                (command) =>
                    functionOwner(command)?.id === node.id && command.childForFieldName('name')?.text === 'shift',
            )
    )
        return Number.POSITIVE_INFINITY;
    return Math.max(0, ...positions);
}

// Preserve code-unit positions and line breaks while removing the syntax tree's comment spans.
function maskComments(text: string, comments: Node[]): string {
    const pieces: string[] = [];
    let offset = 0;
    for (const comment of comments) {
        pieces.push(
            text.slice(offset, comment.startIndex),
            text
                .slice(comment.startIndex, comment.endIndex)
                .replaceAll(/[^\r\n]/gu, (character) => ' '.repeat(character.length)),
        );
        offset = comment.endIndex;
    }
    pieces.push(text.slice(offset));
    return pieces.join('');
}

/**
 * Parse comments, function ranges, calls, parameter reads, and file content through one Bash syntax tree.
 * @param text the exact source
 * @param options the selected size floor and run-owned parser resources
 * @returns syntax data that remains valid after the tree is disposed
 */
export async function parseBashScript(text: string, options: BashParseOptions): Promise<ScriptSyntax> {
    const tree = await parseSource('bash', text, options.context);
    try {
        const comments = tree.rootNode.descendantsOfType('comment');
        const codeText = maskComments(text, comments);
        const code = codeText.split('\n');
        const functions = tree.rootNode.descendantsOfType('function_definition').flatMap((node) => {
            const name = node.childForFieldName('name')?.text;
            const body = node.childForFieldName('body');
            if (name === undefined || body === null) return [];
            const start = node.startPosition.row + 1;
            const end = node.endPosition.row + 1;
            return [
                {
                    name,
                    start,
                    end,
                    body: codeText.slice(body.startIndex + 1, body.endIndex - 1).split('\n'),
                    statements: executableStatements(body.namedChildren, 'bash'),
                    highestRead: highestRead(node),
                },
            ];
        });
        const commands = tree.rootNode.descendantsOfType('command');
        const calls = commands.flatMap((node) => {
            const name = node.childForFieldName('name')?.text;
            return name === undefined
                ? []
                : [{ name, count: node.childrenForFieldName('argument').length, line: node.startPosition.row + 1 }];
        });
        const quotedArguments = commands.flatMap((node) => {
            const command = node.childForFieldName('name')?.text;
            if (command === undefined) return [];
            return node
                .childrenForFieldName('argument')
                .filter(
                    (argument) =>
                        (argument.type === 'string' || argument.type === 'raw_string') &&
                        argument.endPosition.row > argument.startPosition.row,
                )
                .map((argument) => ({
                    command,
                    start: argument.startPosition.row + 1,
                    end: argument.endPosition.row + 1,
                }));
        });
        return {
            code,
            functions,
            calls,
            quotedArguments,
            isTrivialFile:
                options.minimumStatements !== undefined &&
                isTrivialFile(tree.rootNode, 'bash', options.minimumStatements),
        };
    } finally {
        tree.delete();
    }
}

/**
 * Select non-blank code lines after the parser has masked comments.
 * @param lines the parsed code lines
 * @returns trimmed code and one-based positions
 */
export function codeLines(lines: string[]): CodeLine[] {
    return lines.flatMap((line, index) => {
        const code = line.trim();
        return code === '' ? [] : [{ number: index + 1, code }];
    });
}

/**
 * Remove a declaration word and its flags. Retain the assignment or command.
 * @param code a comment-free code line
 * @returns the value after export, readonly, local, declare, or typeset
 */
export function withoutDeclaration(code: string): string {
    const words = code.split(/\s+/u);
    if (!DECLARATION_WORDS.has(words[0] ?? '')) return code;
    let index = 1;
    while ((words[index] ?? '').startsWith('-')) index += 1;
    return words.slice(index).join(' ');
}
