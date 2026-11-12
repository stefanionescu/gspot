import type { Node } from 'web-tree-sitter';

import {
    BASH_TOKEN_FORMS,
    DOWNLOAD_COMMANDS,
    ELEVATE_COMMAND,
    IFS_VARIABLE,
    INLINE_ASSIGNMENT_NODES,
    INTERPRETER_COMMANDS,
    SAVED_IFS,
    SEQUENCE_COMMAND,
} from '#cli/config/parsers/code.ts';
import type { ScriptSyntax } from '#cli/types/parsers.ts';

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
