import pc from 'picocolors';
import { EXIT_ERROR } from '#cli/config/terminal.ts';
import { stripVTControlCharacters } from 'node:util';
import cliPackage from '#cli-package' with { type: 'json' };

import type {
    CommandJson,
    CommandResult,
    OutputOptions,
    CommandFailureJson,
    CanceledCommandJson,
} from '#cli/types/terminal.ts';
import {
    SIGNAL_EXIT_CODES,
    RESULT_JSON_INDENT,
    TERMINAL_COLOR_SEQUENCE,
    TERMINAL_CONTROL_CHARACTERS,
} from '#cli/config/system/system.ts';

let options: OutputOptions = { isJson: false, colored: false };

/**
Read the palette for the configured command output.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Output options stay private to this module.
export function getColors(): ReturnType<typeof pc.createColors> {
    return pc.createColors(options.colored);
}

/**
Set the output mode for the process.

@param next the JSON and color choices.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Output options stay private to this module.
export function setOutputOptions(next: OutputOptions): void {
    options = next;
}

/**
Print an error message to stderr without terminal control bytes, or a structured failure to stdout under --json.

@param failure the message, or the structured error.
*/
export function printError(failure: string | CommandFailureJson): void {
    if (typeof failure !== 'string' && options.isJson) {
        const fields: CommandJson = { version: cliPackage.version, exitCode: EXIT_ERROR, notes: [] };
        process.stdout.write(`${JSON.stringify({ ...fields, ...failure }, null, RESULT_JSON_INDENT)}\n`);
        return;
    }
    const text = stripControlCharacters(typeof failure === 'string' ? failure : failure.message);
    process.stderr.write(text.endsWith('\n') ? text : `${text}\n`);
}

/**
Print the command result in the chosen format.

@param result the command output.
*/
export function printResult(result: CommandResult): void {
    const fields: CommandJson = { version: cliPackage.version, exitCode: result.exitCode, notes: [] };
    if (options.isJson)
        process.stdout.write(`${JSON.stringify({ ...fields, ...result.json }, null, RESULT_JSON_INDENT)}\n`);
    else if (result.text !== '') print(result.text);
}

/**
Print readable text on stdout without terminal control bytes, unless --json asks for structured output.

@param text the output, which gets a final newline if it lacks one.
*/
export function print(text: string): void {
    if (options.isJson) return;
    const printable = stripControlCharacters(text);
    process.stdout.write(printable.endsWith('\n') ? printable : `${printable}\n`);
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
    let result: CommandResult<Json | CanceledCommandJson>;
    try {
        result = await runCommand(controller.signal);
    } catch (error) {
        if (!controller.signal.aborted) throw error;
        result = {
            text: `${canceledMessage}\n`,
            json: { error: 'canceled', message: canceledMessage },
            exitCode: Number(controller.signal.reason),
        };
    } finally {
        for (const { signal, onSignal } of cancellations) process.removeListener(signal, onSignal);
    }
    return result;
}

/**
Remove terminal escape sequences, control characters except tabs and line feeds, and format characters such as
bidirectional overrides. Keep the color codes of the gspot palette. Repository text then cannot control terminal output.

@param text the text to print.
@returns the text without them.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Terminal writers share the same control-character removal.
export function stripControlCharacters(text: string): string {
    return text
        .split(TERMINAL_COLOR_SEQUENCE)
        .map((segment) =>
            TERMINAL_COLOR_SEQUENCE.test(segment)
                ? segment
                : stripVTControlCharacters(segment).replaceAll(TERMINAL_CONTROL_CHARACTERS, ''),
        )
        .join('');
}
