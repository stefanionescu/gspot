// Parses configured commands into an executable and literal arguments.
import { parseShell } from '@yarnpkg/parsers';

/**
 * Read a configured executable and literal arguments, preserving shell quoting.
 * @param source the command line as written
 * @returns the executable and its arguments
 */
export function parseCommand(source: string): string[] {
    const diagnostic = `The command "${source}" must be one executable with literal arguments: no pipes, &&, redirection, or variables.`;
    const lines = parseShell(source, { isGlobPattern: () => false });
    const line = lines[0];
    if (lines.length !== 1 || line?.type !== ';') throw new Error(diagnostic);
    const command = line.command.chain;
    if (
        command.type !== 'command' ||
        command.envs.length > 0 ||
        [line.command.then, command.then].some((next) => next !== undefined)
    )
        throw new Error(diagnostic);
    return command.args.map((argument) => {
        if (argument.type !== 'argument') throw new Error(diagnostic);
        return argument.segments
            .map((segment) => {
                if (segment.type !== 'text') throw new Error(diagnostic);
                return segment.text;
            })
            .join('');
    });
}
