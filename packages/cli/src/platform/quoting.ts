// Shell quoting for the commands gspot prints.
/**
 * Quote one argument for a POSIX shell command shown to the reader.
 * @param value the argument
 * @returns the argument, quoted when it needs to be
 */
export function quoteArgument(value: string): string {
    if (/^[a-zA-Z0-9_./-]+$/u.test(value)) return value;
    return `'${value.replaceAll("'", "'\"'\"'")}'`;
}
