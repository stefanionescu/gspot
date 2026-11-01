import { EXIT_ERROR } from '#cli/config/terminal.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { validateRuntimeVersion } from '#cli/system/runtime.ts';
import { setOutputOptions, printUnexpectedError } from '#cli/system/terminal.ts';
import { JSON_FLAG, FATAL_ERROR_EVENTS, PROCESS_ARGUMENTS_START } from '#cli/config/main.ts';

const commandArguments = process.argv.slice(PROCESS_ARGUMENTS_START);
const separator = commandArguments.indexOf('--');
const options = separator === -1 ? commandArguments : commandArguments.slice(0, separator);
setOutputOptions({ isJson: options.includes(JSON_FLAG) });

for (const event of FATAL_ERROR_EVENTS)
    process.once(event, (error: unknown) => {
        printUnexpectedError(error, options.includes('--verbose'));
        // eslint-disable-next-line n/no-process-exit -- reason: Fatal handlers must stop active work after an uncaught failure.
        process.exit(EXIT_ERROR);
    });

const runtimeError = validateRuntimeVersion(process.versions, cliPackage.engines);
if (runtimeError === undefined) {
    const { runProgram } = await import('#cli/main.ts');
    process.exitCode = await runProgram(commandArguments);
} else {
    if (options.includes(JSON_FLAG))
        process.stdout.write(
            `${JSON.stringify({ version: cliPackage.version, exitCode: EXIT_ERROR, notes: [], error: 'runtime', message: runtimeError })}\n`,
        );
    else process.stderr.write(`${runtimeError}\n`);
    process.exitCode = EXIT_ERROR;
}
