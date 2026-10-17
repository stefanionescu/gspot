// Prints command results, errors, and warnings as text or JSON, and stops a command on a signal.
import pc from 'picocolors';
import { GspotError } from '#cli/system/errors.ts';
import { PROGRAM_HELP } from '#cli/config/commands/help.ts';
import { CommanderError } from '@commander-js/extra-typings';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import type { CommandResult, OutputOptions, CommandFailureJson, CanceledCommandJson } from '#cli/types/terminal.ts';

import {
    EXIT_ERROR,
    ROOT_SCOPE_LABEL,
    SIGNAL_EXIT_CODES,
    COMMAND_SUGGESTION,
    RESULT_JSON_INDENT,
    UNKNOWN_COMMAND_NAME,
    COMMANDER_ERROR_PREFIX,
} from '#cli/config/terminal.ts';

let options: OutputOptions = { json: false, color: false };

// Both result and failure records use the same JSON serialization and stream.
function printJson(record: unknown): void {
    process.stdout.write(`${JSON.stringify(record, null, RESULT_JSON_INDENT)}\n`);
}

/**
 * Read the palette for the configured command output.
 * @returns the enabled or disabled color functions.
 */
function getColors(): ReturnType<typeof pc.createColors> {
    return pc.createColors(options.color);
}

/**
 * Check whether both streams go to terminals and NO_COLOR leaves color on.
 * @returns whether to use color.
 */
function isColorAllowed(): boolean {
    const noColor = readEnvironmentVariable('NO_COLOR');
    if (noColor !== undefined && noColor !== '') return false;
    return process.stderr.isTTY && process.stdout.isTTY;
}

/**
 * Set the output mode for the process.
 * @param next the JSON and color choices.
 */
function setOutputOptions(next: OutputOptions): void {
    options = next;
}

/**
 * Print a warning about the run to stderr.
 * @param text the warning to print.
 */
function warn(text: string): void {
    process.stderr.write(`${getColors().yellow('[warn]')} ${text}\n`);
}

/**
 * Print an error message to stderr, or a structured failure to stdout under --json.
 * @param failure the message, or the structured error.
 */
function printError(failure: string | CommandFailureJson): void {
    if (typeof failure !== 'string' && options.json) {
        printJson(failure);
        return;
    }
    const text = typeof failure === 'string' ? failure : failure.message;
    process.stderr.write(text.endsWith('\n') ? text : `${text}\n`);
}

/**
 * Print the command result in the chosen format.
 * @param result the command output.
 */
function printResult(result: CommandResult): void {
    if (options.json) printJson(result.json);
    else if (result.text !== '') print(result.text);
}

/**
 * Print readable text on stdout, unless --json asks for structured output.
 * @param text the output, which gets a final newline if it lacks one.
 */
function print(text: string): void {
    if (options.json) return;
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
}

/**
 * Format the command notes in order, each with its line prefix.
 * @param notes the messages of the command result.
 * @returns the note lines, or empty text without notes.
 */
function formatNotes(notes: string[]): string {
    return notes.map((note) => `note     ${note}\n`).join('');
}

/**
 * Format Commander argument errors with the command suggestions.
 * @param error the refused command arguments.
 * @returns the message and any available correction.
 */
function formatArgumentError(error: CommanderError): string {
    const { message } = error;
    // With no command, Commander raises a help error after writing the help to the silent error stream.
    if (error.code === 'commander.help') return PROGRAM_HELP;
    if (error.code === 'commander.unknownCommand') {
        const [, name] = UNKNOWN_COMMAND_NAME.exec(message) as RegExpExecArray & { 1: string };
        const suggestion = COMMAND_SUGGESTION.exec(message)?.[1];
        const correction = suggestion === undefined ? '' : ` Did you mean ${suggestion}?`;
        return `Unknown command ${name}.${correction} Run gspot --help to see the commands.`;
    }
    if (error.code === 'commander.missingMandatoryOptionValue' && message.includes('--reason'))
        return 'gspot ignore needs --reason "<why>".';
    const text = message.slice(COMMANDER_ERROR_PREFIX.length);
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/**
 * Print a command failure, and choose the exit status.
 * @param error what the command threw.
 * @param output whether to print JSON.
 * @returns zero for Commander help, or the command error status.
 */
function printFailure(error: unknown, output: Pick<OutputOptions, 'json'>): number {
    if (error instanceof CommanderError) {
        if (error.exitCode === 0) return 0;
        printError({ error: 'arguments', message: formatArgumentError(error) });
        return EXIT_ERROR;
    }
    if (error instanceof GspotError) {
        printError({ error: error.code, message: error.message });
        return EXIT_ERROR;
    }
    const detail = (error instanceof Error ? error.message : String(error)).replaceAll(/\s+/gu, ' ').trim();
    const message = `gspot stopped because of an internal error: ${detail}. Report it at https://github.com/stefanionescu/gspot/issues with the command you ran.`;
    printError(output.json ? { error: 'failure', message } : message);
    return EXIT_ERROR;
}

/**
 * Name the root scope, or return the path of a child scope, for command output.
 * @param path the repository-relative scope.
 * @returns the root label or the child path.
 */
function formatScopeLabel(path: string): string {
    return path === '' ? ROOT_SCOPE_LABEL : path;
}

/**
 * Run a command that termination signals can stop, and remove each listener when it finishes.
 * @param run the command, which gets the shared abort signal.
 * @param canceledMessage the message when a cancellation stops the command before it has a result.
 * @returns the command result, with the signal status after an interruption.
 */
async function runCancelableCommand<Json extends object>(
    run: (signal: AbortSignal) => Promise<CommandResult<Json>>,
    canceledMessage: string,
): Promise<CommandResult<Json | CanceledCommandJson>> {
    const controller = new AbortController();
    let canceledCode: number | undefined;
    const cancellations = Object.entries(SIGNAL_EXIT_CODES).map(([signal, code]) => {
        const onSignal = (): void => {
            canceledCode = code;
            controller.abort();
        };
        process.on(signal, onSignal);
        return { signal, onSignal };
    });
    let result: CommandResult<Json | CanceledCommandJson>;
    try {
        result = await run(controller.signal);
    } catch (error) {
        if (!controller.signal.aborted) throw error;
        result = {
            text: `${canceledMessage}\n`,
            json: { error: 'canceled', message: canceledMessage, exitCode: EXIT_ERROR },
            exitCode: EXIT_ERROR,
        };
    } finally {
        for (const { signal, onSignal } of cancellations) process.removeListener(signal, onSignal);
    }
    if (canceledCode === undefined) return result;
    return { ...result, exitCode: canceledCode, json: { ...result.json, exitCode: canceledCode } };
}

export {
    warn,
    print,
    getColors,
    printResult,
    formatNotes,
    printFailure,
    isColorAllowed,
    formatScopeLabel,
    setOutputOptions,
    runCancelableCommand,
};
