import pc from 'picocolors';
import { isCI } from 'std-env';
import { RESULT_JSON_INDENT } from '#cli/config/terminal.ts';
import { environmentVariables } from '#cli/platform/public.ts';
import type { CommandResult, OutputOptions, VerbosityFlags, CommandFailureJson } from '#cli/types/terminal.ts';

let options: OutputOptions = { verbosity: 'normal', json: false, color: false };

// Both result and failure records use the same JSON serialization and stream.
function printJson(record: unknown): void {
    process.stdout.write(`${JSON.stringify(record, null, RESULT_JSON_INDENT)}\n`);
}

export const colors = pc.createColors(false);

/**
 * True when color is allowed: a terminal, no NO_COLOR, no CI, no --no-color.
 * @param color whether the command permits color
 * @returns whether to paint
 */
export function isColorAllowed(color: boolean): boolean {
    const noColor = environmentVariables()['NO_COLOR'];
    if (!color || (noColor !== undefined && noColor !== '') || isCI) return false;
    return process.stderr.isTTY && process.stdout.isTTY;
}

/**
 * Select output detail from raw flags, with quiet taking precedence.
 * @param flags the authored quiet and verbose flags
 * @returns the output detail for messages, reports, and progress
 */
export function selectVerbosity(flags: VerbosityFlags): OutputOptions['verbosity'] {
    if (flags.quiet === true) return 'quiet';
    return flags.verbose === true ? 'verbose' : 'normal';
}

/**
 * Sets the output mode for the process.
 * @param next output detail, JSON format, and terminal color
 */
export function configureOutput(next: OutputOptions): void {
    options = next;
    Object.assign(colors, pc.createColors(next.color));
}

/**
 * An informational line on stderr, suppressed by --quiet and --json.
 * @param text the line
 */
export function note(text: string): void {
    if (options.json || options.verbosity === 'quiet') return;
    process.stderr.write(`${colors.cyan('[info]')} ${text}\n`);
}

/**
 * A warning about the run. Goes to stderr at every verbosity.
 * @param text the line
 */
export function warn(text: string): void {
    if (options.json) return;
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
 * Emit command notes in their existing order, each with its native line prefix.
 * @param notes the messages attached to the prepared command result
 * @returns the note lines, or no text when there are none
 */
export function noteLines(notes: string[]): string {
    return notes.map((note) => `note     ${note}\n`).join('');
}
