import { fail, print, printJson } from '#cli/output/messages.ts';

const KNOWN_ERRORS = new Set([
    'PolicyError',
    'SelectionError',
    'ManifestError',
    'VersionPinError',
    'NoTerminalError',
    'PromptError',
    'ProfileError',
]);

function printResult(result: CommandResult, isJson: boolean): void {
    if (isJson) printJson(result.json);
    else if (result.text !== '') print(result.text);
    process.exitCode = result.exitCode;
}

function printError(error: Error, isJson: boolean): void {
    if (isJson) printJson({ error: error.name, message: error.message } satisfies CommandFailureJson);
    else fail(error.message);
    process.exitCode = 2;
}

/**
 * Runs a command function and prints its result. Errors gspot raises print their message and exit 2.
 * @param command the command function
 * @param global the global flags
 */
export async function printCommand(
    command: () => Promise<CommandResult>,
    global: Record<string, unknown>,
): Promise<void> {
    const isJson = global['json'] === true;
    try {
        printResult(await command(), isJson);
    } catch (error) {
        if (error instanceof Error && KNOWN_ERRORS.has(error.name)) printError(error, isJson);
        else throw error;
    }
}

export type CommandResult = { text: string; json: unknown; exitCode: number };

/** The JSON a failed command prints: the error's name and message. */
export type CommandFailureJson = { error: string; message: string };
