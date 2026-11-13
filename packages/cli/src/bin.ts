import { enableCompileCache } from 'node:module';

import { FATAL_ERROR_EVENTS, JSON_FLAG, PROCESS_ARGUMENTS_START, VERBOSE_FLAG } from '#cli/config/main.ts';
import { EXIT_ERROR } from '#cli/config/system.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { validateRuntimeVersion } from '#cli/system/package/runtime.ts';
import { printError, printUnexpectedError, setOutputOptions } from '#cli/system/terminal.ts';

enableCompileCache();

const commandArguments = process.argv.slice(PROCESS_ARGUMENTS_START);
const separator = commandArguments.indexOf('--');
const options = separator === -1 ? commandArguments : commandArguments.slice(0, separator);
setOutputOptions({ isJson: options.includes(JSON_FLAG), isVerbose: options.includes(VERBOSE_FLAG) });

for (const event of FATAL_ERROR_EVENTS)
    process.once(event, (error: unknown) => {
        // A reader that closes the pipe early, such as `head`, wants no more output and no error report.
        if (!hasErrorCode(error, 'EPIPE')) printUnexpectedError(error);
        // eslint-disable-next-line n/no-process-exit -- reason: Fatal handlers must stop active work after an uncaught failure.
        process.exit(EXIT_ERROR);
    });

const runtimeError = validateRuntimeVersion(process.versions);
if (runtimeError === undefined) {
    const { runProgram } = await import('#cli/main.ts');
    process.exitCode = await runProgram(commandArguments, process.cwd());
} else {
    printError({ error: 'runtime', message: runtimeError });
    process.exitCode = EXIT_ERROR;
}
