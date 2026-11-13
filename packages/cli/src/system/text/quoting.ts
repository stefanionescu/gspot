import { UNQUOTED_ARGUMENT } from '#cli/config/system.ts';

export function quoteArgument(argument: string): string {
    return UNQUOTED_ARGUMENT.test(argument) ? argument : `'${argument.replaceAll("'", "'\"'\"'")}'`;
}

export function quoteCommand(command: readonly string[]): string {
    return command.map((argument) => quoteArgument(argument)).join(' ');
}
