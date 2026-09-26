import { parseShell } from '@yarnpkg/parsers';
/**
 * Quote one argument for a POSIX shell command shown to the reader.
 * @param value the argument
 * @returns the argument, quoted when it needs to be
 */
export function quoteArgument(value: string): string {
    if (/^[a-zA-Z0-9_./-]+$/u.test(value)) return value;
    return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

/**
 * Read a configured executable and literal arguments, preserving shell quoting.
 * @param source the command line as written
 * @returns the executable and its arguments
 */
export function commandArguments(source: string): string[] {
    const lines = parseShell(source, { isGlobPattern: () => false });
    const line = lines[0];
    if (lines.length !== 1 || line?.type !== ';' || line.command.then !== undefined)
        throw new Error('Configure one executable with literal arguments.');
    const command = line.command.chain;
    if (command.type !== 'command' || command.then !== undefined || command.envs.length > 0)
        throw new Error('Configure one executable with literal arguments.');
    return command.args.map((argument) => {
        if (argument.type !== 'argument') throw new Error('Command redirection is not supported.');
        return argument.segments
            .map((segment) => {
                if (segment.type !== 'text') throw new Error('Command arguments must be literal values.');
                return segment.text;
            })
            .join('');
    });
}
