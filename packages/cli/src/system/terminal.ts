import { stripVTControlCharacters, styleText } from 'node:util';

import cliPackage from '#cli-package' with { type: 'json' };
import {
    EXIT_ERROR,
    RESULT_JSON_INDENT,
    SIGNAL_EXIT_CODES,
    TERMINAL_COLOR_SEQUENCE,
    TERMINAL_CONTROL_CHARACTERS,
} from '#cli/config/system.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import type {
    CanceledCommandJson,
    CommandFailureJson,
    CommandJson,
    CommandResult,
    OutputOptions,
    OutputState,
} from '#cli/types/system.ts';

const PROGRESS_CLEAR = '\r\u{1B}[2K';

const options: OutputState = { isJson: false, notes: [] };

/**
Write text as a line, without terminal escape sequences, control characters except tabs and line feeds, and format
characters such as bidirectional overrides. Keep the color codes of the gspot palette. Repository text then cannot
control terminal output.
*/
function writePrintableLine(stream: NodeJS.WriteStream, text: string): void {
    const printable = text
        .split(TERMINAL_COLOR_SEQUENCE)
        .map((segment) =>
            TERMINAL_COLOR_SEQUENCE.test(segment)
                ? segment
                : stripVTControlCharacters(segment).replaceAll(TERMINAL_CONTROL_CHARACTERS, ''),
        )
        .join('');
    stream.write(printable.endsWith('\n') ? printable : `${printable}\n`);
}

export function setOutputOptions(next: OutputOptions): void {
    Object.assign(options, next, { notes: [] });
}

export function printError(failure: string | CommandFailureJson): void {
    if (typeof failure !== 'string' && options.isJson) {
        const fields: CommandJson = { version: cliPackage.version, exitCode: EXIT_ERROR, notes: options.notes };
        process.stdout.write(`${JSON.stringify({ ...fields, ...failure }, null, RESULT_JSON_INDENT)}\n`);
        return;
    }
    writePrintableLine(
        process.stderr,
        typeof failure === 'string'
            ? failure
            : [failure.message, failure.stack].filter((line) => line !== undefined).join('\n'),
    );
}

export function formatUnexpectedError(subject: string): string {
    const location = subject === 'gspot' ? '' : ' in gspot';
    const page = cliPackage.bugs.url;
    return `${subject} stopped because of an internal error${location}. Report it at ${page}, with the stack that --verbose prints.`;
}

export function printUnexpectedError(error: unknown, isVerbose: boolean): void {
    const stackText = error instanceof Error ? (error.stack ?? error.message) : String(error);
    const message = formatUnexpectedError('gspot');
    printError({ error: 'unexpected', message, ...(isVerbose && { stack: stackText }) });
}

export function printResult(result: CommandResult<object>): void {
    const fields: CommandJson = { version: cliPackage.version, exitCode: result.exitCode, notes: options.notes };
    if (options.isJson) {
        const notes = result.json.notes ?? [];
        process.stdout.write(
            `${JSON.stringify({ ...fields, ...result.json, notes: [...fields.notes, ...notes] }, null, RESULT_JSON_INDENT)}\n`,
        );
    } else if (result.text !== '') print(result.text);
}

export function printWarning(text: string): void {
    if (options.isJson) options.notes.push(text);
    else printError(`${styleText('yellow', '[warn]', { stream: process.stderr })} ${text}`);
}

export function writeProgress(text: string): void {
    if (options.isJson) return;
    process.stderr.write(text);
}

/**
Replace the progress line in place on a terminal that is not dumb, while NO_COLOR has no value. A dumb terminal and a
reader that asks for no control sequences show the raw sequence, so they get nothing.
*/
export function rewriteProgress(text: string): boolean {
    const noColor = readEnvironmentVariable('NO_COLOR') ?? '';
    if (noColor !== '' || !process.stderr.isTTY || readEnvironmentVariable('TERM') === 'dumb') return false;
    writeProgress(`${PROGRESS_CLEAR}${text}`);
    return true;
}

export function print(text: string): void {
    if (options.isJson) return;
    writePrintableLine(process.stdout, text);
}

export async function runCancelableCommand<Json extends object>(
    runCommand: (cancelSignal: AbortSignal) => Promise<CommandResult<Json>>,
    canceledMessage: string,
): Promise<CommandResult<Json | CanceledCommandJson>> {
    const controller = new AbortController();
    const cancellations = Object.entries(SIGNAL_EXIT_CODES).map(([signal, code]) => ({
        signal,
        onSignal: (): void => {
            controller.abort(code);
        },
    }));
    for (const { signal, onSignal } of cancellations) process.on(signal, onSignal);
    try {
        const result = await runCommand(controller.signal);
        if (!controller.signal.aborted) return result;
        const exitCode = Number(controller.signal.reason);
        return { ...result, exitCode, json: { ...result.json, exitCode } };
    } catch (error) {
        if (!controller.signal.aborted) throw error;
        return {
            text: `${canceledMessage}\n`,
            json: { error: 'canceled', message: canceledMessage },
            exitCode: Number(controller.signal.reason),
        };
    } finally {
        for (const { signal, onSignal } of cancellations) process.removeListener(signal, onSignal);
    }
}

/**
Drop what this process writes to stdout and stderr, so that code gspot does not own prints nothing.
*/
export function muteOutput(): Disposable {
    const streams = [process.stdout, process.stderr];
    const writers = streams.map((stream) => stream.write.bind(stream));
    for (const stream of streams) stream.write = () => true;
    return {
        [Symbol.dispose]: () => {
            for (const [index, stream] of streams.entries()) stream.write = writers[index] as typeof stream.write;
        },
    };
}
