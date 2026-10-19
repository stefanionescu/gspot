// Start gspot. The CLI modules use new runtime APIs as they load, so an old Node.js or Bun gets the version floor first.
import { EXIT_ERROR } from '#cli/config/terminal.ts';
import { findRuntimeError } from '#cli/system/runtime.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { PROCESS_ARGUMENTS_START } from '#cli/config/system/processes.ts';

const runtimeError = findRuntimeError(process.versions, packageManifest.engines);
if (runtimeError === undefined) {
    const { runProgram } = await import('#cli/main.ts');
    process.exitCode = await runProgram(process.argv.slice(PROCESS_ARGUMENTS_START));
} else {
    process.stderr.write(`${runtimeError}\n`);
    process.exitCode = EXIT_ERROR;
}
