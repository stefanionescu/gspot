import pc from 'picocolors';
import { stripVTControlCharacters } from 'node:util';
import { SIGNAL_EXIT_CODES, RESULT_JSON_INDENT, TERMINAL_CONTROL_CHARACTERS } from '#cli/config/system/terminal.ts';
import type { CommandResult, OutputOptions, CommandFailureJson, CanceledCommandJson } from '#cli/types/terminal.ts';

let options: OutputOptions = { isJson: false, colored: false };

/**
Read the palette for the configured command output.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 13 calls in 5 files share it.
export function getColors(): ReturnType<typeof pc.createColors> {
    return pc.createColors(options.colored);
}

/**
Set the output mode for the process.

@param next the JSON and color choices.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 4 calls in 2 files share it.
export function setOutputOptions(next: OutputOptions): void {
    options = next;
}

/**
Print an error message to stderr without terminal control bytes, or a structured failure to stdout under --json.

@param failure the message, or the structured error.
*/
export function printError(failure: string | CommandFailureJson): void {
    if (typeof failure !== 'string' && options.isJson) {
        process.stdout.write(`${JSON.stringify(failure, null, RESULT_JSON_INDENT)}\n`);
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
    if (options.isJson) process.stdout.write(`${JSON.stringify(result.json, null, RESULT_JSON_INDENT)}\n`);
    else if (result.text !== '') print(result.text);
}

/**
Print readable text on stdout, unless --json asks for structured output.

@param text the output, which gets a final newline if it lacks one.
*/
export function print(text: string): void {
    if (options.isJson) return;
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
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
            json: { error: 'canceled', message: canceledMessage, exitCode: Number(controller.signal.reason) },
            exitCode: Number(controller.signal.reason),
        };
    } finally {
        for (const { signal, onSignal } of cancellations) process.removeListener(signal, onSignal);
    }
    return result;
}

/**
Remove terminal escape sequences and control characters except tabs and line feeds. Repository text then cannot control terminal output.

@param text the text to print.
@returns the text without them.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Terminal writers share the same control-character removal.
export function stripControlCharacters(text: string): string {
    const uncolored = stripVTControlCharacters(text);
    return uncolored.replaceAll(TERMINAL_CONTROL_CHARACTERS, '');
}
