// The documented object per command, printed under --json.

/** Prints one object as JSON on stdout. */
export function printJson(value: unknown): void {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
