import type { Node } from 'web-tree-sitter';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import type { ParseCache } from '#cli/types/parsers/code/grammars.ts';
import type { TrapScript, ScriptSyntax } from '#cli/types/parsers/code/bash.ts';

import {
    TRAP_COMMAND,
    END_OF_OPTIONS,
    FORWARDED_ARGUMENTS,
    TRAP_STRING_ESCAPES,
    TRAP_EXPANSION_NODES,
} from '#cli/config/parsers/code/bash.ts';

/**
Parse literal trap scripts once and retain their trees until the caller disposes them.

@param commands the script's commands.
@param cache the grammars of this run.
@param resources disposes the script trees after their readers finish.
@returns the script bodies and parsed roots.
*/
export async function readTrapScripts(
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
            const literal =
                body.type === 'raw_string' ||
                (body.type === 'string' && body.descendantsOfType(TRAP_EXPANSION_NODES).length === 0);
            return literal ? [{ trap, body }] : [];
        });
    const scripts: TrapScript[] = [];
    for (const { trap, body } of bodies) {
        const quoted = body.text.slice(1, -1);
        const text =
            body.type === 'string'
                ? quoted.replaceAll(TRAP_STRING_ESCAPES, (_match, character: string) =>
                      character === '\n' ? '' : character,
                  )
                : quoted;
        const tree = await parseSource('bash', text, cache);
        resources.defer(() => {
            tree.delete();
        });
        scripts.push({ trap, body, root: tree.rootNode });
    }
    return scripts;
}

/**
Read command names, argument counts, and argument forwarding from script or trap nodes.

@param commands the parsed commands.
@param lineOffset the script's line offset in the source script.
@returns calls with their source positions.
*/
export function buildCommandCalls(commands: Node[], lineOffset: number): ScriptSyntax['calls'] {
    return commands.flatMap((node) => {
        const name = node.childForFieldName('name')?.text;
        if (name === undefined) return [];
        const commandArguments = node.childrenForFieldName('argument');
        const trapFunction = name === TRAP_COMMAND ? commandArguments[0] : undefined;
        const calls: ScriptSyntax['calls'] = [
            {
                name,
                count: commandArguments.length,
                line: lineOffset + node.startPosition.row + 1,
                forwards: commandArguments.some((argument) => FORWARDED_ARGUMENTS.has(argument.text)),
            },
        ];
        if (trapFunction?.type === 'word')
            calls.push({
                name: trapFunction.text,
                count: 0,
                line: lineOffset + trapFunction.startPosition.row + 1,
                forwards: false,
            });
        return calls;
    });
}
