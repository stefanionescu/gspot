import { parseArgs } from 'node:util';
import { writeFileSync } from 'node:fs';
import { RUN_CLI_OPTIONS } from '#tests/config/setup/programs.ts';
import { splitProgramArguments } from '#tests/setup/system/programs.ts';

const { own, call } = splitProgramArguments();
const { values } = parseArgs({ args: own, options: RUN_CLI_OPTIONS });
const marker = values['signal-marker'];
if (marker !== undefined)
    process.on('newListener', (name) => {
        if (name === 'SIGTERM')
            setImmediate(() => {
                writeFileSync(marker, 'ready');
            });
    });
process.argv = [process.execPath, 'gspot', ...call];
const { runProgram } = await import('#cli/main.ts');
process.exitCode = await runProgram(call);
