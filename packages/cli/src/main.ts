import { main } from '#cli/commands/program.ts';
import { PROCESS_ARGUMENTS_START } from '#cli/config/system/processes.ts';

process.exitCode = await main(process.argv.slice(PROCESS_ARGUMENTS_START));
