import type { Node } from 'web-tree-sitter';

import {
    END_OF_OPTIONS,
    FORWARDED_ARGUMENTS,
    STRING_EXPANSION_NODES,
    TRAP_COMMAND,
    TRAP_SOURCE_ROWS,
    TRAP_STRING_ESCAPES,
} from '#cli/config/parsers/code.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import type { ParseCache, ScriptSyntax, TrapScript } from '#cli/types/parsers.ts';

function decodeTrapBody(body: Node): { text: string; sourceRows: TrapScript['sourceRows'] } {
    const quoted = body.text.slice(1, -1);
    const pattern = body.type === 'string' ? TRAP_STRING_ESCAPES : TRAP_SOURCE_ROWS;
    let text = '';
    let end = 0;
    let line = body.startPosition.row + 1;
    const sourceRows = [{ offset: 0, line }];
    for (const match of quoted.matchAll(pattern)) {
        text += quoted.slice(end, match.index);
        const character = match[1];
        text += character === '\n' ? '' : (character ?? match[0]);
        if (match[0].endsWith('\n')) {
            line += 1;
            sourceRows.push({ offset: text.length, line });
        }
        end = match.index + match[0].length;
    }
    return { text: text + quoted.slice(end), sourceRows };
}

function isLiteralString(node: Node): boolean {
    return (
        node.type === 'raw_string' ||
        (node.type === 'string' && node.descendantsOfType(STRING_EXPANSION_NODES).length === 0)
    );
}

function getLiteralArgument(argument: Node): string | undefined {
    if (argument.type === 'word' || argument.type === 'number') return argument.text;
    return isLiteralString(argument) ? argument.text.slice(1, -1) : undefined;
}

function findSwallowingCommand(list: Node): Node | undefined {
    const tail = list.namedChildren.at(-1);
    if (tail?.type !== 'command' || list.children.every((child) => child.type !== '||')) return undefined;
    const name = tail.childForFieldName('name')?.text;
    return (name === 'true' || name === ':') && tail.childrenForFieldName('argument').length === 0 ? tail : undefined;
}

/**
Parse literal trap scripts once and retain their trees until the caller disposes them.

@param resources disposes the script trees after their readers finish.
*/
export async function parseTrapScripts(
    commands: Node[],
    cache: ParseCache | undefined,
    resources: Disposable[],
): Promise<TrapScript[]> {
    const bodies = commands
        .filter((command) => command.childForFieldName('name')?.text === TRAP_COMMAND)
        .flatMap((trap) => {
            const [body, ...signals] = trap
                .childrenForFieldName('argument')
                .filter((argument) => argument.text !== END_OF_OPTIONS);
            if (body === undefined || signals.length === 0) return [];
            return isLiteralString(body) ? [{ trap, body }] : [];
        });
    const scripts: TrapScript[] = [];
    for (const { trap, body } of bodies) {
        const { text, sourceRows } = decodeTrapBody(body);
        const tree = await parseSource('bash', text, cache);
        resources.push(tree);
        scripts.push({ trap, body, syntaxRoot: tree.rootNode, sourceRows });
    }
    return scripts;
}

export function buildCommandCalls(commands: Node[], sourceRows?: TrapScript['sourceRows']): ScriptSyntax['calls'] {
    return commands.flatMap((node) => {
        const name = node.childForFieldName('name')?.text ?? node.child(0)?.text;
        if (name === undefined) return [];
        const commandArguments =
            node.type === 'declaration_command' ? node.namedChildren : node.childrenForFieldName('argument');
        const words = commandArguments.filter(
            (argument) => argument.type === 'word' || argument.type === 'variable_name',
        );
        return [
            {
                name,
                count: commandArguments.length,
                line: findSourceLine(node, sourceRows),
                forwards: commandArguments.some((argument) => FORWARDED_ARGUMENTS.has(argument.text)),
            },
            ...words.map((argument) => ({
                name: argument.text,
                count: 0,
                line: findSourceLine(argument, sourceRows),
                forwards: false,
            })),
        ];
    });
}

export function listScriptCommands(commands: Node[], traps: TrapScript[]): ScriptSyntax['commands'] {
    return [
        ...commands.map((node) => ({ node, sourceRows: undefined as TrapScript['sourceRows'] | undefined })),
        ...traps.flatMap((trap) =>
            trap.syntaxRoot.descendantsOfType('command').map((node) => ({ node, sourceRows: trap.sourceRows })),
        ),
    ].flatMap(({ node, sourceRows }) => {
        const name = node.childForFieldName('name')?.text;
        if (name === undefined) return [];
        return [
            {
                name,
                line: findSourceLine(node, sourceRows),
                arguments: node.childrenForFieldName('argument').map((argument) => getLiteralArgument(argument)),
            },
        ];
    });
}

export function listSwallowedLines(syntaxRoot: Node, traps: TrapScript[]): number[] {
    return [
        { node: syntaxRoot, sourceRows: undefined as TrapScript['sourceRows'] | undefined },
        ...traps.map((trap) => ({ node: trap.syntaxRoot, sourceRows: trap.sourceRows })),
    ].flatMap(({ node: root, sourceRows }) =>
        root.descendantsOfType('list').flatMap((node) => {
            const swallowing = findSwallowingCommand(node);
            return swallowing === undefined ? [] : [findSourceLine(swallowing, sourceRows)];
        }),
    );
}

export function findSourceLine(node: Node, sourceRows?: TrapScript['sourceRows']): number {
    if (sourceRows === undefined) return node.startPosition.row + 1;
    return Math.max(...sourceRows.filter((row) => row.offset <= node.startIndex).map((row) => row.line));
}
