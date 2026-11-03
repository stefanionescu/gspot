import cliPackage from '#cli-package' with { type: 'json' };
import { styleText, stripVTControlCharacters } from 'node:util';

import {
    EXIT_ERROR,
    SIGNAL_EXIT_CODES,
    RESULT_JSON_INDENT,
    TERMINAL_COLOR_SEQUENCE,
    TERMINAL_CONTROL_CHARACTERS,
} from '#cli/config/system.ts';
import type {
    CommandJson,
    OutputState,
    CommandResult,
    OutputOptions,
    CommandFailureJson,
    CanceledCommandJson,
} from '#cli/types/system.ts';

const options: OutputState = { isJson: false, notes: [] };

/**
Write text as a line, without terminal escape sequences, control characters except tabs and line feeds, and format
characters such as bidirectional overrides. Keep the color codes of the gspot palette. Repository text then cannot
control terminal output.

@param stream the terminal stream.
@param text the text to print, which gets a final newline if it lacks one.
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

/**
Set the output mode for the process.

@param next the JSON output choice.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Output options stay private to this module.
export function setOutputOptions(next: OutputOptions): void {
    Object.assign(options, next, { notes: [] });
}

/**
Print an error message to stderr without terminal control bytes, or a structured failure to stdout under --json.

@param failure the message, or the structured error.
*/
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

/**
Describe an unexpected failure without exposing its implementation details.

@param subject the command or check that stopped.
*/
export function formatUnexpectedError(subject: string): string {
    const location = subject === 'gspot' ? '' : ' in gspot';
    const page = cliPackage.bugs.url;
    return `${subject} stopped because of an internal error${location}. Report it at ${page}, with the stack that --verbose prints.`;
}

/**
Print an unexpected command failure, retaining its stack only for verbose output.

@param error the unexpected thrown value.
@param isVerbose whether to include its message and stack.
*/
export function printUnexpectedError(error: unknown, isVerbose: boolean): void {
    const stackText = error instanceof Error ? (error.stack ?? error.message) : String(error);
    const message = formatUnexpectedError('gspot');
    printError({ error: 'unexpected', message, ...(isVerbose && { stack: stackText }) });
}

/**
Print the command result in the chosen format.

@param result the command output.
*/
export function printResult(result: CommandResult<object>): void {
    const fields: CommandJson = { version: cliPackage.version, exitCode: result.exitCode, notes: options.notes };
    if (options.isJson) {
        const notes = result.json.notes ?? [];
        process.stdout.write(
            `${JSON.stringify({ ...fields, ...result.json, notes: [...fields.notes, ...notes] }, null, RESULT_JSON_INDENT)}\n`,
        );
    } else if (result.text !== '') print(result.text);
}

/**
Keep warnings in the JSON result, or print them without terminal controls on stderr.

@param text the warning without its label.
*/
export function printWarning(text: string): void {
    if (options.isJson) options.notes.push(text);
    else printError(`${styleText('yellow', '[warn]', { stream: process.stderr })} ${text}`);
}

/**
Write progress text to stderr, unless --json keeps the output to the result.

@param text the text, with the terminal controls it needs.
*/
export function writeProgress(text: string): void {
    if (options.isJson) return;
    process.stderr.write(text);
}

/**
Print readable text on stdout without terminal control bytes, unless --json asks for structured output.

@param text the output, which gets a final newline if it lacks one.
*/
export function print(text: string): void {
    if (options.isJson) return;
    writePrintableLine(process.stdout, text);
}

/**
Run a command that termination signals can stop, and remove each listener when it finishes.

@param runCommand the command, which gets the shared abort signal.
@param canceledMessage the message when a cancellation stops the command before it has a result.
@returns the command result, with the signal status after an interruption.
*/
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

@returns the handle that restores the output.
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
