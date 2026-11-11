import { renameSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { WAIT_INTERVAL_MILLISECONDS } from '#tests/config/setup/programs.ts';
import { splitProgramArguments } from '#tests/setup/system/programs.ts';

const PAUSING_GIT_OPTIONS = {
    git: { type: 'string' },
    operation: { type: 'string' },
    'pause-on-call': { type: 'string' },
    counter: { type: 'string' },
    marker: { type: 'string' },
} as const;

const { own, call } = splitProgramArguments();
const { values } = parseArgs({ args: own, options: PAUSING_GIT_OPTIONS });
const checkouts: Record<string, string | undefined> = { init: call.at(-1), 'checkout-index': process.cwd() };
if (call[0] === values.operation) {
    const counter = Bun.file(values.counter ?? '');
    const count = ((await counter.exists()) ? Number(await counter.text()) : 0) + 1;
    await Bun.write(counter, String(count));
    if (count === Number(values['pause-on-call'])) {
        const marker = values.marker ?? '';
        const partial = `${marker}.${String(process.pid)}.partial`;
        await Bun.write(partial, JSON.stringify({ pid: process.pid, checkout: checkouts[call[0] ?? ''] }));
        renameSync(partial, marker);
        await Bun.sleep(WAIT_INTERVAL_MILLISECONDS);
    }
}
const git = Bun.spawn([values.git ?? 'git', ...call], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
process.exitCode = await git.exited;
