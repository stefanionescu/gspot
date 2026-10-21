// Start gspot. The CLI modules use new runtime APIs as they load, so an old Node.js or Bun gets the version floor first.
import { EXIT_ERROR } from '#cli/config/terminal.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { validateRuntimeVersion } from '#cli/system/runtime.ts';
import { PROCESS_ARGUMENTS_START } from '#cli/config/commands/program.ts';

const runtimeError = validateRuntimeVersion(process.versions, cliPackage.engines);
if (runtimeError === undefined) {
    const { runProgram } = await import('#cli/main.ts');
    process.exitCode = await runProgram(process.argv.slice(PROCESS_ARGUMENTS_START));
} else {
    process.stderr.write(`${runtimeError}\n`);
    process.exitCode = EXIT_ERROR;
}
