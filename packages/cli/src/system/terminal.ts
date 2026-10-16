// Prints command results and failures with the selected output options.
import pc from 'picocolors';
import { RESULT_JSON_INDENT } from '#cli/config/terminal.ts';
import { environmentVariable, environmentVariables } from '#cli/system/environment.ts';
import type { CommandResult, OutputOptions, CommandFailureJson } from '#cli/types/terminal.ts';

let options: OutputOptions = { json: false, color: false };

// Both result and failure records use the same JSON serialization and stream.
function printJson(record: unknown): void {
    process.stdout.write(`${JSON.stringify(record, null, RESULT_JSON_INDENT)}\n`);
}

export const colors = pc.createColors(false);

/**
 * True when both streams connect to terminals and NO_COLOR does not disable color.
 * @returns whether to paint
 */
export function isColorAllowed(): boolean {
    const noColor = environmentVariable(environmentVariables(), 'NO_COLOR');
    if (noColor !== undefined && noColor !== '') return false;
    return process.stderr.isTTY && process.stdout.isTTY;
}

/**
 * Sets the output mode for the process.
 * @param next JSON format and terminal color
 */
export function configureOutput(next: OutputOptions): void {
    options = next;
    Object.assign(colors, pc.createColors(next.color));
}

/**
 * A warning about the run, printed to stderr.
 * @param text the line
 */
export function warn(text: string): void {
    process.stderr.write(`${colors.yellow('[warn]')} ${text}\n`);
}

/**
 * Print a diagnostic to stderr, or a structured command failure to stdout under --json.
 * @param failure the diagnostic text or structured failure
 */
export function printError(failure: string | CommandFailureJson): void {
    if (typeof failure !== 'string' && options.json) {
        printJson(failure);
        return;
    }
    const text = typeof failure === 'string' ? failure : failure.message;
    process.stderr.write(text.endsWith('\n') ? text : `${text}\n`);
}

/**
 * Print the completed command in the selected format and retain its exit code.
 * @param result the command output
 */
export function printResult(result: CommandResult): void {
    if (options.json) printJson(result.json);
    else if (result.text !== '') print(result.text);
    process.exitCode = result.exitCode;
}

/**
 * A human-readable record on stdout, suppressed when --json selects structured output.
 * @param text the text
 */
export function print(text: string): void {
    if (options.json) return;
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
}

/**
 * Emit command notes in their existing order, each with its line prefix.
 * @param notes the messages attached to the prepared command result
 * @returns the note lines, or no text when the list contains no notes
 */
export function noteLines(notes: string[]): string {
    return notes.map((note) => `note     ${note}\n`).join('');
}
