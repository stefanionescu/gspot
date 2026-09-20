// Messages about the run on stderr, with levels for --quiet and --verbose.
import pc from 'picocolors';
import { createConsola } from 'consola';
import type { ConsolaInstance } from 'consola';
import type { OutputOptions, Painter } from '#types/output.ts';
import { isCi, isColorRefused } from '#cli/platform/environment.ts';

const LEVELS: Record<OutputOptions['verbosity'], number> = { quiet: 1, normal: 3, verbose: 4 };

const state: { options: OutputOptions; instance: ConsolaInstance | undefined } = {
    options: { verbosity: 'normal', json: false, color: false },
    instance: undefined,
};

function same(text: string): string {
    return text;
}

function consola(): ConsolaInstance {
    state.instance ??= createConsola({
        level: LEVELS.normal,
        formatOptions: { colors: false, date: false, compact: true },
    });
    return state.instance;
}

/**
 * True when color is allowed: a terminal, no NO_COLOR, no CI, no --no-color.
 * @param isNoColor whether --no-color was given
 * @returns whether to paint
 */
export function isColorAllowed(isNoColor: boolean): boolean {
    if (isNoColor || isColorRefused() || isCi()) return false;
    return process.stderr.isTTY && process.stdout.isTTY;
}

/**
 * Sets the output mode for the process.
 * @param next verbosity, JSON and color
 */
export function configureOutput(next: OutputOptions): void {
    state.options = next;
    state.instance = createConsola({
        level: LEVELS[next.verbosity],
        formatOptions: { colors: next.color, date: false, compact: true },
    });
}

/**
 * The color functions, or identity when color is off.
 * @returns the painter
 */
export function paint(): Painter {
    const isOn = state.options.color;
    return {
        red: isOn ? pc.red : same,
        green: isOn ? pc.green : same,
        yellow: isOn ? pc.yellow : same,
        dim: isOn ? pc.dim : same,
        bold: isOn ? pc.bold : same,
        cyan: isOn ? pc.cyan : same,
    };
}

/**
 * A line about the run: hints, warnings, progress. Goes to stderr.
 * @param text the line
 */
export function note(text: string): void {
    if (state.options.json) return;
    consola().info(text);
}

/**
 * A warning about the run.
 * @param text the line
 */
export function warn(text: string): void {
    if (state.options.json) return;
    consola().warn(text);
}

/**
 * An error message on stderr. Always printed.
 * @param text the message
 */
export function fail(text: string): void {
    process.stderr.write(text.endsWith('\n') ? text : `${text}\n`);
}

/**
 * Reports an operational storage failure without changing the established check verdict.
 * @param path the output that was not saved
 * @param error the filesystem error
 */
export function reportStorageFailure(path: string, error: unknown): void {
    if (!(error instanceof Error && 'code' in error)) throw error;
    const detail = error.message.replaceAll(/[\r\n]+/gu, ' ');
    fail(`Could not write ${JSON.stringify(path)}: ${detail}`);
}

/**
 * Output that is the command's record: stdout.
 * @param text the text
 */
export function print(text: string): void {
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
}
