import { parseArgs } from 'node:util';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { SPAWN_DESCENDANT_OPTIONS, WAIT_INTERVAL_MILLISECONDS } from '#tests/config/setup/programs.ts';

const { values } = parseArgs({ options: SPAWN_DESCENDANT_OPTIONS });
const descendant = Bun.spawn(
    buildProgramCommand('fakes/tool', '--mark', values.marker ?? '', '--line', values.line ?? '', '--wait'),
    { stdout: values.forward === undefined ? 'inherit' : 'pipe', stderr: 'inherit' },
);
if (values.forward !== undefined && descendant.stdout instanceof ReadableStream)
    for await (const chunk of descendant.stdout) {
        process.stdout.write(chunk);
        // eslint-disable-next-line n/no-process-exit -- reason: the test checks that capture stops a descendant this parent leaves running.
        process.exit(Number(values.forward));
    }
setInterval(() => undefined, WAIT_INTERVAL_MILLISECONDS);
