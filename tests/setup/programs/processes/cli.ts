import { writeFileSync } from 'node:fs';
import { SIGNAL_MARKER_OPTION } from '#tests/config/setup/programs.ts';

const [option, marker, ...markedCall] = process.argv.slice(2);
const call = option === SIGNAL_MARKER_OPTION ? markedCall : process.argv.slice(2);
if (option === SIGNAL_MARKER_OPTION && marker !== undefined)
    process.stdin.on('newListener', (name) => {
        if (name === 'readable' || name === 'data')
            setImmediate(() => {
                writeFileSync(marker, 'ready');
            });
    });
process.argv = [process.execPath, 'gspot', ...call];
const { runProgram } = await import('#cli/main.ts');
process.exitCode = await runProgram(call);
