import { GspotError } from '#cli/platform/errors.ts';
import { fail, print } from '#cli/output/messages.ts';
import { OUTPUT_JSON_INDENT } from '#cli/config/output.ts';
import { KNOWN_ERRORS } from '#cli/config/commands/commands.ts';
import type { CommandResult, CommandFailureJson } from '#cli/types/commands/commands.ts';

function printResult(result: CommandResult, isJson: boolean): void {
    if (isJson) process.stdout.write(`${JSON.stringify(result.json, null, OUTPUT_JSON_INDENT)}\n`);
    else if (result.text !== '') print(result.text);
    process.exitCode = result.exitCode;
}

function printError(error: GspotError, isJson: boolean): void {
    if (isJson)
        process.stdout.write(
            `${JSON.stringify({ error: error.code, message: error.message } satisfies CommandFailureJson, null, OUTPUT_JSON_INDENT)}\n`,
        );
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
        if (error instanceof GspotError && KNOWN_ERRORS.has(error.code)) printError(error, isJson);
        else throw error;
    }
}
