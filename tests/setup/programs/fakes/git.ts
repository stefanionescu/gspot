import { parseArgs } from 'node:util';
import { writeMarker, splitProgramArguments } from '#tests/setup/system/programs.ts';
import { PAUSING_GIT_OPTIONS, WAIT_INTERVAL_MILLISECONDS } from '#tests/config/setup/programs.ts';

const { own, call } = splitProgramArguments();
const { values } = parseArgs({ args: own, options: PAUSING_GIT_OPTIONS });
const checkouts: Record<string, string | undefined> = { init: call.at(-1), 'cat-file': process.cwd() };
if (call[0] === values.operation) {
    const counter = Bun.file(values.counter ?? '');
    const count = ((await counter.exists()) ? Number(await counter.text()) : 0) + 1;
    await Bun.write(counter, String(count));
    if (count === Number(values['pause-on-call'])) {
        await writeMarker(
            values.marker ?? '',
            JSON.stringify({ pid: process.pid, checkout: checkouts[call[0] ?? ''] }),
        );
        await Bun.sleep(WAIT_INTERVAL_MILLISECONDS);
    }
}
const git = Bun.spawn([values.git ?? 'git', ...call], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
process.exitCode = await git.exited;
