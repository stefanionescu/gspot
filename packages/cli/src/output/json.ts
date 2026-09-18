// The documented object per command, printed under --json.

const JSON_INDENT = 2;

/**
 * Prints one object as JSON on stdout.
 * @param value the documented object of the command
 */
export function printJson(value: unknown): void {
    process.stdout.write(`${JSON.stringify(value, null, JSON_INDENT)}\n`);
}
