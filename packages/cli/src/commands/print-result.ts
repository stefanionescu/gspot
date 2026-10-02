import { resolve } from 'node:path';
import { GspotError } from '#cli/platform/errors.ts';
import { fail, print } from '#cli/output/messages.ts';
import { KNOWN_ERRORS } from '#cli/config/commands/commands.ts';
import { OUTPUT_JSON_INDENT } from '#cli/config/lifecycle/ownership.ts';
import type { GlobalFlags, CommandResult, CommandFailureJson } from '#cli/types/commands/commands.ts';

function printResult(result: CommandResult, isJson: boolean): void {
    if (isJson) process.stdout.write(`${JSON.stringify(result.json, null, OUTPUT_JSON_INDENT)}\n`);
    else if (result.text !== '') print(result.text);
    process.exitCode = result.exitCode;
}

function printError(failure: CommandFailureJson, isJson: boolean): void {
    if (isJson) process.stdout.write(`${JSON.stringify(failure, null, OUTPUT_JSON_INDENT)}\n`);
    else fail(failure.message);
    process.exitCode = 2;
}

// The failure to print: a known error, or under --json any error, so a caller always has one object to parse.
function failureOf(error: unknown, isJson: boolean): CommandFailureJson | undefined {
    if (error instanceof GspotError && (isJson || KNOWN_ERRORS.has(error.code)))
        return { error: error.code, message: error.message };
    if (!isJson) return undefined;
    return { error: 'failure', message: error instanceof Error ? error.message : String(error) };
}

/**
 * Runs a command function in the directory the global -C flag names, or the working directory, and prints its
 * result. Errors gspot raises print their message and exit 2, and under --json so does every other error.
 * @param command the command function, given the directory
 * @param global the global flags
 */
export async function printCommand(
    command: (cwd: string) => Promise<CommandResult>,
    global: GlobalFlags,
): Promise<void> {
    const isJson = global.json === true;
    try {
        printResult(await command(resolve(global.C ?? process.cwd())), isJson);
    } catch (error) {
        const failure = failureOf(error, isJson);
        if (failure === undefined) throw error;
        printError(failure, isJson);
    }
}
