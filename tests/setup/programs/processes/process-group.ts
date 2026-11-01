import { streamProcess } from '#cli/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

const [exitCode = '0'] = process.argv.slice(2);
await streamProcess(
    buildProgramCommand('fakes/tool', '--print-pid', '--wait'),
    { cwd: process.cwd() },
    async (stdout) => {
        for await (const chunk of stdout) {
            process.stdout.write(chunk);
            // eslint-disable-next-line n/no-process-exit -- reason: the test checks that the CLI stops the descendant when this process exits at once.
            process.exit(Number(exitCode));
        }
    },
);
