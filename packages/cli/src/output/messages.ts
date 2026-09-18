// Messages about the run on stderr, with levels for --quiet and --verbose.
import { createConsola } from 'consola';
import type { ConsolaInstance } from 'consola';
import pc from 'picocolors';

export type Verbosity = 'quiet' | 'normal' | 'verbose';

export type OutputOptions = { verbosity: Verbosity; json: boolean; color: boolean };

let options: OutputOptions = { verbosity: 'normal', json: false, color: false };
let instance: ConsolaInstance | undefined;

/** True when color is allowed: a terminal, no NO_COLOR, no CI, no --no-color. */
export function colorAllowed(noColor: boolean): boolean {
    if (noColor) return false;
    if (process.env['NO_COLOR'] !== undefined && process.env['NO_COLOR'] !== '') return false;
    if (process.env['CI'] !== undefined && process.env['CI'] !== '') return false;
    return Boolean(process.stderr.isTTY) && Boolean(process.stdout.isTTY);
}

/** Sets the output mode for the process. */
export function configureOutput(next: OutputOptions): void {
    options = next;
    instance = createConsola({
        level: next.verbosity === 'quiet' ? 1 : next.verbosity === 'verbose' ? 4 : 3,
        formatOptions: { colors: next.color, date: false, compact: true },
    });
}

/** The current output options. */
export function outputOptions(): OutputOptions {
    return options;
}

/** The color functions, or identity when color is off. */
export function paint() {
    const on = options.color;
    const id = (text: string) => text;
    return {
        red: on ? pc.red : id,
        green: on ? pc.green : id,
        yellow: on ? pc.yellow : id,
        dim: on ? pc.dim : id,
        bold: on ? pc.bold : id,
        cyan: on ? pc.cyan : id,
    };
}

function consola(): ConsolaInstance {
    instance ??= createConsola({ level: 3, formatOptions: { colors: false, date: false, compact: true } });
    return instance;
}

/** A line about the run: hints, warnings, progress. Goes to stderr. */
export function note(text: string): void {
    if (options.json) return;
    consola().info(text);
}

/** A warning about the run. */
export function warn(text: string): void {
    if (options.json) return;
    consola().warn(text);
}

/** Verbose detail. */
export function detail(text: string): void {
    if (options.verbosity !== 'verbose' || options.json) return;
    consola().debug(text);
}

/** An error message on stderr. Always printed. */
export function fail(text: string): void {
    process.stderr.write(`${text.endsWith('\n') ? text : `${text}\n`}`);
}

/** Output that is the command's record: stdout. */
export function print(text: string): void {
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
}
