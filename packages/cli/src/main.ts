import { main } from '#cli/commands/program.ts';
import { PROGRAM_ARGUMENT_OFFSET } from '#cli/config/platform/runtime.ts';

process.exitCode = await main(process.argv.slice(PROGRAM_ARGUMENT_OFFSET));
