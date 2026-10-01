// Messages about the run on stderr, with levels for --quiet and --verbose.
import pc from 'picocolors';
import type { OutputOptions } from '#cli/types/output.ts';
import { isCi, environmentVariables } from '#cli/platform/environment.ts';

const state: { options: OutputOptions } = { options: { verbosity: 'normal', json: false, color: false } };

export const colors = pc.createColors(false);

/**
 * True when color is allowed: a terminal, no NO_COLOR, no CI, no --no-color.
 * @param isNoColor whether --no-color was given
 * @returns whether to paint
 */
export function isColorAllowed(isNoColor: boolean): boolean {
    const noColor = environmentVariables()['NO_COLOR'];
    if (isNoColor || (noColor !== undefined && noColor !== '') || isCi()) return false;
    return process.stderr.isTTY && process.stdout.isTTY;
}

/**
 * Sets the output mode for the process.
 * @param next verbosity, JSON, and color
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The mode and the palette change together, once per process; the state object owns both.
export function configureOutput(next: OutputOptions): void {
    state.options = next;
    Object.assign(colors, pc.createColors(next.color));
}

/**
 * A line about the run: hints, warnings, progress. Goes to stderr, and stays quiet under --quiet.
 * @param text the line
 */
export function note(text: string): void {
    if (state.options.json || state.options.verbosity === 'quiet') return;
    process.stderr.write(`${colors.cyan('[info]')} ${text}\n`);
}

/**
 * A warning about the run. Goes to stderr at every verbosity.
 * @param text the line
 */
export function warn(text: string): void {
    if (state.options.json) return;
    process.stderr.write(`${colors.yellow('[warn]')} ${text}\n`);
}

/**
 * An error message on stderr. Always printed.
 * @param text the message
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every error line goes to stderr with one final newline through this.
export function fail(text: string): void {
    process.stderr.write(text.endsWith('\n') ? text : `${text}\n`);
}

/**
 * Output that is the command's record: stdout.
 * @param text the text
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every record line goes to stdout with one final newline through this.
export function print(text: string): void {
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
}
