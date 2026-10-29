import { JSON_FLAG } from '#cli/config/main.ts';
import { EXIT_ERROR } from '#cli/config/terminal.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { PROCESS_ARGUMENTS_START } from '#cli/config/bin.ts';
import { validateRuntimeVersion } from '#cli/system/runtime.ts';

const runtimeError = validateRuntimeVersion(process.versions, cliPackage.engines);
if (runtimeError === undefined) {
    const { runProgram } = await import('#cli/main.ts');
    process.exitCode = await runProgram(process.argv.slice(PROCESS_ARGUMENTS_START));
} else {
    const commandArguments = process.argv.slice(PROCESS_ARGUMENTS_START);
    const separator = commandArguments.indexOf('--');
    const options = separator === -1 ? commandArguments : commandArguments.slice(0, separator);
    if (options.includes(JSON_FLAG))
        process.stdout.write(`${JSON.stringify({ error: 'runtime', message: runtimeError })}\n`);
    else process.stderr.write(`${runtimeError}\n`);
    process.exitCode = EXIT_ERROR;
}
