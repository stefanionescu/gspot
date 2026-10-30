import { type Node } from 'web-tree-sitter';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { END_OF_OPTIONS } from '#cli/config/parsers/code/bash.ts';
import { type ParseCache } from '#cli/types/parsers/code/grammars.ts';
import { type TrapScript, type ScriptSyntax } from '#cli/types/parsers/code/bash.ts';

import {
    TRAP_COMMAND,
    TRAP_SOURCE_ROWS,
    FORWARDED_ARGUMENTS,
    TRAP_STRING_ESCAPES,
    TRAP_EXPANSION_NODES,
} from '#cli/config/parsers/code/traps.ts';

function readTrapBody(body: Node): { text: string; sourceRows: TrapScript['sourceRows'] } {
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

/**
Parse literal trap scripts once and retain their trees until the caller disposes them.

@param commands the script's commands.
@param cache the grammars of this run.
@param resources disposes the script trees after their readers finish.
*/
export async function parseTrapScripts(
    commands: Node[],
    cache: ParseCache | undefined,
    resources: DisposableStack,
): Promise<TrapScript[]> {
    const bodies = commands
        .filter((command) => command.childForFieldName('name')?.text === TRAP_COMMAND)
        .flatMap((trap) => {
            const [body, ...signals] = trap
                .childrenForFieldName('argument')
                .filter((argument) => argument.text !== END_OF_OPTIONS);
            if (body === undefined || signals.length === 0) return [];
            const isLiteral =
                body.type === 'raw_string' ||
                (body.type === 'string' && body.descendantsOfType(TRAP_EXPANSION_NODES).length === 0);
            return isLiteral ? [{ trap, body }] : [];
        });
    const scripts: TrapScript[] = [];
    for (const { trap, body } of bodies) {
        const { text, sourceRows } = readTrapBody(body);
        const tree = resources.use(await parseSource('bash', text, cache));
        scripts.push({ trap, body, syntaxRoot: tree.rootNode, sourceRows });
    }
    return scripts;
}

/**
Read command names, argument counts, and argument forwarding from script or trap nodes.

@param commands the parsed commands.
@param sourceRows maps decoded trap offsets to original source lines.
*/
export function buildCommandCalls(commands: Node[], sourceRows?: TrapScript['sourceRows']): ScriptSyntax['calls'] {
    return commands.flatMap((node) => {
        const name = node.childForFieldName('name')?.text ?? node.child(0)?.text;
        if (name === undefined) return [];
        const commandArguments =
            node.type === 'declaration_command' ? node.namedChildren : node.childrenForFieldName('argument');
        const calls: ScriptSyntax['calls'] = [
            {
                name,
                count: commandArguments.length,
                line: findSourceLine(node, sourceRows),
                forwards: commandArguments.some((argument) => FORWARDED_ARGUMENTS.has(argument.text)),
            },
        ];
        for (const argument of commandArguments.filter(
            (argument) => argument.type === 'word' || argument.type === 'variable_name',
        ))
            calls.push({
                name: argument.text,
                count: 0,
                line: findSourceLine(argument, sourceRows),
                forwards: false,
            });
        return calls;
    });
}

/**
Read literal command arguments from the main script and its parsed traps.

@param commands the top-level parse's command nodes.
@param traps parsed trap bodies with their original source positions.
*/
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
                arguments: node.childrenForFieldName('argument').map((argument) => {
                    if (argument.type === 'word' || argument.type === 'number') return argument.text;
                    if (argument.type === 'raw_string') return argument.text.slice(1, -1);
                    if (
                        argument.type === 'string' &&
                        argument.descendantsOfType(['expansion', 'simple_expansion', 'command_substitution']).length ===
                            0
                    )
                        return argument.text.slice(1, -1);
                    return undefined;
                }),
            },
        ];
    });
}

/**
List failure handlers that discard a command's status in the script and its traps.

@param syntaxRoot the main script's parsed root.
@param traps parsed trap bodies with their original source positions.
*/
export function listSwallowedLines(syntaxRoot: Node, traps: TrapScript[]): number[] {
    return [
        { node: syntaxRoot, sourceRows: undefined as TrapScript['sourceRows'] | undefined },
        ...traps.map((trap) => ({ node: trap.syntaxRoot, sourceRows: trap.sourceRows })),
    ].flatMap(({ node: root, sourceRows }) =>
        root.descendantsOfType('list').flatMap((node) => {
            const tail = node.namedChildren.at(-1);
            if (tail?.type !== 'command' || !node.children.some((child) => child.type === '||')) return [];
            const name = tail.childForFieldName('name')?.text;
            return (name === 'true' || name === ':') && tail.childrenForFieldName('argument').length === 0
                ? [findSourceLine(tail, sourceRows)]
                : [];
        }),
    );
}

/**
Find the source line of a node after decoding the escaped characters and continuations of a trap.

@param node the decoded syntax node.
@param sourceRows source boundaries recorded while decoding the trap.
*/
export function findSourceLine(node: Node, sourceRows?: TrapScript['sourceRows']): number {
    if (sourceRows === undefined) return node.startPosition.row + 1;
    const source = sourceRows.findLast((row) => row.offset <= node.startIndex);
    return source?.line ?? node.startPosition.row + 1;
}
