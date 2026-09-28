import { main } from '#cli/commands/program.ts';
import { ARGUMENT_START } from '#cli/config/platform.ts';

process.exitCode = await main(process.argv.slice(ARGUMENT_START));
