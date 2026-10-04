import { main } from '#cli/commands/program.ts';
import { PAIR } from '#cli/config/platform/runtime.ts';

process.exitCode = await main(process.argv.slice(PAIR));
