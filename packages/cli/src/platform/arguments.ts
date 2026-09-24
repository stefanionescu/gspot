/**
 * Quote one argument for a POSIX shell command shown to the reader.
 * @param value
 */
export function quoteArgument(value: string): string {
    if (/^[a-zA-Z0-9_./-]+$/u.test(value)) return value;
    return `'${value.replaceAll("'", "'\"'\"'")}'`;
}
