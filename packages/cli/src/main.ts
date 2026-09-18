// The entry: runs the program and sets the exit code.
import { main } from '#cli/program.ts';

process.exitCode = await main(process.argv.slice(2));
