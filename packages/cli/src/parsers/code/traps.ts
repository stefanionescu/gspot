import { type Node } from 'web-tree-sitter';

import {
    BASH_TOKEN_FORMS,
    DOWNLOAD_COMMANDS,
    ELEVATE_COMMAND,
    END_OF_OPTIONS,
    FORWARDED_ARGUMENTS,
    IFS_VARIABLE,
    INLINE_ASSIGNMENT_NODES,
    INTERPRETER_COMMANDS,
    SAVED_IFS,
    SEQUENCE_COMMAND,
    TRAP_COMMAND,
    TRAP_EXPANSION_NODES,
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

function readLiteralArgument(argument: Node): string | undefined {
    if (argument.type === 'word' || argument.type === 'number') return argument.text;
    const isLiteralString =
        argument.type === 'raw_string' ||
        (argument.type === 'string' && argument.descendantsOfType(TRAP_EXPANSION_NODES).length === 0);
    return isLiteralString ? argument.text.slice(1, -1) : undefined;
}

function findSwallowingCommand(list: Node): Node | undefined {
    const tail = list.namedChildren.at(-1);
    if (tail?.type !== 'command' || list.children.every((child) => child.type !== '||')) return undefined;
    const name = tail.childForFieldName('name')?.text;
    return (name === 'true' || name === ':') && tail.childrenForFieldName('argument').length === 0 ? tail : undefined;
}

function isScriptLevel(node: Node): boolean {
    for (let parent = node.parent; parent !== null; parent = parent.parent)
        if (parent.type === 'function_definition' || parent.type === 'subshell') return false;
    return true;
}

function listIfsWrites(syntaxRoot: Node): Node[] {
    return syntaxRoot.descendantsOfType('variable_assignment').filter((assignment) => {
        if (SAVED_IFS.test(assignment.childForFieldName('value')?.text ?? '')) return true;
        return (
            assignment.childForFieldName('name')?.text === IFS_VARIABLE &&
            !INLINE_ASSIGNMENT_NODES.includes((assignment.parent as Node).type as 'command') &&
            isScriptLevel(assignment)
        );
    });
}

function listSequenceLoops(syntaxRoot: Node): Node[] {
    return syntaxRoot.descendantsOfType('for_statement').filter((loop) =>
        loop
            .childrenForFieldName('value')
            .flatMap((value) => value.descendantsOfType('command'))
            .some((command) => command.childForFieldName('name')?.text === SEQUENCE_COMMAND),
    );
}

function isInterpreterRun(command: Node): boolean {
    const name = command.childForFieldName('name')?.text ?? '';
    const program = name === ELEVATE_COMMAND ? (command.childrenForFieldName('argument')[0]?.text ?? '') : name;
    return INTERPRETER_COMMANDS.has(program);
}

function listDownloadRuns(syntaxRoot: Node): Node[] {
    const piped = syntaxRoot.descendantsOfType('pipeline').filter((pipeline) => {
        const commands = pipeline.namedChildren.filter((node) => node.type === 'command');
        const download = commands.findIndex((command) =>
            DOWNLOAD_COMMANDS.has(command.childForFieldName('name')?.text ?? ''),
        );
        return download !== -1 && commands.slice(download).some((command) => isInterpreterRun(command));
    });
    const fed = syntaxRoot.descendantsOfType('command').filter(
        (command) =>
            isInterpreterRun(command) &&
            command
                .childrenForFieldName('argument')
                .flatMap((argument) => argument.descendantsOfType('command'))
                .some((inner) => DOWNLOAD_COMMANDS.has(inner.childForFieldName('name')?.text ?? '')),
    );
    return [...piped, ...fed];
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
            const isLiteral =
                body.type === 'raw_string' ||
                (body.type === 'string' && body.descendantsOfType(TRAP_EXPANSION_NODES).length === 0);
            return isLiteral ? [{ trap, body }] : [];
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
                arguments: node.childrenForFieldName('argument').map((argument) => readLiteralArgument(argument)),
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

export function listScriptForms(syntaxRoot: Node): ScriptSyntax['forms'] {
    return [
        ...Object.entries(BASH_TOKEN_FORMS)
            .flatMap(([type, forms]) =>
                syntaxRoot.descendantsOfType(type).flatMap((node) => node.children.map((token) => ({ token, forms }))),
            )
            .flatMap(({ token, forms }) => {
                const form = forms[token.type];
                return form === undefined ? [] : [{ form, line: token.startPosition.row + 1 }];
            }),
        ...listSequenceLoops(syntaxRoot).map((loop) => ({
            form: 'seq-loop' as const,
            line: loop.startPosition.row + 1,
        })),
        ...listIfsWrites(syntaxRoot).map((write) => ({
            form: 'script-ifs' as const,
            line: write.startPosition.row + 1,
        })),
        ...listDownloadRuns(syntaxRoot).map((run) => ({
            form: 'curl-pipe-shell' as const,
            line: run.startPosition.row + 1,
        })),
    ];
}
