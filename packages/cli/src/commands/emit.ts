// What every command does with its result: print text or JSON, set the exit code, turn errors into exit 2.
import { fail, print } from '#cli/output/messages.ts';
import { printJson } from '#cli/output/json.ts';

type Result = { text: string; json: unknown; exitCode: number };

/** Runs a command function and prints its result. Errors gspot raises print their message and exit 2. */
export async function emit(command: () => Promise<Result>, global: Record<string, unknown>): Promise<void> {
    try {
        const result = await command();
        if (global['json']) printJson(result.json);
        else if (result.text !== '') print(result.text);
        process.exitCode = result.exitCode;
    } catch (error) {
        const known =
            error instanceof Error &&
            ['PolicyError', 'SelectionError', 'ManifestError', 'VersionPinError', 'NoTerminalError'].includes(
                error.name,
            );
        if (known) {
            if (global['json']) printJson({ error: error.name, message: (error as Error).message });
            else fail((error as Error).message);
            process.exitCode = 2;
            return;
        }
        throw error;
    }
}
