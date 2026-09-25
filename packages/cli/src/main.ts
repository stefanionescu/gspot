import { main } from '#cli/commands/program.ts';

process.exitCode = await main(process.argv.slice(2));
