import { posix } from 'node:path';
import type { Node } from 'web-tree-sitter';
import type { ScriptSyntax } from '#cli/types/parsers.ts';

import {
    SAVED_IFS,
    IFS_VARIABLE,
    BASH_TOKEN_FORMS,
    SEQUENCE_COMMAND,
    DOWNLOAD_COMMANDS,
    DELEGATING_COMMANDS,
    INTERPRETER_COMMANDS,
    INLINE_ASSIGNMENT_NODES,
    PROGRAM_PREFIX_ARGUMENT,
} from '#cli/config/parsers/code.ts';

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

/**
Get the program that a command starts, without its folder, so that /usr/bin/curl and /bin/sh count as curl and sh.
*/
function getProgramName(command: Node): string {
    return posix.basename(command.childForFieldName('name')?.text ?? '');
}

function isDownload(command: Node): boolean {
    return DOWNLOAD_COMMANDS.has(getProgramName(command));
}

function isInterpreterRun(command: Node): boolean {
    const name = getProgramName(command);
    const delegated = command
        .childrenForFieldName('argument')
        .find((argument) => !PROGRAM_PREFIX_ARGUMENT.test(argument.text));
    const program = DELEGATING_COMMANDS.has(name) ? posix.basename(delegated?.text ?? '') : name;
    return INTERPRETER_COMMANDS.has(program);
}

/**
List the commands that run a download in a shell as it arrives: a pipeline from curl or wget into a shell, and a shell
that reads a command or process substitution of one.
*/
function listDownloadRuns(syntaxRoot: Node): Node[] {
    const piped = syntaxRoot.descendantsOfType('pipeline').filter((pipeline) => {
        const commands = pipeline.namedChildren.filter((node) => node.type === 'command');
        const download = commands.findIndex((command) => isDownload(command));
        return download !== -1 && commands.slice(download).some((command) => isInterpreterRun(command));
    });
    const fed = syntaxRoot.descendantsOfType('command').filter(
        (command) =>
            isInterpreterRun(command) &&
            command
                .childrenForFieldName('argument')
                .flatMap((argument) => argument.descendantsOfType('command'))
                .some((inner) => isDownload(inner)),
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
